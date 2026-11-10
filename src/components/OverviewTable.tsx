import { CATEGORIES } from '../data/checklist';
import type { OverviewRow } from '../logic/overview';
import { overviewSummary } from '../logic/overview';
import { VerdictBadge } from './ui';

/** 41項目の早見表 */
export function OverviewTable({ rows }: { rows: OverviewRow[] }) {
  const s = overviewSummary(rows);
  return (
    <div className="k-list !p-0">
      <div className="border-b border-ink bg-paper-3 px-3 py-2">
        <div className="k-list-title !mb-0 !border-0">{rows.length}項目の早見表</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-base">
          <span>
            <b className="mono text-lg">{s.auto}</b> 自動で分かった
          </span>
          <span>
            <b className="mono text-lg">{s.self}</b> 自分で見る
          </span>
          <span>
            <b className="mono text-lg">{s.talk}</b> 相手の言葉で決まる
          </span>
        </div>
      </div>
      {CATEGORIES.map((cat) => {
        const list = rows.filter((r) => r.item.cat === cat.no);
        if (!list.length) return null;
        return (
          <div key={cat.no}>
            <div className="mincho border-b border-rule bg-paper-3/60 px-3 py-1 text-base font-extrabold">
              <span className="mono mr-1">{cat.no}</span>
              {cat.title}
            </div>
            <ul className="!m-0">
              {list.map((r) => (
                <li key={r.item.id} className="ov-row">
                  <div className="ov-q">
                    <span className="fuda mr-2">{r.item.id}</span>
                    {r.short}
                  </div>
                  <div className="ov-a">
                    {r.suggest && <VerdictBadge v={r.suggest} size="sm" />}
                    {r.reason && <span className="ov-reason">{r.reason}</span>}
                    {r.quote && <span className="ov-reason">「{r.quote}」</span>}
                    {r.kind === 'talk' && !r.suggest && <span className="ov-muted">言われたことで決まる（貼るか、質問に答える）</span>}
                    {r.kind === 'self' && !r.link && <span className="ov-muted">自分で見る</span>}
                    {r.link && (
                      <a className="btn-secondary btn-sm !min-h-8 no-underline" href={r.link.url} target="_blank" rel="noopener noreferrer">
                        {r.link.label} →
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <div className="border-t border-rule px-3 py-2 text-xs text-ink-3">色の札は「候補」です。金融庁の一覧の写しとくらべたもので、最後は自分の目で確かめて決めます。</div>
    </div>
  );
}
