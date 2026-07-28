require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const storage = require('./storage');
const { getVapidKeys } = require('./vapid');
const githubSuggest = require('./github-suggest');

const app = express();
const PORT = process.env.PORT || 3000;
const PROBLEMS_PATH = path.join(__dirname, 'data', 'problems.json');
const ALGORITHMS_PATH = path.join(__dirname, 'data', 'algorithms.json');
const CS_CONCEPTS_PATH = path.join(__dirname, 'data', 'cs-concepts.json');

const vapidKeys = getVapidKeys();
webpush.setVapidDetails('mailto:admin@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

function loadProblems() {
  const raw = fs.readFileSync(PROBLEMS_PATH, 'utf-8');
  return JSON.parse(raw);
}

function loadAlgorithms() {
  const raw = fs.readFileSync(ALGORITHMS_PATH, 'utf-8');
  return JSON.parse(raw);
}

function loadCsConcepts() {
  const raw = fs.readFileSync(CS_CONCEPTS_PATH, 'utf-8');
  return JSON.parse(raw);
}

// 서버가 어느 시간대에서 돌든(로컬 개발 / 배포 서버) 항상 한국 시간 기준으로 날짜·요일·시각을 계산한다.
// 그래야 "오늘의 문제"가 바뀌는 시점과 알림 발송 시각 판정이 배포 환경에 따라 달라지지 않는다.
function seoulNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function todayDateString() {
  const d = seoulNow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentWeekdayAndTime() {
  const d = seoulNow();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { weekday: d.getDay(), hhmm: `${hh}:${mm}` }; // weekday: 0=일 ... 6=토
}

function daysSinceEpoch(dateString) {
  return Math.floor(new Date(`${dateString}T00:00:00Z`).getTime() / 86400000);
}

// 기업/태그/난이도 필터 적용. 조건에 맞는 문제가 하나도 없으면 전체 문제로 대체한다.
function filterProblems(problems, settings) {
  let filtered = problems;

  if (settings.companies && settings.companies.length > 0) {
    filtered = filtered.filter((p) => settings.companies.includes(p.company));
  }
  if (settings.tags && settings.tags.length > 0) {
    filtered = filtered.filter((p) => {
      const problemTags = p.tags.split(',').map((t) => t.trim());
      return settings.tags.some((t) => problemTags.includes(t));
    });
  }
  if (settings.levels && settings.levels.length > 0) {
    filtered = filtered.filter((p) => settings.levels.includes(p.level));
  }

  return filtered.length > 0 ? filtered : problems;
}

function seededIndex(seedString, poolLength) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash * 31 + seedString.charCodeAt(i)) >>> 0;
  }
  return hash % poolLength;
}

// 출제 순서(순차/랜덤/안 푼 우선)에 따라 최종 후보군과 인덱스를 결정한다.
// skipOffset은 "건너뛰기"를 누른 횟수로, 같은 날 안에서 매번 다른 문제가 나오도록 인덱스를 밀어준다.
function pickTodayProblem(pool, order, clientId, date, solvedIds, skipOffset) {
  if (order === 'unsolved-first') {
    const unsolved = pool.filter((p) => !solvedIds.includes(p.id));
    const targetPool = unsolved.length > 0 ? unsolved : pool;
    const index = (daysSinceEpoch(date) + skipOffset) % targetPool.length;
    return targetPool[index];
  }
  if (order === 'random') {
    return pool[seededIndex(`${clientId}-${date}-${skipOffset}`, pool.length)];
  }
  const index = (daysSinceEpoch(date) + skipOffset) % pool.length; // sequential (기본값)
  return pool[index];
}

// 하루 발송 문제 수(1~3개)만큼 서로 다른 문제를 뽑는다. pickTodayProblem과 같은 순서 규칙을
// 재사용하되, i(0,1,2...)만큼 인덱스를 더 밀어서 각기 다른 문제가 나오게 한다.
function pickDailyProblems(pool, order, clientId, date, solvedIds, skipOffset, count) {
  const n = Math.min(Math.max(count, 1), pool.length);
  const results = [];
  for (let i = 0; i < n; i++) {
    let problem;
    if (order === 'unsolved-first') {
      const remaining = pool.filter((p) => !results.includes(p));
      const unsolved = remaining.filter((p) => !solvedIds.includes(p.id));
      const targetPool = unsolved.length > 0 ? unsolved : remaining;
      const index = (daysSinceEpoch(date) + skipOffset + i) % targetPool.length;
      problem = targetPool[index];
    } else if (order === 'random') {
      let index = seededIndex(`${clientId}-${date}-${skipOffset}-${i}`, pool.length);
      let tries = 0;
      while (results.includes(pool[index]) && tries < pool.length) {
        index = (index + 1) % pool.length;
        tries++;
      }
      problem = pool[index];
    } else {
      const index = (daysSinceEpoch(date) + skipOffset + i) % pool.length;
      problem = pool[index];
    }
    results.push(problem);
  }
  return results;
}

