import { NavLink, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useCaseCtx } from '../app/CaseContext';
import { caseTitle } from '../logic/crossref';
import { OverallBadge } from './ui';
import { useOnline } from '../app/hooks';

export function Shell({ children }: { children: ReactNode }) {
  const online = useOnline();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-navy-dark bg-navy text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <NavLink to="/" className="text-lg font-extrabold tracking-wide">
            うまい話チェック
          </NavLink>
          <nav className="flex items-center gap-1 text-sm" aria-label="メニュー">
            {[
              ['/', 'ホーム'],
              ['/guides', '手引き'],
              ['/settings', '設定'],
            ].map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `rounded-md px-2 py-1 ${isActive ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        {!online && <div className="bg-amber-200 px-4 py-1 text-center text-xs text-amber-950">オフラインです。入力・保存・判定の1枚の表示はできます。外のサイトは開けません。</div>}
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-4 pb-24">{children}</main>
    </div>
  );
}

export const STEPS: { key: string; label: string; short: string; path: string }[] = [
  { key: 'card', label: 'ステップ1 案件カード', short: '1 案件カード', path: 'card' },
  { key: 'research', label: 'ステップ2 AI下調べ', short: '2 AI下調べ', path: 'research' },
  { key: 'check', label: 'ステップ3〜5 チェック表', short: '3-5 チェック表', path: 'check' },
  { key: 'review', label: 'ステップ6 見落としチェック', short: '6 見落とし', path: 'review' },
  { key: 'sheet', label: 'ステップ7 判定の1枚', short: '7 判定の1枚', path: 'sheet' },
  { key: 'next', label: 'ステップ8 このあとどうするか', short: '8 このあと', path: 'next' },
];

export function stepStatus(v: ReturnType<typeof useCaseCtx>): Record<string, 'done' | 'partial' | 'todo'> {
  const { c, counts, items } = v;
  const decided = items.length - counts.unchecked;
  return {
    card: c.card.caseName || c.card.companyNames.length || c.rawMessages ? 'done' : 'todo',
    research: c.aiResearchRaw || c.researchStatus === 'skipped' ? 'done' : 'todo',
    check: counts.unchecked === 0 || c.stoppedEarly ? 'done' : decided > 0 ? 'partial' : 'todo',
    review: c.review.status !== 'pending' ? 'done' : 'todo',
    sheet: c.snapshots.length > 0 ? 'done' : 'todo',
    next: c.snapshots.length > 0 ? 'done' : 'todo',
  };
}

export function StepBar() {
  const v = useCaseCtx();
  const { id } = useParams();
  const st = stepStatus(v);
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-gray-600">案件</div>
          <h1 className="h2 truncate">{caseTitle(v.c)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <OverallBadge o={v.overall} />
          {v.saving ? <span className="text-xs text-gray-500">保存中…</span> : <span className="text-xs text-gray-500">自動保存</span>}
        </div>
      </div>
      <nav className="tabs -mx-4 flex gap-1 overflow-x-auto px-4 pb-1" aria-label="進み具合">
        {STEPS.map((s) => (
          <NavLink
            key={s.key}
            to={`/case/${id}/${s.path}`}
            className={({ isActive }) =>
              `shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${isActive ? 'border-navy bg-navy text-white' : st[s.key] === 'done' ? 'border-green-700 bg-green-50 text-green-900' : st[s.key] === 'partial' ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-gray-400 bg-white text-gray-800'}`
            }
            title={s.label}
          >
            {st[s.key] === 'done' ? '✓ ' : ''}
            {s.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <h1 className="h1">{title}</h1>
      {sub ? <p className="mt-1 text-sm text-gray-700">{sub}</p> : null}
    </div>
  );
}
