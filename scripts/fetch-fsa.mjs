#!/usr/bin/env node
// 金融庁の「登録を受けている業者の一覧」と「無登録業者への警告の一覧」を取り込み、public/data/fsa.json にする。
// GitHub Actions（公開のたび＋週1回）で動かす。アプリはこれを端末の中で照合する（参考表示。本物の一覧での確認は別に必要）。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const XLSX = createRequire(import.meta.url)('xlsx');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'config/registry-sources.json'), 'utf8'));
const UA = 'Mozilla/5.0 (compatible; umai-hanashi-check registry fetch)';

async function load(url) {
  if (!/^https?:/.test(url)) return readFileSync(url); // テスト用：ローカルのファイル
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'ja' }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const clean = (v) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

function rowsFromXlsx(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const out = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
    for (const r of rows) {
      const cells = r.map(clean).filter(Boolean);
      if (cells.length >= 3) out.push(cells);
    }
  }
  return out;
}

function decodeHtml(buf) {
  const head = buf.subarray(0, 2048).toString('latin1');
  const m = /charset=["']?([\w-]+)/i.exec(head);
  const cs = (m?.[1] ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(cs === 'shift_jis' || cs === 'sjis' || cs === 'x-sjis' ? 'shift_jis' : cs).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const strip = (s) => clean(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (x) => ENT[x] ?? x));

function rowsFromHtml(buf) {
  const html = decodeHtml(buf);
  const out = [];
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(strip).filter(Boolean);
    if (cells.length >= 2) out.push(cells);
  }
  return { rows: out, links: [...html.matchAll(/href="([^"]+\.(?:html|xlsx|xls|csv))"/gi)].map((m) => m[1]) };
}

// 見出しの行らしいものを落とす
const looksHeader = (cells) => cells.every((c) => c.length <= 12) && cells.some((c) => /(商号|名称|登録番号|所在地|業者名|代表者|掲載)/.test(c));

const result = { fetchedAt: new Date().toISOString(), sources: [], registered: [], warned: [] };
for (const s of cfg.sources) {
  const info = { key: s.key, name: s.name, url: s.url, kind: s.kind, ok: false, count: 0 };
  try {
    const buf = await load(process.env[`FSA_${s.key.toUpperCase()}`] ?? s.url);
    let rows;
    if (s.format === 'xlsx') rows = rowsFromXlsx(buf);
    else {
      const r = rowsFromHtml(buf);
      rows = r.rows;
      info.links = r.links.length;
    }
    rows = rows.filter((c) => !looksHeader(c));
    for (const cells of rows) result[s.kind].push({ s: s.key, c: cells.slice(0, 8).map((x) => x.slice(0, 160)) });
    info.ok = rows.length > 0;
    info.count = rows.length;
    console.log(`OK  ${s.key}: ${rows.length} 行`);
    for (const r of rows.slice(0, 3)) console.log('     例:', JSON.stringify(r.slice(0, 6)));
    const longest = Math.max(0, ...rows.map((r) => r.length));
    console.log(`     列の最大数: ${longest}`);
  } catch (e) {
    info.error = String(e.message ?? e);
    console.log(`NG  ${s.key}: ${info.error}`);
  }
  result.sources.push(info);
}
mkdirSync(join(root, 'public/data'), { recursive: true });
writeFileSync(join(root, 'public/data/fsa.json'), JSON.stringify(result));
console.log(`登録 ${result.registered.length} 行／警告 ${result.warned.length} 行を public/data/fsa.json に書きました`);