function currentSkipOffset(subscriber, date) {
  return subscriber.state.skipDate === date ? subscriber.state.skipSeed : 0;
}

function computeTodayProblem(problems, subscriber, clientId, date) {
  const pool = filterProblems(problems, subscriber.settings);
  const skipOffset = currentSkipOffset(subscriber, date);
  return pickTodayProblem(pool, subscriber.settings.order, clientId, date, subscriber.solvedIds, skipOffset);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/meta', (req, res) => {
  const problems = loadProblems();
  const companies = [...new Set(problems.map((p) => p.company))].sort();
  const tagSet = new Set();
  problems.forEach((p) => p.tags.split(',').forEach((t) => tagSet.add(t.trim())));
  const levels = [...new Set(problems.map((p) => p.level))].sort((a, b) => a - b);
  res.json({ companies, tags: [...tagSet].sort(), levels, suggestEnabled: githubSuggest.isConfigured() });
});

app.post('/api/suggest-problem', async (req, res) => {
  const { company, name, plat, level, tags, url, keyPoint, approach } = req.body;

  if (!company || !name || !plat || !url || !keyPoint || !approach) {
    return res.status(400).json({ error: '기업, 문제명, 플랫폼, 링크, 핵심 포인트, 풀이 접근은 모두 필수입니다.' });
  }
  const levelNum = Number(level);
  if (!Number.isInteger(levelNum) || levelNum < 1 || levelNum > 5) {
    return res.status(400).json({ error: '난이도는 1~5 사이의 정수여야 합니다.' });
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (err) {
    return res.status(400).json({ error: '링크가 올바른 URL 형식이 아닙니다.' });
  }
  const approachSteps = Array.isArray(approach)
    ? approach
    : String(approach).split('\n').map((s) => s.trim()).filter(Boolean);
  if (approachSteps.length === 0) {
    return res.status(400).json({ error: '풀이 접근을 한 단계 이상 입력해주세요.' });
  }

  try {
    const result = await githubSuggest.suggestProblem({
      company: String(company).trim(),
      name: String(name).trim(),
      plat: String(plat).trim(),
      level: levelNum,
      tags: String(tags || '').trim() || '미분류',
      url: parsedUrl.toString(),
      keyPoint: String(keyPoint).trim(),
      approach: approachSteps,
    });
    res.json({ ok: true, prUrl: result.url });
  } catch (err) {
    const status = err.notConfigured ? 503 : 500;
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/algorithms', (req, res) => {
  const algorithms = loadAlgorithms();
  const tagsParam = req.query.tags;
  if (!tagsParam) return res.json({ algorithms });

  const requested = tagsParam.split(',').map((t) => t.trim());
  const filtered = algorithms.filter((a) => requested.includes(a.tag));
  res.json({ algorithms: filtered });
});

// 문제 풀이용이 아니라 순수 정보 제공용 — 알고리즘 태그처럼 문제와 연결되지 않고 독립적으로 브라우징한다.
app.get('/api/cs-concepts', (req, res) => {
  res.json({ concepts: loadCsConcepts() });
});

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/subscribe', async (req, res) => {
  const { clientId, subscription } = req.body;
  if (!clientId || !subscription) {
    return res.status(400).json({ error: 'clientId와 subscription이 필요합니다.' });
  }
  await storage.saveSubscription(clientId, subscription);
  res.json({ ok: true });
});

app.post('/api/unsubscribe', async (req, res) => {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: 'clientId가 필요합니다.' });
  await storage.saveSubscription(clientId, null);
  res.json({ ok: true });
});

app.get('/api/settings', async (req, res) => {
  const clientId = req.query.clientId;
  if (!clientId) return res.status(400).json({ error: 'clientId가 필요합니다.' });
  const subscriber = await storage.getOrCreateSubscriber(clientId);
  res.json(subscriber.settings);
});

app.post('/api/settings', async (req, res) => {
  const { clientId, settings } = req.body;
  if (!clientId) return res.status(400).json({ error: 'clientId가 필요합니다.' });
  const merged = await storage.saveSettings(clientId, settings || {});
  res.json(merged);
});

