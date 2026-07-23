import type { WordSet, WordSetIndex } from "../types";
import { getCustomSet, loadCustomSets, loadHiddenBuiltinIds } from "./customSets";

const BASE = `${import.meta.env.BASE_URL}wordsets`;

export async function fetchSetIndex(): Promise<string[]> {
  const res = await fetch(`${BASE}/index.json`, { cache: "no-store" });
  if (!res.ok) throw new Error("세트 인덱스를 불러오지 못했습니다.");
  const data: WordSetIndex = await res.json();
  return data.sets;
}

export async function fetchWordSet(setId: string): Promise<WordSet> {
  const res = await fetch(`${BASE}/${setId}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`단어 세트를 불러오지 못했습니다: ${setId}`);
  return res.json();
}

/** All built-in (static file) sets, regardless of whether the user has hidden them. */
export async function fetchAllWordSets(): Promise<WordSet[]> {
  const ids = await fetchSetIndex();
  return Promise.all(ids.map(fetchWordSet));
}

export interface VisibleWordSet {
  set: WordSet;
  origin: "builtin" | "custom";
}

/** Built-in sets (minus ones the user removed) plus user-added custom sets. */
export async function fetchVisibleWordSets(): Promise<VisibleWordSet[]> {
  let builtins: WordSet[] = [];
  try {
    builtins = await fetchAllWordSets();
  } catch {
    builtins = [];
  }
  const hidden = new Set(loadHiddenBuiltinIds());

  return [
    ...builtins.filter((s) => !hidden.has(s.id)).map((set) => ({ set, origin: "builtin" as const })),
    ...loadCustomSets().map((set) => ({ set, origin: "custom" as const })),
  ];
}

/** Fetches a single set for study, checking custom (localStorage) sets before static files. */
export async function getWordSetById(setId: string): Promise<WordSet> {
  const custom = getCustomSet(setId);
  if (custom) return custom;
  return fetchWordSet(setId);
}
