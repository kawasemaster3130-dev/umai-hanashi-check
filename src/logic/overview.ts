// 41項目の早見表：名前・電話・貼った文章から、項目ごとに「自動で分かった／自分で見る／相手の言葉で決まる」を出す
import overviewRaw from '../../config/overview.json';
import type { AiItemResult, AutoHint, Case, ChecklistItem } from '../types';
import { linkByKey } from '../data/config';
import { coreName, type RegistryData, type RegistryLookup } from './registry';
import { applyResearchImport } from './importers';
import { digitsOnly } from './util';

interface OverviewConfig {
  short: Record<string, string>;
  links: Record<string, { linkKey?: string; search?: string; map?: boolean; label: string }>;
  talkCategories: number[];
  talkItems: string[];
  auto: { registered: string; identity: string; types: string; warned: string; corp: string };
  pageMissIsUnknown: string[];
}
export const overviewConfig = overviewRaw as unknown as OverviewConfig;

export type RowKind = 'auto' | 'self' | 'talk';
export interface OverviewRow {
  item: ChecklistItem;
  short: string;
  kind: RowKind;
  suggest?: 'red' | 'yellow' | 'blue';
  reason?: string;
  sourceUrl?: string;
  link?: { label: string; url: string };
  quote?: string;
}

export interface OverviewInput {
  names: string[];
  phones: string[];
  text: string;
  registry: RegistryLookup;
  data?: RegistryData | null;
  hints: Record<string, AutoHint[]>;
}

const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

export function shortQuestion(item: ChecklistItem): string {
  return overviewConfig.short[item.id] ?? item.question;
}

function linkFor(item: ChecklistItem, names: string[], addr?: string): { label: string; url: string } | undefined {
  const def = overviewConfig.links[item.id];
  if (!def) return undefined;
  const name = names.map((n) => `"${n}"`).join(' ');
  if (def.map) {
    const q = addr ?? names[0];
    return q ? { label: def.label, url: `https://www.google.com/maps/search/${encodeURIComponent(q)}` } : undefined;
  }
  if (def.search) return names.length ? { label: def.label, url: g(def.search.replace('{{name}}', name)) } : undefined;
  const l = def.linkKey ? linkByKey(def.linkKey) : undefined;
  return l ? { label: def.label, url: l.url } : undefined;
}

export function buildOverview(items: ChecklistItem[], input: OverviewInput): OverviewRow[] {
  const { names, phones, registry: r, data, hints } = input;
  const A = overviewConfig.auto;
  const src = (key: string) => data?.sources.find((s) => s.key === key)?.url;
  const reg = r.registered[0];
  const cores = names.map(coreName).filter((k) => k.length >= 3);
  return items.map((item) => {
    const row: OverviewRow = { item, short: shortQuestion(item), kind: 'self', link: linkFor(item, names, reg?.addr) };
    const auto = (suggest: 'red' | 'yellow' | 'blue', reason: string, sourceUrl?: string) => Object.assign(row, { kind: 'auto' as const, suggest, reason, sourceUrl });
    const usable = r.available && names.length > 0;

    if (item.id === A.registered && usable) {
      if (reg) auto('blue', `登録の一覧にあります：${reg.name}（${reg.no}）`, src(reg.s));
      else auto('red', `登録の一覧に「${r.notFoundNames.join('」「')}」が見つかりません`, src('kinsho'));
    } else if (item.id === A.identity && r.available) {
      const bad = r.numberOwners.find((x) => !x.owner || (names.length > 0 && !x.matchesName));
      if (bad) auto('red', bad.owner ? `言われた番号 ${bad.no} の持ち主は「${bad.owner.name}」。名乗っている会社と違います` : `言われた番号 ${bad.no} は一覧にありません`, src('kinsho'));
      else if (reg && phones.length) {
        const same = phones.some((p) => digitsOnly(p) === digitsOnly(reg.tel ?? ''));
        auto(same ? 'blue' : 'yellow', same ? `電話番号が一覧と同じです（${reg.tel}）` : `電話番号が一覧と違います。一覧：${reg.tel ?? '記載なし'}`, src(reg.s));
      } else if (reg) auto('yellow', `一覧の住所・電話と見比べてください：${reg.addr ?? ''}${reg.tel ? `　電話 ${reg.tel}` : ''}`, src(reg.s));
    } else if (item.id === A.types && reg) {
      auto('yellow', reg.types.length ? `できる仕事は「${reg.types.join('・')}」。相手のやろうとしていることと合うか見てください` : '一覧に仕事の種類の記載がありません', src(reg.s));
    } else if (item.id === A.warned && usable) {
      if (r.warned.length) auto('red', `警告の一覧に載っています：${r.warned[0].name}（${r.warned[0].when ?? ''}）`, src('warn'));
      else auto('blue', `警告の一覧（${data?.warned.length ?? 0}件）に名前はありません`, src('warn'));
    } else if (item.id === A.corp && reg?.corp) {
      auto('blue', `法人番号 ${reg.corp}（金融庁の一覧より）`, src(reg.s));
    } else if (data && cores.length) {
      const pages = (data.pages ?? []).filter((p) => p.itemId === item.id);
      if (pages.length) {
        const hit = pages.find((p) => {
          const t = coreName(p.text);
          return cores.some((k) => t.includes(k));
        });
        if (hit) auto('red', `「${hit.name}」に名前が出ています`, hit.url);
        else if (!overviewConfig.pageMissIsUnknown.includes(item.id)) auto('blue', `「${pages.map((p) => p.name).join('」「')}」に名前は出ていません`, pages[0].url);
      }
    }

    if (row.kind !== 'auto') {
      const hs = hints[item.id] ?? [];
      if (hs.length) {
        row.kind = 'talk';
        row.suggest = hs.some((h) => h.suggest === 'red') ? 'red' : 'yellow';
        row.quote = hs[0].quote;
        row.reason = '言われたことの中に、この言葉がありました';
      } else if (overviewConfig.talkCategories.includes(item.cat) || overviewConfig.talkItems.includes(item.id)) {
        row.kind = 'talk';
      }
    }
    return row;
  });
}

export function overviewSummary(rows: OverviewRow[]): { auto: number; self: number; talk: number; red: number } {
  return {
    auto: rows.filter((r) => r.kind === 'auto').length,
    self: rows.filter((r) => r.kind === 'self').length,
    talk: rows.filter((r) => r.kind === 'talk').length,
    red: rows.filter((r) => r.suggest === 'red').length,
  };
}

/** 自動で分かった分を、記録に「仮」の判定として入れる（自分で確かめて確定するまで仮のまま） */
export function applyOverviewToCase(c: Case, rows: OverviewRow[], items: ChecklistItem[], now: string): number {
  const results: Record<string, { ai: AiItemResult }> = {};
  for (const r of rows) {
    if (r.kind !== 'auto' || !r.suggest) continue;
    results[r.item.id] = {
      ai: { status: r.suggest === 'blue' ? 'not_found' : 'found', verdict: r.suggest, result: r.reason ?? '', urls: r.sourceUrl ? [r.sourceUrl] : [], warnings: r.item.selfRequired ? ['ここは、本物の一覧を自分の目で見て確かめてください。'] : [], importedAt: now, source: 'app' },
    };
  }
  applyResearchImport(c, { ok: true, results, selfCheck: [], warnings: [], missing: [] }, items, now);
  return Object.keys(results).length;
}
