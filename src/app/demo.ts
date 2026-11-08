// デモ案件（原本の通しの例）を読み込む。自動の気づきは読み込み時に計算して付ける
import demo from '../../demo/gold-ai-plan.json';
import type { AppSettings, Case } from '../types';
import { importPayload, normalizeCase } from './exportImport';
import { keywords } from '../data/config';
import { activeItemsFor } from './hooks';
import { applyAutoHints, computeAutoHints } from '../logic/hints';

export const DEMO_CASE_ID = (demo as { id: string }).id;

export async function loadDemoCase(settings: AppSettings | undefined): Promise<string> {
  const c = normalizeCase(structuredClone(demo) as unknown as Case);
  const items = activeItemsFor(settings);
  applyAutoHints(c, computeAutoHints(c, keywords, items), items);
  await importPayload({ c, blobs: [], warnings: [] });
  return c.id;
}
