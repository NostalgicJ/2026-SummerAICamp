import type { Card, Grade, SetProgress, SetStats } from "../types";
import { applyGrade, createInitialProgress, todayISO } from "./sm2";

function progressKey(setId: string): string {
  return `progress:${setId}`;
}

function statsKey(setId: string): string {
  return `stats:${setId}`;
}

const EMPTY_STATS: SetStats = {
  totalReviews: 0,
  lastStudiedDate: null,
  cardsByState: { new: 0, learning: 0, review: 0 },
};

export function loadProgress(setId: string): SetProgress {
  const raw = localStorage.getItem(progressKey(setId));
  return raw ? JSON.parse(raw) : {};
}

export function saveProgress(setId: string, progress: SetProgress): void {
  localStorage.setItem(progressKey(setId), JSON.stringify(progress));
}

/** Adds initial progress entries for any card that hasn't been seen yet. */
export function ensureProgress(setId: string, cards: Card[]): SetProgress {
  const progress = loadProgress(setId);
  let changed = false;
  for (const card of cards) {
    if (!progress[card.id]) {
      progress[card.id] = createInitialProgress();
      changed = true;
    }
  }
  if (changed) saveProgress(setId, progress);
  return progress;
}

export function loadStats(setId: string): SetStats {
  const raw = localStorage.getItem(statsKey(setId));
  return raw ? JSON.parse(raw) : EMPTY_STATS;
}

export function saveStats(setId: string, stats: SetStats): void {
  localStorage.setItem(statsKey(setId), JSON.stringify(stats));
}

function recomputeCardsByState(progress: SetProgress): SetStats["cardsByState"] {
  const counts = { new: 0, learning: 0, review: 0 };
  for (const cardProgress of Object.values(progress)) {
    counts[cardProgress.state] += 1;
  }
  return counts;
}

/** Applies a grade to one card, persisting the updated progress and stats. */
export function recordReview(setId: string, cardId: string, grade: Grade): SetProgress {
  const progress = loadProgress(setId);
  const current = progress[cardId] ?? createInitialProgress();
  progress[cardId] = applyGrade(current, grade);
  saveProgress(setId, progress);

  const stats = loadStats(setId);
  stats.totalReviews += 1;
  stats.lastStudiedDate = todayISO();
  stats.cardsByState = recomputeCardsByState(progress);
  saveStats(setId, stats);

  return progress;
}

export function removeSetData(setId: string): void {
  localStorage.removeItem(progressKey(setId));
  localStorage.removeItem(statsKey(setId));
}
