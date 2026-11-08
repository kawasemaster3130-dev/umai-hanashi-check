// 仕様書 4.6 案件カードからの自動の気づき（候補を出すだけ。判定はしない）
import type { AutoHint, Case, CaseCard, ChecklistItem, ItemResult } from '../types';
import { emptyItemResult } from '../types';
import type { KeywordRule, KeywordsConfig } from '../data/config';
import { isBlank, normalizeKey } from './util';

const WINDOW = 22;

function quoteAround(text: string, start: number, end: number): string {
  const s = Math.max(0, start - WINDOW);
  const e = Math.min(text.length, end + WINDOW);
  let q = text.slice(s, e).replace(/\s+/g, ' ').trim();
  if (s > 0) q = `…${q}`;
  if (e < text.length) q = `${q}…`;
  return q;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findMatches(text: string, rule: KeywordRule): AutoHint[] {
  if (!text) return [];
  const hits: { start: number; end: number }[] = [];
  const sources: RegExp[] = [];
  for (const w of rule.words ?? []) sources.push(new RegExp(escapeRe(w), 'gi'));
  for (const p of rule.patterns ?? []) {
    try {
      sources.push(new RegExp(p, 'gi'));
    } catch {
      // 設定ファイルの正規表現が壊れていても落とさない
    }
  }
  for (const re of sources) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      hits.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const out: AutoHint[] = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.start < lastEnd) continue; // 近すぎる一致は1つにまとめる
    out.push({ suggest: rule.suggest, quote: quoteAround(text, h.start, h.end), note: rule.note });
    lastEnd = h.end + WINDOW;
  }
  return out;
}

function cardText(card: CaseCard): string {
  return [
    card.promisedReturn,
    card.withdrawal,
    card.deadline,
    card.amount,
    card.introducer?.relation,
    card.receivedAt?.channel,
    ...(card.notablePhrases ?? []),
  ]
    .filter((s): s is string => !isBlank(s))
    .join('\n');
}

const NONE_WORDS = ['なし', '無し', '出ていない', '書かれていない', 'いない', 'ない', '不明', 'null', 'none', '-', '－', '—'];

export function looksLikeNone(s?: string): boolean {
  if (isBlank(s)) return true;
  const t = s!.trim().toLowerCase();
  return NONE_WORDS.some((w) => t === w || t === `（${w}）` || t === `(${w})`);
}

/** 振込先の名義が会社名と一致しなさそうか（法人略号もなく、会社名とも重ならない） */
export function payeeLooksPersonal(card: CaseCard, markers: string[]): boolean {
  const name = card.payee?.accountName;
  if (isBlank(name)) return false;
  const n = name!.normalize('NFKC');
  if (markers.some((m) => n.toUpperCase().includes(m.normalize('NFKC').toUpperCase()))) return false;
  const key = normalizeKey(n);
  for (const cn of card.companyNames) {
    const ck = normalizeKey(cn);
    if (!ck) continue;
    if (key.includes(ck) || ck.includes(key)) return false;
    // 会社名の中の固有部分（「株式会社」などを除いた部分）と比べる
    const core = ck.replace(/(株式会社|合同会社|有限会社|合資会社|合名会社|一般社団法人|llc|ltd|inc|co|corp|limited|pte)/g, '');
    if (core.length >= 3 && (key.includes(core) || core.includes(key))) return false;
  }
  return true;
}

export function computeAutoHints(c: Case, cfg: KeywordsConfig, items: ChecklistItem[]): Record<string, AutoHint[]> {
  const ids = new Set(items.map((i) => i.id));
  const text = [c.rawMessages ?? '', cardText(c.card)].join('\n');
  const out: Record<string, AutoHint[]> = {};
  for (const rule of cfg.rules) {
    if (!ids.has(rule.itemId)) continue;
    const hints = findMatches(text, rule);
    if (hints.length) out[rule.itemId] = [...(out[rule.itemId] ?? []), ...hints];
  }
  // 7-2：暗号資産のアドレスが案件カードにある
  const cryptoItem = cfg.rules.find((r) => r.itemId === '7-2');
  if (cryptoItem && ids.has(cryptoItem.itemId) && (c.card.payee?.cryptoAddresses?.length ?? 0) > 0) {
    const hasOther = !isBlank(c.card.payee?.bank) || !isBlank(c.card.payee?.accountName);
    out[cryptoItem.itemId] = [
      ...(out[cryptoItem.itemId] ?? []),
      {
        suggest: 'red',
        quote: c.card.payee!.cryptoAddresses.join(' / '),
        note: hasOther ? '暗号資産のほかに銀行口座もあるので要確認（暗号資産だけのときは赤）' : '払い方が暗号資産だけなら赤',
      },
    ];
  }
  // 9-3：有名人・有名企業の名前が「ある」
  const cel = cfg.celebrityRule;
  if (ids.has(cel.itemId) && !looksLikeNone(c.card.celebrities)) {
    out[cel.itemId] = [...(out[cel.itemId] ?? []), { suggest: cel.suggest, quote: c.card.celebrities!.trim(), note: '本人の公式の場で確かめられなければ赤' }];
  }
  // 7-1：振込先の名義が会社名と一致しない
  const pay = cfg.payeeRule;
  if (ids.has(pay.itemId) && payeeLooksPersonal(c.card, pay.corporateMarkers)) {
    out[pay.itemId] = [
      ...(out[pay.itemId] ?? []),
      { suggest: pay.suggest, quote: `振込先の名義：${c.card.payee!.accountName}`, note: '名義は会社名と同じですか？ 違えば赤（個人名義、会社名と違う名義）' },
    ];
  }
  // 重複する引用を落とす
  for (const k of Object.keys(out)) {
    const seen = new Set<string>();
    out[k] = out[k].filter((h) => {
      const key = `${h.suggest}:${h.quote}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return out;
}

/** 案件に候補を書き込む。変わったときだけ true */
export function applyAutoHints(c: Case, hints: Record<string, AutoHint[]>, items: ChecklistItem[]): boolean {
  let changed = false;
  for (const it of items) {
    const next = hints[it.id] ?? [];
    const cur: ItemResult = c.items[it.id] ?? emptyItemResult();
    const prev = cur.autoHints ?? [];
    const same = prev.length === next.length && prev.every((p, i) => p.quote === next[i].quote && p.suggest === next[i].suggest);
    if (same) continue;
    c.items[it.id] = { ...cur, autoHints: next };
    changed = true;
  }
  return changed;
}