app.get('/api/today', async (req, res) => {
  const problems = loadProblems();
  if (problems.length === 0) {
    return res.status(500).json({ error: '문제 데이터가 없습니다.' });
  }

  const clientId = req.query.clientId || 'anonymous';
  const subscriber = await storage.getOrCreateSubscriber(clientId);
  const date = todayDateString();
  const problem = computeTodayProblem(problems, subscriber, clientId, date);

  res.json({ date, problem, settings: subscriber.settings, solved: subscriber.solvedIds.includes(problem.id) });
});

app.post('/api/skip-today', async (req, res) => {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: 'clientId가 필요합니다.' });

  const problems = loadProblems();
  const subscriber = await storage.getOrCreateSubscriber(clientId);
  const date = todayDateString();

  if (subscriber.state.skipDate !== date) {
    subscriber.state.skipDate = date;
    subscriber.state.skipSeed = 0;
  }
  subscriber.state.skipSeed += 1;
  await storage.saveState(clientId, subscriber.state);

  const problem = computeTodayProblem(problems, subscriber, clientId, date);
  res.json({ date, problem, solved: subscriber.solvedIds.includes(problem.id) });
});

// 수동 테스트/재발송용 — 시간·요일 조건 없이 지금 바로 오늘의 문제를 보낸다.
app.post('/api/resend-today', async (req, res) => {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: 'clientId가 필요합니다.' });

  const subscriber = await storage.getOrCreateSubscriber(clientId);
  if (!subscriber.subscription) {
    return res.status(400).json({ error: '구독 정보가 없습니다. 먼저 알림을 켜주세요.' });
  }

  const problems = loadProblems();
  const date = todayDateString();
  const problem = computeTodayProblem(problems, subscriber, clientId, date);

  const payload = JSON.stringify({
    title: `🔔 알고핑 · 오늘의 문제: ${problem.name}`,
    body: `${problem.company} · ${problem.plat} · 난이도 ${problem.level}`,
    url: '/',
  });

  try {
    await webpush.sendNotification(subscriber.subscription, payload);
    res.json({ ok: true });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await storage.saveSubscription(clientId, null);
    }
    res.status(500).json({ error: '알림 발송에 실패했습니다.', detail: err.message });
  }
});

// 크론(GitHub Actions/cron-job.org)이 15분마다 호출하는 엔드포인트.
// 각 구독자의 알림 시간/요일/일시정지 설정을 보고 "지금 보낼 대상"만 골라 발송하고,
// 하루에 한 번만 보내지도록 state.lastSentDate로 중복 발송을 막는다.
app.post('/api/send-daily', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization || '';
    const providedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.query.secret;
    if (providedSecret !== cronSecret) {
      return res.status(401).json({ error: '인증에 실패했습니다.' });
    }
  }

  const problems = loadProblems();
  const subscribers = await storage.getAllSubscribers();
  const today = todayDateString();
  const { weekday, hhmm: nowTime } = currentWeekdayAndTime();

  let sent = 0;
  let skipped = 0;

  for (const subscriber of subscribers) {
    const { clientId, settings, subscription, state } = subscriber;

    if (!subscription) {
      skipped++;
      continue;
    }

    // 일시정지: 종료일이 지났으면 자동 해제하고 계속 진행, 아니면 건너뛴다.
    let paused = settings.paused || { active: false, until: null };
    if (paused.active && paused.until && today > paused.until) {
      paused = { active: false, until: null };
      await storage.saveSettings(clientId, { paused });
    }
    if (paused.active) {
      skipped++;
      continue;
    }

    const notifyDays = settings.notifyDays && settings.notifyDays.length > 0 ? settings.notifyDays : [0, 1, 2, 3, 4, 5, 6];
    if (!notifyDays.includes(weekday)) {
      skipped++;
      continue;
    }

    const notifyTime = settings.notifyTime || '09:00';
    if (nowTime < notifyTime) {
      skipped++;
      continue;
    }

    if (state.lastSentDate === today) {
      skipped++;
      continue;
    }

    const pool = filterProblems(problems, settings);
    const skipOffset = currentSkipOffset(subscriber, today);
    const count = Math.min(Math.max(settings.problemsPerDay || 1, 1), 3);
    const picked = pickDailyProblems(pool, settings.order, clientId, today, subscriber.solvedIds, skipOffset, count);

    const payload = JSON.stringify({
      title: picked.length === 1 ? `🔔 알고핑 · 오늘의 문제: ${picked[0].name}` : `🔔 알고핑 · 오늘의 문제 ${picked.length}개가 도착했어요`,
      body: picked.map((p) => `${p.company} ${p.name}`).join(', '),
      url: '/',
    });

    try {
      await webpush.sendNotification(subscription, payload);
      await storage.saveState(clientId, { ...state, lastSentDate: today });
      sent++;
    } catch (err) {
      console.error(`[send-daily] ${clientId} 발송 실패:`, err.statusCode || '', err.message);
      if (err.statusCode === 404 || err.statusCode === 410) {
        await storage.saveSubscription(clientId, null);
      }
      skipped++;
    }
  }

  res.json({ date: today, weekday, time: nowTime, total: subscribers.length, sent, skipped });
});

