// 金融庁の一覧（取り込んだ写し）と、入れた名前・電話番号・登録番号を照合する。
// これは「参考」。写しは古いことがあり、名前をかたる「なりすまし」もあるので、本物の一覧での確認は別に要る。
import { digitsOnly, normalizeKey } from './util';

export interface RegisteredEntry {
  s: string; // 'kinsho'（金融商品取引業者）| 'crypto'（暗号資産交換業者）
  no: string;
  name: string;
  corp?: string;
  addr?: string;
  tel?: string;
  date?: string;
  types: string[];
}
export interface WarnedEntry {
  name: string;
  what?: string;
  note?: string;
  when?: string;
  where?: string;
}
export interface RegistryData {
  fetchedAt: string;
  sources: { key: string; name: string; url: string; kind: string; ok: boolean; count: number; error?: string }[];
  registered: RegisteredEntry[];
  warned: WarnedEntry[];
}

const CORP_WORDS = /(株式会社|合同会社|有限会社|合資会社|合名会社|一般社団法人|一般財団法人|\(株\)|㈱|\(同\)|llc|ltd|limited|inc|corporation|corp|co)/g;

/** 比べるための名前：全角半角・空白・記号をそろえ、「株式会社」などを外す */
export function coreName(s: string): string {
  return normalizeKey(s).replace(CORP_WORDS, '');
}

/** 文章の中の登録番号（例：関東財務局長（金商）第1234号）を拾う */
export function findRegistrationNos(text: string): string[] {
  const t = text.normalize('NFKC');
  const out = new Set<string>();
  for (const m of t.matchAll(/([一-鿿]{2,8}(?:財務局長|財務支局長|総合事務局長))\s*(?:\(\s*金商\s*\))?\s*第\s*(\d{1,6})\s*号/g)) out.add(`${m[1]}第${Number(m[2])}号`);
  return [...out];
}

function noKey(no: string): string {
  const t = no.normalize('NFKC').replace(/\s/g, '');
  const m = /([一-鿿]{2,8}(?:財務局長|財務支局長|総合事務局長))(?:\(金商\))?第(\d{1,6})号/.exec(t);
  return m ? `${m[1]}第${Number(m[2])}号` : t;
}

export interface RegistryLookup {
  available: boolean;
  fetchedAt?: string;
  names: string[];
  registered: RegisteredEntry[]; // 名前か電話が一致した登録業者
  warned: WarnedEntry[]; // 名前が警告の一覧にある
  numberOwners: { no: string; owner?: RegisteredEntry; matchesName: boolean }[]; // 文章に出てきた登録番号の持ち主
  notFoundNames: string[]; // 登録の一覧に見つからなかった名前
  level: 'red' | 'yellow' | 'info' | 'none';
}

export function lookupRegistry(data: RegistryData | undefined, input: { names: string[]; phones: string[]; text: string }): RegistryLookup {
  const names = input.names.filter((n) => coreName(n).length >= 2);
  const base: RegistryLookup = { available: !!data && data.registered.length > 0, fetchedAt: data?.fetchedAt, names, registered: [], warned: [], numberOwners: [], notFoundNames: [], level: 'none' };
  if (!data || !base.available) return base;
  const regKeys = data.registered.map((e) => ({ e, key: coreName(e.name), tel: digitsOnly(e.tel ?? '') }));
  const seen = new Set<RegisteredEntry>();
  for (const n of names) {
    const k = coreName(n);
    const hits = regKeys.filter((r) => r.key && (r.key.includes(k) || (r.key.length >= 3 && k.includes(r.key))));
    if (!hits.length) base.notFoundNames.push(n);
    for (const h of hits) if (!seen.has(h.e)) (seen.add(h.e), base.registered.push(h.e));
  }
  for (const p of input.phones) {
    const d = digitsOnly(p);
    if (d.length < 9) continue;
    for (const r of regKeys) if (r.tel && r.tel === d && !seen.has(r.e)) (seen.add(r.e), base.registered.push(r.e));
  }
  for (const n of names) {
    const k = coreName(n);
    if (k.length < 3) continue;
    for (const w of data.warned) if (coreName(w.name).includes(k) && !base.warned.includes(w)) base.warned.push(w);
  }
  const nameKeys = names.map(coreName);
  for (const no of findRegistrationNos(input.text)) {
    const owner = data.registered.find((e) => noKey(e.no) === no);
    const ok = !!owner && nameKeys.some((k) => coreName(owner.name).includes(k) || k.includes(coreName(owner.name)));
    base.numberOwners.push({ no, owner, matchesName: ok });
  }
  base.registered = base.registered.slice(0, 12);
  base.warned = base.warned.slice(0, 12);
  const badNumber = base.numberOwners.some((x) => !x.owner || (names.length > 0 && !x.matchesName));
  base.level = base.warned.length || badNumber ? 'red' : base.notFoundNames.length ? 'yellow' : base.registered.length ? 'info' : 'none';
  return base;
}

export const SOURCE_LABEL: Record<string, string> = { kinsho: '金融商品取引業者', crypto: '暗号資産交換業者' };
