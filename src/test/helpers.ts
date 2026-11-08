import { getActiveItems, rules } from '../data/checklist';
import type { VerdictContext } from '../logic/verdict';
import type { Case, ItemResult, Verdict } from '../types';
import { emptyItemResult, newCase } from '../types';

export const NOW = '2026-10-15T10:00:00+09:00';

export function makeCtx(previousNames: string[] = [], enabledOptional: string[] = []): VerdictContext {
  return { items: getActiveItems(enabledOptional), previousNames, rules };
}

export function res(verdict: Verdict, patch: Partial<ItemResult> = {}): ItemResult {
  return { ...emptyItemResult(), verdict, ...patch };
}

/** 全項目を青（証拠つき・自分で確認）にした案件。テストの土台 */
export function allBlueCase(ctx: VerdictContext): Case {
  const c = newCase('t1', NOW);
  for (const it of ctx.items) {
    c.items[it.id] = res('blue', { checkedBy: 'self', urls: [{ url: 'https://example.com/list', viewedAt: NOW }] });
  }
  c.review = { status: 'done', flaggedCategories: [], findings: [] };
  return c;
}
