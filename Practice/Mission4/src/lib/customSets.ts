import type { WordSet } from "../types";

const CUSTOM_SETS_KEY = "customSets";
const HIDDEN_BUILTIN_KEY = "hiddenBuiltinSets";

export function loadCustomSets(): WordSet[] {
  const raw = localStorage.getItem(CUSTOM_SETS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveCustomSets(sets: WordSet[]): void {
  localStorage.setItem(CUSTOM_SETS_KEY, JSON.stringify(sets));
}

export function getCustomSet(id: string): WordSet | undefined {
  return loadCustomSets().find((s) => s.id === id);
}

export function upsertCustomSet(set: WordSet): void {
  const sets = loadCustomSets().filter((s) => s.id !== set.id);
  sets.push(set);
  saveCustomSets(sets);
}

export function deleteCustomSet(id: string): void {
  saveCustomSets(loadCustomSets().filter((s) => s.id !== id));
}

export function loadHiddenBuiltinIds(): string[] {
  const raw = localStorage.getItem(HIDDEN_BUILTIN_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function hideBuiltinSet(id: string): void {
  const hidden = new Set(loadHiddenBuiltinIds());
  hidden.add(id);
  localStorage.setItem(HIDDEN_BUILTIN_KEY, JSON.stringify([...hidden]));
}

/** Validates and normalizes a parsed JSON value into a WordSet. Throws with a user-facing message on failure. */
export function parseWordSetJSON(data: unknown): WordSet {
  if (typeof data !== "object" || data === null) {
    throw new Error("올바른 JSON 객체가 아닙니다.");
  }
  const d = data as Record<string, unknown>;

  if (typeof d.id !== "string" || d.id.trim() === "") {
    throw new Error("'id' 필드(문자열)가 필요합니다.");
  }
  if (typeof d.name !== "string" || d.name.trim() === "") {
    throw new Error("'name' 필드(문자열)가 필요합니다.");
  }
  if (!Array.isArray(d.cards) || d.cards.length === 0) {
    throw new Error("'cards' 배열이 필요하고, 최소 1개 이상의 카드가 있어야 합니다.");
  }

  const cards = d.cards.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`cards[${i}] 항목이 올바르지 않습니다.`);
    }
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.front !== "string" || typeof c.back !== "string") {
      throw new Error(`cards[${i}]에는 id/front/back 문자열이 모두 필요합니다.`);
    }
    return {
      id: c.id,
      front: c.front,
      back: c.back,
      example: typeof c.example === "string" ? c.example : undefined,
    };
  });

  const language =
    typeof d.language === "object" && d.language !== null
      ? (d.language as WordSet["language"])
      : { front: "?", back: "?" };

  return {
    id: d.id,
    name: d.name,
    description: typeof d.description === "string" ? d.description : "",
    language,
    cards,
  };
}
