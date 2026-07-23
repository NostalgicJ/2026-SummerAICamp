export interface Card {
  id: string;
  front: string;
  back: string;
  example?: string;
}

export interface WordSet {
  id: string;
  name: string;
  description: string;
  language: { front: string; back: string };
  cards: Card[];
}

export interface WordSetIndex {
  sets: string[];
}

export type CardState = "new" | "learning" | "review";
export type Grade = "again" | "hard" | "good" | "easy";

export interface ReviewHistoryEntry {
  date: string;
  grade: Grade;
}

export interface CardProgress {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  dueDate: string;
  lastReviewedDate: string | null;
  state: CardState;
  history: ReviewHistoryEntry[];
}

export type SetProgress = Record<string, CardProgress>;

export interface SetStats {
  totalReviews: number;
  lastStudiedDate: string | null;
  cardsByState: { new: number; learning: number; review: number };
}

export interface SessionStats {
  again: number;
  hard: number;
  good: number;
  easy: number;
}
