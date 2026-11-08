import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findForbidden } from '../logic/forbidden';
import { buildCardPrompt, buildResearchPrompt, buildReviewPrompt } from '../logic/prompts';
import { links } from '../data/config';
import { getActiveItems } from '../data/checklist';
import demo from '../../demo/gold-ai-plan.json';
import type { Case } from '../types';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'test') continue;
      walk(p, out);
    } else if (/\.(tsx?|json|md|html|css)$/.test(name) && !name.endsWith('forbidden.ts')) out.push(p);
  }
  return out;
}

describe('12.8 断定する文言がない', () => {
  it('画面の文言・設定・依頼文・デモデータに「詐欺だ」と断定する言葉が出ない', () => {
    const root = process.cwd();
    const files = [...walk(join(root, 'src')), ...walk(join(root, 'config')), ...walk(join(root, 'prompts')), ...walk(join(root, 'demo')), join(root, 'index.html')];
    const bad: string[] = [];
    for (const f of files) {
      const hits = findForbidden(readFileSync(f, 'utf8'));
      for (const h of hits) bad.push(`${f}: 「${h.match}」（${h.why}）`);
    }
    expect(bad).toEqual([]);
  });
  it('依頼文にも出ない', () => {
    const c = demo as unknown as Case;
    const items = getActiveItems();
    for (const t of [buildCardPrompt(c), buildResearchPrompt(c, items, links), buildReviewPrompt(c, items)]) expect(findForbidden(t)).toEqual([]);
  });
  it('検査そのものが動く', () => {
    expect(findForbidden('この会社は詐欺です').length).toBe(1);
    expect(findForbidden('金融庁 詐欺的な投資勧誘等にご注意ください').length).toBe(0);
    expect(findForbidden('"架空太郎" 詐欺').length).toBe(0);
  });
});
