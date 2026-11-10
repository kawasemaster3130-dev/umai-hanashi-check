// ぱっとチェック：貼った文章・会社名・電話番号から、すぐ分かることだけを出す（判定はしない）
import quickRaw from '../../config/quick.json';
import type { AutoHint, Case, ChecklistItem } from '../types';
import { newCase } from '../types';
import type { KeywordsConfig } from '../data/config';
import { linkByKey } from '../data/config';
import { computeAutoHints } from './hints';
import { caseTitle, findCrossMatches, searchCases, splitQuery, type CrossMatch } from './crossref';
import { digitsOnly } from './util';
import { lookupRegistry, type RegistryData, type RegistryLookup } from './registry';
import { countVerdicts, overallVerdict } from './verdict';
import type { Overall } from '../types';

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

/** 前に調べた記録（判定を1つ以上入れたものだけ） */
export interface PastRecord {
  caseId: string;
  caseName: string;
  caseDate: string;
  overall: Overall;
  decided: number;
  confirmed: boolean;
  matches: string[];
}

export interface QuickResult {
  level: 'red' | 'yellow' | 'none';
  headline: { title: string; sub: string };
  hasText: boolean;
  hits: QuickHit[];
  past: PastRecord[];
  registry: RegistryLookup;
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

export function quickCheck(input: QuickInput, cases: Case[], keywords: KeywordsConfig, items: ChecklistItem[], now: string, registryData?: RegistryData | null): QuickResult {
  const draft = draftCase(input, now);
  const hintsById: Record<string, AutoHint[]> = computeAutoHints(draft, keywords, items);
  const hits: QuickHit[] = Object.entries(hintsById)
    .map(([itemId, hs]) => ({ itemId, label: quickConfig.labels[itemId] ?? items.find((i) => i.id === itemId)?.question ?? itemId, suggest: hs.some((h) => h.suggest === 'red') ? ('red' as const) : ('yellow' as const), quotes: hs.map((h) => h.quote) }))
    .sort((a, b) => (a.suggest === b.suggest ? 0 : a.suggest === 'red' ? -1 : 1));
  const q = input.query.trim();
  const { names, phones } = splitTerms(q);
  const raw: CrossMatch[] = findCrossMatches(draft, cases);
  if (q) {
    for (const { c, hits: hs } of searchCases(cases, q)) {
      for (const h of hs) {
        if (raw.some((m) => m.caseId === c.id && m.otherValue === h.value)) continue;
        raw.push({ field: '入力した言葉', value: q, otherField: h.field, otherValue: h.value, caseId: c.id, caseName: caseTitle(c), caseDate: c.createdAt });
      }
    }
  }
  // 判定を1つも入れていない記録（作りかけ）は「前に調べた」に数えない
  const past: PastRecord[] = [];
  for (const m of raw) {
    const c = cases.find((x) => x.id === m.caseId);
    if (!c) continue;
    const counts = countVerdicts(items, c.items);
    const decided = items.length - counts.unchecked;
    if (decided === 0) continue;
    let rec = past.find((p) => p.caseId === c.id);
    if (!rec) {
      rec = { caseId: c.id, caseName: m.caseName, caseDate: m.caseDate, overall: overallVerdict(counts), decided, confirmed: c.snapshots.length > 0, matches: [] };
      past.push(rec);
    }
    const label = `${m.otherField}「${m.otherValue}」`;
    if (!rec.matches.includes(label)) rec.matches.push(label);
  }
  const registry = lookupRegistry(registryData ?? undefined, { names, phones, text: input.text });
  const hasText = input.text.trim().length > 0;
  const hitLevel = hits.some((h) => h.suggest === 'red') ? 'red' : hits.length ? 'yellow' : 'none';
  const level: QuickResult['level'] = hitLevel === 'red' || registry.level === 'red' ? 'red' : hitLevel === 'yellow' || registry.level === 'yellow' ? 'yellow' : 'none';
  const headline = makeHeadline(level, registry, hasText);
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
  return { level, headline, hasText, hits, past, registry, actions, draft };
}

function makeHeadline(level: QuickResult['level'], r: RegistryLookup, hasText: boolean): { title: string; sub: string } {
  if (level === 'red') {
    if (r.warned.length) return { title: '金融庁の警告の一覧に名前があります', sub: '登録なしで勧誘していたとして、警告を受けた名前です。払いません。' };
    if (r.numberOwners.some((x) => !x.owner)) return { title: 'その登録番号は一覧にありません', sub: '言われた登録番号が、金融庁の一覧に見つかりません。' };
    if (r.numberOwners.some((x) => !x.matchesName)) return { title: '登録番号が別の会社のものです', sub: '番号だけ借りた「なりすまし」のおそれがあります。' };
    return { title: 'やめる理由になる言葉があります', sub: '下に、見つかった言葉を出します。' };
  }
  if (level === 'yellow') {
    if (r.level === 'yellow') return { title: '登録の一覧に名前が見つかりません', sub: '登録のない相手がお金を集めるのは、やめる理由です。略称や英語名でも入れてみてください。' };
    return { title: '気になる言葉があります', sub: '下に、見つかった言葉を出します。' };
  }
  if (r.level === 'info') return { title: '登録の一覧に名前があります', sub: 'ただし、名前をかたる「なりすまし」があります。住所と電話番号が同じか、下で見比べてください。' };
  if (hasText) return { title: '言葉からは見つかりませんでした', sub: '安全という意味ではありません。会社の名前も入れて、登録を見てください。' };
  return { title: '名前だけでは分かりませんでした', sub: r.available ? '下のボタンで、自分の目で見てください。' : '金融庁の一覧の写しが読み込めていません。下のボタンで、自分の目で見てください。' };
}
