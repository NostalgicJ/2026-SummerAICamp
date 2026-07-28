// 구독자(설정/풀이 기록/진행 상태) 저장소 추상화.
// DATABASE_URL이 있으면 Postgres, 없으면 로컬 JSON 파일(data/subscribers.json)을 사용한다.
// 호출부(server.js)는 이 모듈이 내보내는 함수만 알면 되고, 어떤 저장소를 쓰는지는 신경 쓰지 않는다.
const fs = require('fs');
const path = require('path');

const SUBSCRIBERS_PATH = path.join(__dirname, 'data', 'subscribers.json');
const isPostgres = !!process.env.DATABASE_URL;

function defaultSettings() {
  return {
    companies: [],
    tags: [],
    levels: [],
    order: 'sequential',
    notifyTime: '09:00',
    notifyDays: [0, 1, 2, 3, 4, 5, 6], // 0=일 ... 6=토
    problemsPerDay: 1,
    paused: { active: false, until: null },
  };
}

function defaultSubscriber() {
  return {
    settings: defaultSettings(),
    solvedIds: [],
    solvedLog: [],
    state: { skipDate: null, skipSeed: 0, lastSentDate: null },
    subscription: null,
  };
}

// 예전 버전 레코드에 필드가 빠져 있을 수 있으므로 방어적으로 채워준다.
function normalize(subscriber) {
  const defaults = defaultSettings();
  if (!subscriber.settings) subscriber.settings = defaults;
  subscriber.settings = { ...defaults, ...subscriber.settings };
  if (!subscriber.solvedIds) subscriber.solvedIds = [];
  // solvedLog는 나중에 추가된 필드라, 그 전에 이미 풀었던 문제는 날짜를 알 수 없다.
  // date: null로 채워두면 통계에서 총 풀이 수엔 잡히되 날짜 기반 차트(잔디밭/요일별)에서는 자연히 제외된다.
  if (!subscriber.solvedLog) subscriber.solvedLog = subscriber.solvedIds.map((id) => ({ id, date: null }));
  if (!subscriber.state) subscriber.state = { skipDate: null, skipSeed: 0, lastSentDate: null };
  if (subscriber.state.lastSentDate === undefined) subscriber.state.lastSentDate = null;
  if (subscriber.subscription === undefined) subscriber.subscription = null;
  return subscriber;
}

let impl;

