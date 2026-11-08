import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import demo from '../../demo/gold-ai-plan.json';
import type { Case } from '../types';
import { makeCtx } from './helpers';
import { buildCaseZip, checklistCsv, importPayload, readImportFile, zipFileName } from '../app/exportImport';
import { addBlob, deleteAll, getBlobsOfCase, getCase, listCases, saveCase, saveSettings, getSettings } from '../app/store';

const ctx = makeCtx((demo as unknown as Case).previousNames);

describe('12.7 書き出したZIPを全削除後に読み込むと同じ内容に戻る', () => {
  it('roundtrip', async () => {
    const c = structuredClone(demo) as unknown as Case;
    await saveCase(c);
    const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 1])], { type: 'image/png' });
    const b = await addBlob(c.id, '1-1', png, 'fsa.png');
    c.items['1-1'].screenshots = [b.id];
    await saveCase(c);
    await saveSettings({ consentedAt: '2026-10-15T00:00:00Z' });

    const { blob, fileName } = await buildCaseZip(c, ctx);
    expect(fileName).toBe(zipFileName(c));
    expect(fileName).toMatch(/^ゴールドAIプラン_\d{4}-\d{2}-\d{2}\.zip$/);
    const zip = await JSZip.loadAsync(blob);
    const names = Object.keys(zip.files);
    expect(names).toContain('case.json');
    expect(names).toContain('判定の1枚.html');
    expect(names).toContain('チェック表.csv');
    expect(names).toContain('urls.txt');
    expect(names).toContain('evidence/1-1_01.png');
    expect(names).toContain('evidence/index.json');

    await deleteAll();
    expect(await listCases()).toEqual([]);
    expect(await getBlobsOfCase(c.id)).toEqual([]);
    expect((await getSettings()).consentedAt).toBe('2026-10-15T00:00:00Z');

    const payloads = await readImportFile(blob, fileName);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].warnings).toEqual([]);
    await importPayload(payloads[0]);
    const back = await getCase(c.id);
    expect(back).toEqual(c);
    const blobs = await getBlobsOfCase(c.id);
    expect(blobs).toHaveLength(1);
    expect(blobs[0].id).toBe(b.id);
    expect(blobs[0].blob.size).toBe(12);
  });
  it('case.json だけでも読み込める（スクリーンショットは外して警告）', async () => {
    const c = structuredClone(demo) as unknown as Case;
    c.items['1-1'].screenshots = ['missing-blob'];
    const file = new Blob([JSON.stringify(c)], { type: 'application/json' });
    const [p] = await readImportFile(file, 'case.json');
    expect(p.c.items['1-1'].screenshots).toEqual([]);
    expect(p.warnings[0]).toContain('スクリーンショット 1 件');
  });
  it('壊れたファイルはエラーになる', async () => {
    await expect(readImportFile(new Blob(['{{'], { type: 'application/json' }), 'x.json')).rejects.toThrow();
    await expect(readImportFile(new Blob(['{"a":1}'], { type: 'application/json' }), 'x.json')).rejects.toThrow('案件ファイル');
  });
  it('CSVに41行＋見出しが入る', () => {
    const csv = checklistCsv(demo as unknown as Case, ctx.items);
    expect(csv.split('\n').filter(Boolean)).toHaveLength(42);
  });
});
