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

/** 一覧のExcelを「登録番号・名前・住所・電話・業務の種別」に読み分ける。列の位置は見出しの行から決める */
function entriesFromXlsx(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const out = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' }).map((r) => r.map(clean));
    const hi = rows.findIndex((r) => r.some((c) => /登録番号/.test(c)) && r.some((c) => /(業者名|商号|名称)/.test(c)));
    if (hi < 0) continue;
    const head = rows[hi];
    const next = rows[hi + 1] ?? [];
    const sub = next.some((c) => /第\s*[0-9０-９]+\s*号/.test(c)) ? [] : next; // 見出しが2段のときだけ使う
    const col = (re) => head.findIndex((c) => re.test(c));
    const cNo = col(/登録番号/);
    const cName = col(/(業者名|商号|名称)/);
    const cCorp = col(/法人番号/);
    const cAddr = col(/(所在地|住所)/);
    const cTel = col(/電話/);
    const cDate = col(/登録年月日/);
    const known = new Set([cNo, cName, cCorp, cAddr, cTel, cDate, col(/郵便番号/), col(/所管/)]);
    // 業務の種別の列：見出し（2段のこともある）に名前があり、上のどれでもない列
    const typeCols = [];
    const width = Math.max(head.length, sub.length);
    for (let i = 0; i < width; i += 1) {
      if (known.has(i)) continue;
      const label = clean(`${head[i] ?? ''}${sub[i] ? ` ${sub[i]}` : ''}`);
      if (label && label.length <= 30 && !/(備考|加入協会|取扱|合計|ホームページ|URL)/.test(label)) typeCols.push({ i, label: label.replace(/\s+/g, '') });
    }
    for (const r of rows.slice(hi + 1)) {
      const no = r[cNo] ?? '';
      if (!/第\s*[0-9０-９]+\s*号/.test(no)) continue;
      const name = r[cName] ?? '';
      if (!name) continue;
      out.push({
        no: no.replace(/\s+/g, ''),
        name,
        corp: cCorp >= 0 ? r[cCorp] || undefined : undefined,
        addr: cAddr >= 0 ? r[cAddr] || undefined : undefined,
        tel: cTel >= 0 ? r[cTel] || undefined : undefined,
        date: cDate >= 0 ? r[cDate] || undefined : undefined,
        types: typeCols.filter((t) => /[○〇◯●✓]/.test(r[t.i] ?? '')).map((t) => t.label),
      });
    }
    console.log(`     シート「${sheetName}」見出し: 番号=${cNo} 名前=${cName} 住所=${cAddr} 電話=${cTel} 種別の列=${typeCols.map((t) => t.label).join('|')}`);
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

const looksHeader = (cells) => cells.every((c) => c.length <= 12) && cells.some((c) => /(商号|名称|登録番号|所在地|業者名|代表者|掲載)/.test(c));

const result = { fetchedAt: new Date().toISOString(), sources: [], registered: [], warned: [] };
for (const s of cfg.sources) {
  const info = { key: s.key, name: s.name, url: s.url, kind: s.kind, ok: false, count: 0 };
  try {
    const buf = await load(process.env[`FSA_${s.key.toUpperCase()}`] ?? s.url);
    if (s.format === 'xlsx') {
      const entries = entriesFromXlsx(buf);
      for (const e of entries) result.registered.push({ s: s.key, ...e });
      info.count = entries.length;
      for (const e of entries.slice(0, 3)) console.log('     例:', JSON.stringify(e));
      const withTypes = entries.filter((e) => e.types.length).length;
      console.log(`     種別つき ${withTypes} 件／電話つき ${entries.filter((e) => e.tel).length} 件`);
    } else {
      const rows = rowsFromHtml(buf).rows.filter((c) => !looksHeader(c));
      for (const c of rows) result.warned.push({ name: c[0], what: c[1], note: c.length >= 5 ? c[2] : undefined, when: c.length >= 5 ? c[3] : c[2], where: c.length >= 5 ? c[4] : c[3] });
      info.count = rows.length;
      for (const r of rows.slice(0, 2)) console.log('     例:', JSON.stringify(r).slice(0, 300));
      const by = {};
      for (const r of rows) by[r.length] = (by[r.length] ?? 0) + 1;
      console.log('     列の数ごとの行数:', JSON.stringify(by));
    }
    info.ok = info.count > 0;
    console.log(`OK  ${s.key}: ${info.count} 件`);
  } catch (e) {
    info.error = String(e.message ?? e);
    console.log(`NG  ${s.key}: ${info.error}`);
  }
  result.sources.push(info);
}
for (const t of cfg.selfTest ?? []) {
  const hit = result.registered.filter((e) => e.name.replace(/\s/g, '').toLowerCase().includes(t.toLowerCase()));
  console.log(`確認「${t}」: ${hit.length} 件 ${hit.slice(0, 2).map((e) => JSON.stringify(e)).join(' ')}`);
}
mkdirSync(join(root, 'public/data'), { recursive: true });
writeFileSync(join(root, 'public/data/fsa.json'), JSON.stringify(result));
console.log(`登録 ${result.registered.length} 件／警告 ${result.warned.length} 件を public/data/fsa.json に書きました`);
