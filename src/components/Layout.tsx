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
      <header className="daiji sticky top-0 z-20">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <NavLink to="/" className="mincho whitespace-nowrap text-base font-extrabold tracking-[0.12em] sm:text-lg sm:tracking-[0.2em]">
            <span className="mr-2 hidden border border-paper-2 px-1 align-middle text-[0.65rem] tracking-widest sm:inline-block">点検票</span>
            うまい話チェック
          </NavLink>
          <nav className="mincho flex shrink-0 items-center gap-0.5 text-sm" aria-label="メニュー">
            {[
              ['/', 'ホーム'],
              ['/guides', '手引き'],
              ['/settings', '設定'],
            ].map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `whitespace-nowrap px-1.5 py-1 sm:px-2 ${isActive ? 'bg-paper-2 text-ink font-bold' : 'underline-offset-4 hover:underline'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        {!online && <div className="bg-ocher-bg px-4 py-1 text-center text-xs text-ink">オフラインです。入力・保存・判定の1枚の表示はできます。外のサイトは開けません。</div>}
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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.7rem] tracking-widest text-ink-3">件名</div>
          <h1 className="h2 truncate">{caseTitle(v.c)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <OverallBadge o={v.overall} />
          <span className="text-[0.7rem] text-ink-3">{v.saving ? '保存中…' : '自動保存'}</span>
        </div>
      </div>
      <nav className="tabs -mx-4 overflow-x-auto px-4 pb-1" aria-label="進み具合（検印欄）">
        <div className="kenin min-w-max">
          {STEPS.map((s) => (
            <NavLink key={s.key} to={`/case/${id}/${s.path}`} className="kenin-cell" title={s.label} aria-current={undefined}>
              {({ isActive }) => (
                <>
                  <span className="kenin-head" style={isActive ? { background: 'var(--color-ink)', color: 'var(--color-paper-2)' } : undefined}>
                    {s.short}
                  </span>
                  <span className="kenin-body" style={isActive ? { boxShadow: 'inset 0 0 0 2px var(--color-shu)' } : undefined}>
                    {st[s.key] === 'done' ? (
                      <span className="seal seal-md text-shu">済</span>
                    ) : st[s.key] === 'partial' ? (
                      <span className="seal seal-md text-ocher">中</span>
                    ) : (
                      <span className="text-xs text-ink-3">　</span>
                    )}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3 border-b-[3px] border-double border-ink pb-2">
      <h1 className="h1 dai">{title}</h1>
      {sub ? <p className="mt-1 text-sm text-ink-2">{sub}</p> : null}
    </div>
  );
}
