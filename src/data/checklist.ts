import raw from '../../checklist_items.json';
import rulesRaw from '../../config/rules.json';
import type { ChecklistCategory, ChecklistItem } from '../types';

export interface ChecklistData {
  version: string;
  source: string;
  categories: ChecklistCategory[];
  items: ChecklistItem[];
  optionalItems_proposal: ChecklistItem[];
}

export const checklist = raw as unknown as ChecklistData;

export interface Rules {
  previousNameRecheck: { triggerItem: string; dependentItem: string; rangeItems: string[] };
  celebrityItem: string;
  registryItem: string;
  withdrawalItem: string;
  payeeNameItem: string;
  contactChannelItem: string;
  cardOnlyCategories: number[];
  maxRedsOnSheet: number;
  maxYellowsInConclusion: number;
  maxYellowsOnSheet: number;
  earlyStopMinutes: number;
}

export const rules = rulesRaw as Rules;

export const BASE_ITEMS: ChecklistItem[] = checklist.items;
export const OPTIONAL_ITEMS: ChecklistItem[] = checklist.optionalItems_proposal;
export const CATEGORIES: ChecklistCategory[] = checklist.categories;

/** 有効な項目（41項目＋設定で有効にした追加項目）。分類順・番号順に並べる */
export function getActiveItems(enabledOptional: string[] = []): ChecklistItem[] {
  const extras = OPTIONAL_ITEMS.filter((x) => enabledOptional.includes(x.id));
  const all = [...BASE_ITEMS, ...extras];
  return all.sort((a, b) => (a.cat !== b.cat ? a.cat - b.cat : BASE_ITEMS.indexOf(a) - BASE_ITEMS.indexOf(b)));
}

export function itemsByCategory(items: ChecklistItem[]): Map<number, ChecklistItem[]> {
  const m = new Map<number, ChecklistItem[]>();
  for (const c of CATEGORIES) m.set(c.no, []);
  for (const it of items) {
    if (!m.has(it.cat)) m.set(it.cat, []);
    m.get(it.cat)!.push(it);
  }
  return m;
}

export function findItem(items: ChecklistItem[], id: string): ChecklistItem | undefined {
  return items.find((x) => x.id === id);
}

export function categoryOf(no: number): ChecklistCategory | undefined {
  return CATEGORIES.find((c) => c.no === no);
}
