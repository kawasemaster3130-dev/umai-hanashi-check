// S3 ステップ4用：検索の言葉の一覧（原本10行）を案件カードの値で埋める
import type { Case } from '../types';
import { isBlank, domainOf } from './util';
import type { LinkDef } from '../data/config';

export interface SearchLine {
  label: string; // 何の行か
  query: string; // そのまま検索欄に入れる言葉
  itemIds: string[]; // 関係する項目
}

export function buildSearchLines(c: Case): SearchLine[] {
  const out: SearchLine[] = [];
  const k = c.card;
  const q = (s: string) => `"${s.trim()}"`;
  if (!isBlank(k.representative)) {
    for (const w of ['詐欺', '被害', '返金', '出金できない']) out.push({ label: '代表者の名前', query: `${q(k.representative!)} ${w}`, itemIds: ['5-1', '5-2'] });
  }
  for (const name of k.companyNames.filter((n) => !isBlank(n))) {
    for (const w of ['被害者の会', '弁護団']) out.push({ label: '会社の名前', query: `${q(name)} ${w}`, itemIds: ['5-4'] });
  }
  for (const prev of c.previousNames.filter((n) => !isBlank(n))) out.push({ label: '会社の前の名前', query: `${q(prev)} 詐欺`, itemIds: ['4-4', '5-2'] });
  if (!isBlank(k.caseName)) out.push({ label: '案件の名前', query: `${q(k.caseName!)} 出金できない`, itemIds: ['5-4', '7-5'] });
  for (const sns of (k.introducer?.snsNames ?? []).filter((n) => !isBlank(n))) out.push({ label: '紹介者のSNSの表示名', query: `${q(sns)} 投資`, itemIds: ['5-3'] });
  if (!isBlank(k.introducer?.name) && !(k.introducer?.snsNames ?? []).includes(k.introducer!.name!)) {
    out.push({ label: '紹介者の名前', query: `${q(k.introducer!.name!)} 投資`, itemIds: ['5-3'] });
  }
  if (!isBlank(k.payee?.accountName)) out.push({ label: '振込先の口座名義', query: `${q(k.payee!.accountName!)} 詐欺`, itemIds: ['5-1', '7-1'] });
  return out;
}

export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** リンクの template に案件の値を差し込む（Wayback の URL、ドメインなど） */
export function resolveLinkUrl(link: LinkDef, c: Case): { url: string; param?: string }[] {
  if (!link.template) return [{ url: link.url }];
  const outs: { url: string; param?: string }[] = [];
  if (link.template.includes('{{url}}')) {
    for (const u of c.card.urls.filter((x) => !isBlank(x))) outs.push({ url: link.template.replace('{{url}}', u.trim()), param: u.trim() });
  } else if (link.template.includes('{{domain}}')) {
    for (const u of c.card.urls) {
      const d = domainOf(u);
      if (d) outs.push({ url: link.template.replace('{{domain}}', d), param: d });
    }
  } else if (link.template.includes('{{q}}')) {
    const qs = [c.card.companyAddress, ...c.card.companyNames].filter((s): s is string => !isBlank(s));
    for (const s of qs) outs.push({ url: link.template.replace('{{q}}', encodeURIComponent(s)), param: s });
  }
  return outs.length ? outs : [{ url: link.url }];
}

export function domainsOf(c: Case): string[] {
  return c.card.urls.map(domainOf).filter((d): d is string => !!d);
}
