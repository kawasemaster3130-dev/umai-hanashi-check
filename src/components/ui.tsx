import { useEffect, useState, type ReactNode } from 'react';
import type { Overall, Verdict, VerdictCounts } from '../types';
import { VERDICT_ICON, VERDICT_LABEL } from '../types';

export const VERDICT_CLASS: Record<Verdict, string> = {
  red: 'bg-v-red-bg text-v-red border-v-red',
  yellow: 'bg-v-yellow-bg text-v-yellow border-v-yellow',
  blue: 'bg-v-blue-bg text-v-blue border-v-blue',
  na: 'bg-v-na-bg text-v-na border-v-na',
  unchecked: 'bg-v-unchecked-bg text-v-unchecked border-gray-400',
};

export function VerdictBadge({ v, provisional, size = 'md' }: { v: Verdict; provisional?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-lg px-3 py-1' : size === 'sm' ? 'text-xs px-2 py-0' : '';
  return (
    <span className={`chip ${VERDICT_CLASS[v]} ${cls}`} aria-label={`判定 ${VERDICT_LABEL[v]}`}>
      <span aria-hidden="true">{VERDICT_ICON[v]}</span>
      {VERDICT_LABEL[v]}
      {provisional && v !== 'unchecked' ? <span className="font-normal">（仮）</span> : null}
    </span>
  );
}

export function OverallBadge({ o, big }: { o: Overall; big?: boolean }) {
  const meaning = o === 'red' ? 'やめる' : o === 'yellow' ? '確かめるまで払わない' : '大きな問題は見つからなかった（保証ではない）';
  return (
    <div className={`inline-flex items-center gap-3 rounded-xl border-2 px-4 py-2 ${VERDICT_CLASS[o]}`}>
      <span className={`${big ? 'text-4xl' : 'text-2xl'} font-extrabold leading-none`} aria-hidden="true">
        {VERDICT_ICON[o]}
      </span>
      <span>
        <span className={`${big ? 'text-3xl' : 'text-xl'} font-extrabold`}>{VERDICT_LABEL[o]}</span>
        <span className="block text-sm font-semibold">{meaning}</span>
      </span>
    </div>
  );
}

export function CountsBar({ counts, compact }: { counts: VerdictCounts; compact?: boolean }) {
  const order: Verdict[] = ['red', 'yellow', 'blue', 'na', 'unchecked'];
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-2'}`} aria-label="判定の数">
      {order.map((v) => (
        <span key={v} className={`chip ${VERDICT_CLASS[v]} ${compact ? 'text-xs' : ''}`}>
          <span aria-hidden="true">{VERDICT_ICON[v]}</span>
          {VERDICT_LABEL[v]} {counts[v]}
        </span>
      ))}
    </div>
  );
}

export function CopyButton({ text, label = 'コピー', className = 'btn-secondary btn-sm', done = 'コピーしました' }: { text: string; label?: string; className?: string; done?: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 1800);
    return () => clearTimeout(t);
  }, [ok]);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
        } catch {
          window.prompt('コピーできませんでした。手で選んでコピーしてください。', text);
        }
      }}
    >
      {ok ? done : label}
    </button>
  );
}

export function Section({ title, children, right, id }: { title: ReactNode; children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section className="card space-y-3" id={id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h3">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-600">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text' }: { value?: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} className="input" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function TextArea({ value, onChange, placeholder, rows = 3 }: { value?: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className="textarea" rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/** 文字列の一覧を編集する（会社名・URLなど） */
export function ListInput({ values, onChange, placeholder, addLabel = '追加' }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((v, i) => (
            <li key={`${v}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-sm">
              <span className="break-all">{v}</span>
              <button type="button" className="ml-1 rounded px-1 text-gray-600 hover:bg-gray-200" aria-label={`${v} を削除`} onClick={() => onChange(values.filter((_, j) => j !== i))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          className="input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={add}>
          {addLabel}
        </button>
      </div>
    </div>
  );
}

export function ExternalLink({ href, children, className = 'link' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function Collapsible({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="rounded-lg border border-gray-300 bg-white" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-3 py-2 font-semibold">{title}</summary>
      <div className="border-t border-gray-200 px-3 py-3">{children}</div>
    </details>
  );
}

export function Spinner({ label = '読み込み中…' }: { label?: string }) {
  return <div className="p-6 text-center text-gray-600">{label}</div>;
}
