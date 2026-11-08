#!/usr/bin/env node
// 仕様書 8.5：config/links.json と config/contacts.json のURLが開くかを確かめる（ネットにつながる環境で人が実行する）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const links = JSON.parse(readFileSync(join(root, 'config/links.json'), 'utf8'));
const contacts = JSON.parse(readFileSync(join(root, 'config/contacts.json'), 'utf8'));
const targets = [
  ...links.links.map((l) => ({ key: l.key, name: l.name, url: l.url })),
  ...contacts.lawyer.links.map((l) => ({ key: 'lawyer', name: l.name, url: l.url })),
];

async function probe(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  const headers = { 'user-agent': 'umai-hanashi-check link checker' };
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctl.signal, headers });
    if (res.status === 405 || res.status === 403 || res.status === 404) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctl.signal, headers });
    }
    return { ok: res.ok, status: res.status, finalUrl: res.url };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(t);
  }
}

let bad = 0;
console.log(`基準日 ${links.asOf}：${targets.length} 件を確かめます\n`);
for (const t of targets) {
  const r = await probe(t.url);
  if (!r.ok) bad += 1;
  console.log(`${r.ok ? 'OK ' : 'NG '} ${String(r.status).padStart(3)}  ${t.key.padEnd(20)} ${t.url}${r.finalUrl && r.finalUrl !== t.url ? `\n        → ${r.finalUrl}` : ''}${r.error ? `  (${r.error})` : ''}`);
}
console.log(`\n${bad === 0 ? 'すべて開けました。' : `${bad} 件が開けません。config/links.json を直してください。`}`);
process.exit(bad === 0 ? 0 : 1);
