import type { CardProgress, CardState, Grade } from "../types";

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
const REVIEW_REPETITIONS_THRESHOLD = 2;

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(date: Date = new Date()): string {
  return formatDate(date);
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Math.round(days));
  return formatDate(dt);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function roundEase(n: number): number {
  return Math.round(n * 100) / 100;
}

export function createInitialProgress(today: string = todayISO()): CardProgress {
  return {
    repetitions: 0,
    easeFactor: DEFAULT_EASE,
    intervalDays: 0,
    dueDate: today,
    lastReviewedDate: null,
    state: "new",
    history: [],
  };
}

function deriveState(repetitions: number): CardState {
  return repetitions >= REVIEW_REPETITIONS_THRESHOLD ? "review" : "learning";
}

function nextGoodInterval(repetitions: number, prevInterval: number, easeFactor: number): number {
  if (repetitions === 0) return 1;
  if (repetitions === 1) return 6;
  return round1(prevInterval * easeFactor);
}

export function applyGrade(
  progress: CardProgress,
  grade: Grade,
  today: string = todayISO(),
): CardProgress {
  let { repetitions, easeFactor, intervalDays } = progress;
  let state: CardState;

  switch (grade) {
    case "again": {
      repetitions = 0;
      easeFactor = Math.max(MIN_EASE, roundEase(easeFactor - 0.2));
      intervalDays = 1;
      state = "learning";
      break;
    }
    case "hard": {
      easeFactor = Math.max(MIN_EASE, roundEase(easeFactor - 0.15));
      intervalDays = Math.max(1, round1(intervalDays * 1.2));
      repetitions += 1;
      state = deriveState(repetitions);
      break;
    }
    case "good": {
      intervalDays = nextGoodInterval(repetitions, intervalDays, easeFactor);
      repetitions += 1;
      state = deriveState(repetitions);
      break;
    }
    case "easy": {
      intervalDays = round1(nextGoodInterval(repetitions, intervalDays, easeFactor) * 1.3);
      easeFactor = roundEase(easeFactor + 0.15);
      repetitions += 1;
      state = deriveState(repetitions);
      break;
    }
  }

  return {
    repetitions,
    easeFactor,
    intervalDays,
    dueDate: addDays(today, intervalDays),
    lastReviewedDate: today,
    state,
    history: [...progress.history, { date: today, grade }],
  };
}
