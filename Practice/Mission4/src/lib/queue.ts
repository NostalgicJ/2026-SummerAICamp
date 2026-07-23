import type { Card, SetProgress } from "../types";
import { todayISO } from "./sm2";

const NEW_CARD_LIMIT = 10;

/**
 * Builds today's study queue: due review cards first, then learning cards
 * ready for re-exposure, then a limited batch of brand-new cards.
 */
export function buildQueue(
  cards: Card[],
  progress: SetProgress,
  today: string = todayISO(),
  newCardLimit: number = NEW_CARD_LIMIT,
): Card[] {
  const due: Card[] = [];
  const learning: Card[] = [];
  const fresh: Card[] = [];

  for (const card of cards) {
    const cardProgress = progress[card.id];
    if (!cardProgress || cardProgress.state === "new") {
      fresh.push(card);
      continue;
    }
    if (cardProgress.dueDate <= today) {
      if (cardProgress.state === "review") due.push(card);
      else learning.push(card);
    }
  }

  return [...due, ...learning, ...fresh.slice(0, newCardLimit)];
}
