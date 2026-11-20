import { describe, expect, it } from 'vitest';
import { buildPayload, COLLECT_URL_RE } from '../logic/collect';
import { buildSimpleReport } from '../logic/simple';
import { quickCheck } from '../logic/quick';
import { keywords } from '../data/config';
import { getActiveItems } from '../data/checklist';
import { NOW } from './helpers';

const items = getActiveItems();
const data = { fetchedAt: NOW, sources: [], registered: [{ s: 'kinsho', no: '関東財務局長(金商)第2086号', name: '株式会社チャートマスター', types: ['投資助言・代理業'] }], warned: [], pages: [] };

describe('利用者の結果を送る', () => {
  it('送るのは調べた言葉と結果と答えだけ。貼った文章は送らない', () => {
    const text = '山田花子です。090-1111-2222。月利5%、元本保証';
    const r = quickCheck({ text, query: '株式会社チャートマスター' }, [], keywords, items, NOW, data);
    const rep = buildSimpleReport(r, 'manage');
    const p = buildPayload('run1', NOW, '株式会社チャートマスター', r, rep, 'manage', ['ea'], { ea: { martin: 'yes', price: 'low' } });
    const all = JSON.stringify(p);
    expect(all).not.toContain('山田花子');
    expect(all).not.toContain('090-1111-2222');
    expect(p.query).toBe('株式会社チャートマスター');
    expect(p.overall).toBe('あぶない');
    expect(p.doing).toBe('あぶない');
    expect(p.activity).toBe('お金を預かる');
    expect(p.topics).toBe('EA（自動売買）');
    expect(p.topicReds).toContain('ナンピン');
    expect(p.topicReds).not.toContain('10万円より安い');
    expect(p.registered).toContain('第2086号');
    expect(p.hits).toContain('もうかる約束');
  });
  it('送り先は Google Apps Script のウェブアプリのURLだけ', () => {
    expect(COLLECT_URL_RE.test('https://script.google.com/macros/s/AKfycbx_abc-123/exec')).toBe(true);
    expect(COLLECT_URL_RE.test('https://evil.example/exec')).toBe(false);
    expect(COLLECT_URL_RE.test('')).toBe(false);
  });
});
