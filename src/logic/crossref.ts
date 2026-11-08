// 過去の案件との照合（S0の横断検索、S1保存時の知らせ）
import type { Case } from '../types';
import { digitsOnly, domainOf, isBlank, normalizeKey } from './util';

export interface CaseKey {
  field: string; // 表示名
  value: string; // 元の値
  norm: string; // 比べるための値
}

export function extractKeys(c: Case): CaseKey[] {
  const out: CaseKey[] = [];
  const push = (field: string, value?: string, norm?: string) => {
    if (isBlank(value)) return;
    const n = norm ?? normalizeKey(value!);
    if (n.length < 2) return;
    out.push({ field, value: value!.trim(), norm: n });
  };
  const k = c.card;
  push('案件名', k.caseName);
  for (const n of k.companyNames) push('会社名', n);
  for (const n of c.previousNames) push('会社の前の名前', n);
  push('代表者', k.representative);
  push('紹介者', k.introducer?.name);
  for (const n of k.introducer?.snsNames ?? []) push('紹介者のSNS表示名', n);
  push('口座名義', k.payee?.accountName);
  for (const u of k.urls) push('URL', u, domainOf(u) ?? normalizeKey(u));
  push('電話番号', k.companyPhone, digitsOnly(k.companyPhone ?? ''));
  for (const a of k.payee?.cryptoAddresses ?? []) push('暗号資産アドレス', a, a.trim().toLowerCase());
  return out;
}

export interface CrossMatch {
  field: string;
  value: string;
  otherField: string;
  otherValue: string;
  caseId: string;
  caseName: string;
  caseDate: string;
}

export function caseTitle(c: Case): string {
  return c.card.caseName?.trim() || c.card.companyNames[0] || '（名前のない案件）';
}

export function findCrossMatches(target: Case, others: Case[]): CrossMatch[] {
  const mine = extractKeys(target);
  const out: CrossMatch[] = [];
  for (const o of others) {
    if (o.id === target.id) continue;
    const theirs = extractKeys(o);
    for (const a of mine) {
      for (const b of theirs) {
        if (a.norm === b.norm) out.push({ field: a.field, value: a.value, otherField: b.field, otherValue: b.value, caseId: o.id, caseName: caseTitle(o), caseDate: o.createdAt });
      }
    }
  }
  return out;
}

/** 検索の言葉を分ける（空白・読点・カンマ区切り。複数ならすべてを含む記録だけ） */
export function splitQuery(query: string): string[] {
  return query
    .split(/[\s\u3000,、]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 案件名・会社名・人名・SNS表示名・口座名義・URL・電話・暗号資産アドレスで、全案件を横断検索。複数の言葉はすべて含むもの */
export function searchCases(cases: Case[], query: string): { c: Case; hits: CaseKey[] }[] {
  const tokens = splitQuery(query).map((t) => ({ q: normalizeKey(t), qd: digitsOnly(t), raw: t }));
  if (!tokens.length) return [];
  const out: { c: Case; hits: CaseKey[] }[] = [];
  for (const c of cases) {
    const keys = extractKeys(c);
    const hits: CaseKey[] = [];
    let all = true;
    for (const t of tokens) {
      const h = keys.filter((k) => (t.q && k.norm.includes(t.q)) || (t.qd.length >= 4 && k.field === '電話番号' && k.norm.includes(t.qd)));
      if (!h.length) {
        all = false;
        break;
      }
      for (const k of h) if (!hits.includes(k)) hits.push(k);
    }
    if (all && hits.length) out.push({ c, hits });
  }
  return out;
}