app.get('/api/solved', async (req, res) => {
  const clientId = req.query.clientId;
  if (!clientId) return res.status(400).json({ error: 'clientId가 필요합니다.' });

  const problems = loadProblems();
  const subscriber = await storage.getOrCreateSubscriber(clientId);
  const solved = problems.filter((p) => subscriber.solvedIds.includes(p.id));

  res.json({ solved });
});

// 통계 대시보드용 집계. solvedLog에 date가 없는(기능 추가 이전에 풀었던) 항목은
// 총 풀이 수·태그 분포에는 잡히지만 날짜 기반 통계(요일별/달력/스트릭)에서는 자연히 제외된다.
app.get('/api/stats', async (req, res) => {
  const clientId = req.query.clientId;
  if (!clientId) return res.status(400).json({ error: 'clientId가 필요합니다.' });

  const problems = loadProblems();
  const problemsById = new Map(problems.map((p) => [p.id, p]));
  const subscriber = await storage.getOrCreateSubscriber(clientId);

  const byTag = {};
  subscriber.solvedIds.forEach((id) => {
    const p = problemsById.get(id);
    if (!p) return;
    p.tags.split(',').map((t) => t.trim()).filter(Boolean).forEach((tag) => {
      byTag[tag] = (byTag[tag] || 0) + 1;
    });
  });

  const datedLog = subscriber.solvedLog.filter((entry) => entry.date);

  const byWeekday = [0, 0, 0, 0, 0, 0, 0]; // 0=일 ... 6=토
  const countByDate = {};
  datedLog.forEach((entry) => {
    byWeekday[new Date(`${entry.date}T00:00:00Z`).getUTCDay()] += 1;
    countByDate[entry.date] = (countByDate[entry.date] || 0) + 1;
  });

  const today = todayDateString();
  const todayDay = daysSinceEpoch(today);
  const todayWeekday = new Date(todayDay * 86400000).getUTCDay();
  const WEEKS = 14;
  // 잔디밭 그리드가 일~토 7행으로 딱 떨어지도록, 시작일을 해당 주의 일요일로 맞춘다.
  const startDay = todayDay - todayWeekday - (WEEKS - 1) * 7;
  const calendar = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const dateStr = new Date((startDay + i) * 86400000).toISOString().slice(0, 10);
    calendar.push({ date: dateStr, count: countByDate[dateStr] || 0 });
  }

  let currentStreak = 0;
  let cursor = countByDate[today] ? todayDay : todayDay - 1;
  while (countByDate[new Date(cursor * 86400000).toISOString().slice(0, 10)]) {
    currentStreak += 1;
    cursor -= 1;
  }

  let longestStreak = 0;
  let run = 0;
  let prevDay = null;
  Object.keys(countByDate).sort().forEach((dateStr) => {
    const dayNum = daysSinceEpoch(dateStr);
    run = prevDay !== null && dayNum === prevDay + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prevDay = dayNum;
  });

  res.json({
    totalSolved: subscriber.solvedIds.length,
    byTag,
    byWeekday,
    calendar,
    streak: { current: currentStreak, longest: longestStreak },
  });
});

app.post('/api/mark-solved', async (req, res) => {
  const { clientId, problemId } = req.body;
  if (!clientId || !problemId) return res.status(400).json({ error: 'clientId와 problemId가 필요합니다.' });
  const solvedIds = await storage.addSolved(clientId, problemId, todayDateString());
  res.json({ solvedIds });
});

app.post('/api/reset-progress', async (req, res) => {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: 'clientId가 필요합니다.' });
  const solvedIds = await storage.clearSolved(clientId);
  res.json({ solvedIds });
});

app.listen(PORT, () => {
  console.log(`AlGoPing 서버 실행 중: http://localhost:${PORT} (저장소: ${storage.isPostgres ? 'Postgres' : '로컬 파일'})`);
});