if (isPostgres) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const ready = pool.query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      client_id TEXT PRIMARY KEY,
      subscription JSONB,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      solved_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      state JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `).then(() => pool.query(`
    ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS solved_log JSONB NOT NULL DEFAULT '[]'::jsonb
  `));

  function rowToSubscriber(row) {
    return normalize({
      settings: row.settings,
      solvedIds: row.solved_ids,
      solvedLog: row.solved_log,
      state: row.state,
      subscription: row.subscription,
    });
  }

  async function fetchRow(clientId) {
    const { rows } = await pool.query(
      'SELECT subscription, settings, solved_ids, solved_log, state FROM subscribers WHERE client_id = $1',
      [clientId]
    );
    if (rows.length === 0) return null;
    return rowToSubscriber(rows[0]);
  }

  impl = {
    async getOrCreateSubscriber(clientId) {
      await ready;
      const existing = await fetchRow(clientId);
      if (existing) return existing;

      const fresh = defaultSubscriber();
      await pool.query(
        'INSERT INTO subscribers (client_id, settings, solved_ids, solved_log, state) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (client_id) DO NOTHING',
        [clientId, JSON.stringify(fresh.settings), JSON.stringify(fresh.solvedIds), JSON.stringify(fresh.solvedLog), JSON.stringify(fresh.state)]
      );
      return (await fetchRow(clientId)) || fresh;
    },

    async getAllSubscribers() {
      await ready;
      const { rows } = await pool.query('SELECT client_id, subscription, settings, solved_ids, solved_log, state FROM subscribers');
      return rows.map((row) => ({ clientId: row.client_id, ...rowToSubscriber(row) }));
    },

    async saveSubscription(clientId, subscription) {
      await ready;
      await impl.getOrCreateSubscriber(clientId);
      await pool.query('UPDATE subscribers SET subscription = $2 WHERE client_id = $1', [
        clientId,
        subscription ? JSON.stringify(subscription) : null,
      ]);
    },

    async saveSettings(clientId, partialSettings) {
      await ready;
      const subscriber = await impl.getOrCreateSubscriber(clientId);
      const merged = { ...subscriber.settings, ...partialSettings };
      await pool.query('UPDATE subscribers SET settings = $2 WHERE client_id = $1', [clientId, JSON.stringify(merged)]);
      return merged;
    },

    async saveState(clientId, state) {
      await ready;
      await impl.getOrCreateSubscriber(clientId);
      await pool.query('UPDATE subscribers SET state = $2 WHERE client_id = $1', [clientId, JSON.stringify(state)]);
    },

    async addSolved(clientId, problemId, date) {
      await ready;
      const subscriber = await impl.getOrCreateSubscriber(clientId);
      if (!subscriber.solvedIds.includes(problemId)) {
        subscriber.solvedIds.push(problemId);
        subscriber.solvedLog.push({ id: problemId, date: date || null });
        await pool.query('UPDATE subscribers SET solved_ids = $2, solved_log = $3 WHERE client_id = $1', [
          clientId,
          JSON.stringify(subscriber.solvedIds),
          JSON.stringify(subscriber.solvedLog),
        ]);
      }
      return subscriber.solvedIds;
    },

    async clearSolved(clientId) {
      await ready;
      await impl.getOrCreateSubscriber(clientId);
      await pool.query('UPDATE subscribers SET solved_ids = $2, solved_log = $2 WHERE client_id = $1', [clientId, JSON.stringify([])]);
      return [];
    },
  };
} else {
  function loadAll() {
    if (!fs.existsSync(SUBSCRIBERS_PATH)) return {};
    const raw = fs.readFileSync(SUBSCRIBERS_PATH, 'utf-8');
    return raw.trim() ? JSON.parse(raw) : {};
  }

  function saveAll(all) {
    fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify(all, null, 2), 'utf-8');
  }

  impl = {
    async getOrCreateSubscriber(clientId) {
      const all = loadAll();
      if (!all[clientId]) {
        all[clientId] = defaultSubscriber();
        saveAll(all);
      }
      return normalize(all[clientId]);
    },

    async getAllSubscribers() {
      const all = loadAll();
      return Object.entries(all).map(([clientId, sub]) => ({ clientId, ...normalize(sub) }));
    },

    async saveSubscription(clientId, subscription) {
      const all = loadAll();
      const subscriber = normalize(all[clientId] || defaultSubscriber());
      subscriber.subscription = subscription;
      all[clientId] = subscriber;
      saveAll(all);
    },

    async saveSettings(clientId, partialSettings) {
      const all = loadAll();
      const subscriber = normalize(all[clientId] || defaultSubscriber());
      subscriber.settings = { ...subscriber.settings, ...partialSettings };
      all[clientId] = subscriber;
      saveAll(all);
      return subscriber.settings;
    },

    async saveState(clientId, state) {
      const all = loadAll();
      const subscriber = normalize(all[clientId] || defaultSubscriber());
      subscriber.state = state;
      all[clientId] = subscriber;
      saveAll(all);
    },

    async addSolved(clientId, problemId, date) {
      const all = loadAll();
      const subscriber = normalize(all[clientId] || defaultSubscriber());
      if (!subscriber.solvedIds.includes(problemId)) {
        subscriber.solvedIds.push(problemId);
        subscriber.solvedLog.push({ id: problemId, date: date || null });
      }
      all[clientId] = subscriber;
      saveAll(all);
      return subscriber.solvedIds;
    },

    async clearSolved(clientId) {
      const all = loadAll();
      const subscriber = normalize(all[clientId] || defaultSubscriber());
      subscriber.solvedIds = [];
      subscriber.solvedLog = [];
      all[clientId] = subscriber;
      saveAll(all);
      return [];
    },
  };
}

module.exports = {
  isPostgres,
  getOrCreateSubscriber: (clientId) => impl.getOrCreateSubscriber(clientId),
  getAllSubscribers: () => impl.getAllSubscribers(),
  saveSubscription: (clientId, subscription) => impl.saveSubscription(clientId, subscription),
  saveSettings: (clientId, settings) => impl.saveSettings(clientId, settings),
  saveState: (clientId, state) => impl.saveState(clientId, state),
  addSolved: (clientId, problemId, date) => impl.addSolved(clientId, problemId, date),
  clearSolved: (clientId) => impl.clearSolved(clientId),
};
