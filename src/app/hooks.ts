import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { AppSettings, Case, ChecklistItem } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { getActiveItems, rules } from '../data/checklist';
import type { VerdictContext } from '../logic/verdict';
import type { RegistryData } from '../logic/registry';

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(async () => {
    const row = await db.settings.get('app');
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<AppSettings>) ?? {}) };
  }, []);
}

export function useCases(): Case[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.cases.toArray();
    return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, []);
}

export function activeItemsFor(settings: AppSettings | undefined): ChecklistItem[] {
  return getActiveItems(settings?.enabledOptionalItems ?? []);
}

export function ctxFor(c: Case, settings: AppSettings | undefined): VerdictContext {
  return { items: activeItemsFor(settings), previousNames: c.previousNames, rules };
}

/** Blob の表示用URL（使い終わったら解放） */
export function useBlobUrl(id: string | undefined): { url?: string; name?: string } {
  const row = useLiveQuery(async () => (id ? await db.blobs.get(id) : undefined), [id]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!row) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(row.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [row]);
  return { url, name: row?.name };
}

export function useOnline(): boolean {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}

let registryCache: Promise<RegistryData | null> | undefined;
/** 金融庁の一覧の写し（公開時と週1回に取り込んだもの）。なければ null */
export function loadRegistry(): Promise<RegistryData | null> {
  if (!registryCache) {
    registryCache = fetch(`${import.meta.env.BASE_URL}data/fsa.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RegistryData>) : null))
      .catch(() => null);
  }
  return registryCache;
}
export function useRegistry(): RegistryData | null | undefined {
  const [d, setD] = useState<RegistryData | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadRegistry().then((x) => alive && setD(x));
    return () => {
      alive = false;
    };
  }, []);
  return d;
}
