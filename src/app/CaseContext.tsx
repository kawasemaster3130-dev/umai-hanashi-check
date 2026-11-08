import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, Case, ChecklistItem, Overall, VerdictCounts } from '../types';
import { getCase, saveCase } from './store';
import { ctxFor, useSettings } from './hooks';
import type { VerdictContext } from '../logic/verdict';
import { countVerdicts, overallVerdict } from '../logic/verdict';
import { deepClone, nowIso } from '../logic/util';
import { DEFAULT_SETTINGS } from '../types';

export interface CaseCtxValue {
  c: Case;
  items: ChecklistItem[];
  ctx: VerdictContext;
  settings: AppSettings;
  counts: VerdictCounts;
  overall: Overall;
  update: (fn: (draft: Case) => void) => void;
  flush: () => Promise<void>;
  saving: boolean;
}

const Ctx = createContext<CaseCtxValue | null>(null);

export function useCaseCtx(): CaseCtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('CaseProvider の外で useCaseCtx が呼ばれました');
  return v;
}

export function CaseProvider({ id, children, fallback }: { id: string; children: ReactNode; fallback: (state: 'loading' | 'notfound') => ReactNode }) {
  const settings = useSettings();
  const ref = useRef<Case | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'ready'>('loading');
  const [, force] = useReducer((x: number) => x + 1, 0);
  const timer = useRef<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    ref.current = null;
    setState('loading');
    getCase(id).then((c) => {
      if (!alive) return;
      ref.current = c ?? null;
      setState(c ? 'ready' : 'notfound');
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!ref.current || !dirty.current) return;
    dirty.current = false;
    setSaving(true);
    try {
      await saveCase(ref.current);
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(
    (fn: (draft: Case) => void) => {
      if (!ref.current) return;
      const next = deepClone(ref.current);
      next.updatedAt = nowIso(); // fn の中で上書きできる（確定時に confirmedAt と揃えるため）
      fn(next);
      ref.current = next;
      dirty.current = true;
      force();
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 400);
    },
    [flush],
  );

  // 画面を離れる・隠れるときに必ず保存する（入力のたびに保存。消えない）
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', h);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', h);
      window.removeEventListener('pagehide', flush);
      void flush();
    };
  }, [flush]);

  const c = ref.current;
  const s = settings ?? DEFAULT_SETTINGS;
  const value = useMemo<CaseCtxValue | null>(() => {
    if (!c) return null;
    const ctx = ctxFor(c, s);
    const counts = countVerdicts(ctx.items, c.items);
    return { c, items: ctx.items, ctx, settings: s, counts, overall: overallVerdict(counts), update, flush, saving };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, s, update, flush, saving, c?.updatedAt]);

  if (state !== 'ready' || !value) return <>{fallback(state === 'notfound' ? 'notfound' : 'loading')}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
