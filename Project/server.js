const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PROBLEMS_PATH = path.join(__dirname, 'data', 'problems.json');

function loadProblems() {
  const raw = fs.readFileSync(PROBLEMS_PATH, 'utf-8');
  return JSON.parse(raw);
}

function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysSinceEpoch(dateString) {
  return Math.floor(new Date(`${dateString}T00:00:00Z`).getTime() / 86400000);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Phase 1: 필터/사용자 설정 없이 날짜 기반 순차 로테이션으로만 오늘의 문제를 고른다.
app.get('/api/today', (req, res) => {
  const problems = loadProblems();
  if (problems.length === 0) {
    return res.status(500).json({ error: '문제 데이터가 없습니다.' });
  }
  const date = todayDateString();
  const index = daysSinceEpoch(date) % problems.length;
  res.json({ date, problem: problems[index] });
});

app.listen(PORT, () => {
  console.log(`코딩테스트 데일리 서버 실행 중: http://localhost:${PORT}`);
});
