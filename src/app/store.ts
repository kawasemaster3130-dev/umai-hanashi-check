// 端末の中だけに保存する（IndexedDB）。サーバーには送らない。
import { db } from './db';
import type { AppSettings, Case, StoredBlob } from '../types';
import { DEFAULT_SETTINGS, newCase } from '../types';
import { nowIso, uuid } from '../logic/util';

export async function listCases(): Promise<Case[]> {
  const all = await db.cases.toArray();
  return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export const getCase = (id: string): Promise<Case | undefined> => db.cases.get(id);

export async function saveCase(c: Case): Promise<void> {
  await db.cases.put(c);
}

export async function createCase(investigator?: string): Promise<Case> {
  const c = newCase(uuid(), nowIso());
  if (investigator) c.investigator = investigator;
  await db.cases.put(c);
  return c;
}

export async function deleteCase(id: string): Promise<void> {
  await db.transaction('rw', db.cases, db.blobs, async () => {
    await db.blobs.where('caseId').equals(id).delete();
    await db.cases.delete(id);
  });
}

export async function deleteAll(): Promise<void> {
  await db.transaction('rw', db.cases, db.blobs, db.settings, async () => {
    await db.cases.clear();
    await db.blobs.clear();
    const s = await db.settings.get('app');
    await db.settings.clear();
    // 同意だけは残す（データの全削除であって、注意の同意の取り消しではない）
    if (s) await db.settings.put({ key: 'app', value: { ...DEFAULT_SETTINGS, consentedAt: (s.value as AppSettings).consentedAt } });
  });
}

export async function addBlob(caseId: string, itemId: string, file: Blob, name: string): Promise<StoredBlob> {
  const row: StoredBlob = { id: uuid(), caseId, itemId, name, type: file.type || 'application/octet-stream', blob: file, createdAt: nowIso() };
  await db.blobs.put(row);
  return row;
}

export async function putBlobRow(row: StoredBlob): Promise<void> {
  await db.blobs.put(row);
}

export const getBlob = (id: string): Promise<StoredBlob | undefined> => db.blobs.get(id);
export const getBlobsOfCase = (caseId: string): Promise<StoredBlob[]> => db.blobs.where('caseId').equals(caseId).toArray();
export const deleteBlob = (id: string): Promise<void> => db.blobs.delete(id);

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<AppSettings>) ?? {}) };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await db.settings.put({ key: 'app', value: next });
  return next;
}
