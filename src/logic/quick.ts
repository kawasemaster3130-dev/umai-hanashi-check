// ぱっとチェック：貼った文章・会社名・電話番号から、すぐ分かることだけを出す（判定はしない）
import quickRaw from '../../config/quick.json';
import type { AutoHint, Case, ChecklistItem } from '../types';
import { newCase } from '../types';
import type { KeywordsConfig } from '../data/config';
import { linkByKey } from '../data/config';
import { computeAutoHints } from './hints';
import { caseTitle, findCrossMatches, searchCases, splitQuery, type CrossMatch } from './crossref';
import { digitsOnly } from './util';

export interface QuickConfig {
  labels: Record<string, string>;
  actions: { key: string; label: string; linkKey?: string; search?: string; copy?: 'name'; how: string }[];
}
export const quickConfig = quickRaw as QuickConfig;

export interface QuickInput {
  text: string; // 貼ったやり取り（OCRの結果も）
  query: string; // 会社名・人の名前・電話番号
}

export interface QuickHit {
  itemId: string;
  label: string;
  suggest: 'red' | 'yellow';
  quotes: string[];
}

export interface QuickAction {
  key: string;
  label: string;
  url: string;
  copy?: string; // 開くときに自動でコピーする言葉
  copies?: string[]; // コピーのボタンを出す言葉（複数）
  how: string;
}

export interface QuickResult {
  level: 'red' | 'yellow' | 'none';
  hits: QuickHit[];
  past: CrossMatch[];
  actions: QuickAction[];
  draft: Case; // そのまま案件にできる下書き
}

export function looksLikePhone(q: string): boolean {
  const d = digitsOnly(q);
  return d.length >= 10 && d.length <= 11 && /^[0-9０-９\-－() （）+＋#＃ ]+$/.test(q.trim());
}

/** 入力から案件の下書きを作る（保存はしない） */
export function draftCase(input: QuickInput, now: string): Case {
  const c = newCase('quick-draft', now);
  c.rawMessages = input.text.trim();
  const { names, phones } = splitTerms(input.query);
  if (phones.length) c.card.companyPhone = phones[0];
  if (names.length) c.card.companyNames = names;
  return c;
}

/** 入力した言葉を、名前（会社名・案件名・人名）と電話番号に分ける */
export function splitTerms(query: string): { names: string[]; phones: string[] } {
  const names: string[] = [];
  const phones: string[] = [];
  for (const t of splitQuery(query)) (looksLikePhone(t) ? phones : names).push(t);
  return { names, phones };
}

export function quickCheck(input: QuickInput, cases: Case[], keywords: KeywordsConfig, items: ChecklistItem[], now: string): QuickResult {
  const draft = draftCase(input, now);
  const hintsById: Record<string, AutoHint[]> = computeAutoHints(draft, keywords, items);
  const hits: QuickHit[] = Object.entries(hintsById)
    .map(([itemId, hs]) => ({ itemId, label: quickConfig.labels[itemId] ?? items.find((i) => i.id === itemId)?.question ?? itemId, suggest: hs.some((h) => h.suggest === 'red') ? ('red' as const) : ('yellow' as const), quotes: hs.map((h) => h.quote) }))
    .sort((a, b) => (a.suggest === b.suggest ? 0 : a.suggest === 'red' ? -1 : 1));
  const level = hits.some((h) => h.suggest === 'red') ? 'red' : hits.length ? 'yellow' : 'none';
  const q = input.query.trim();
  const { names, phones } = splitTerms(q);
  const past: CrossMatch[] = findCrossMatches(draft, cases);
  if (q) {
    for (const { c, hits: hs } of searchCases(cases, q)) {
      for (const h of hs) {
        if (past.some((m) => m.caseId === c.id && m.otherValue === h.value)) continue;
        past.push({ field: '入力した言葉', value: q, otherField: h.field, otherValue: h.value, caseId: c.id, caseName: caseTitle(c), caseDate: c.createdAt });
      }
    }
  }
  const name = names.length ? names.map((n) => `"${n}"`).join(' ') : undefined;
  const actions: QuickAction[] = [];
  for (const a of quickConfig.actions) {
    if (a.key === 'phone') {
      for (const ph of phones) {
        const url = `https://www.google.com/search?q=${encodeURIComponent((a.search ?? '"{{phone}}"').replace('{{phone}}', ph))}`;
        actions.push({ key: `phone:${ph}`, label: `${a.label}（${ph}）`, url, how: a.how });
      }
      continue;
    }
    if (!name) continue;
    let url = '';
    if (a.linkKey) url = linkByKey(a.linkKey)?.url ?? '';
    if (a.search) url = `https://www.google.com/search?q=${encodeURIComponent(a.search.replace('{{name}}', name))}`;
    if (!url) continue;
    actions.push({ key: a.key, label: a.label, url, copy: a.copy === 'name' ? names[0] : undefined, copies: a.copy === 'name' ? names : undefined, how: a.how });
  }
  return { level, hits, past, actions, draft };
}
