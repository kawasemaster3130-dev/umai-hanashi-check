import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChecklistItem, IdentityKey, ItemResult, Verdict } from '../types';
import { IDENTITY_LABEL, VERDICT_ICON, VERDICT_MEANING, VERDICT_SIMPLE } from '../types';
import { useCaseCtx } from '../app/CaseContext';
import { applyVerdict, evidenceCount, getResult, isInRecheckRange, validateVerdictChange, type Problem } from '../logic/verdict';
import { categoryOf } from '../data/checklist';
import { formatDateTime, isBlank, nowIso } from '../logic/util';
import { ExternalLink, ListInput, SEAL_CHAR, VerdictBadge, VERDICT_CLASS } from './ui';
import { Screenshots } from './Screenshots';
import { QuotePicker } from './QuotePicker';

const VERDICT_ORDER: Verdict[] = ['red', 'yellow', 'blue', 'na', 'unchecked'];
const IDENTITY_KEYS: IdentityKey[] = ['company', 'place', 'period', 'sns'];

export function ItemEditor({ item, highlight }: { item: ChecklistItem; highlight?: boolean }) {
  const { c, ctx, update } = useCaseCtx();
  const r = getResult(c.items, item.id);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [naMode, setNaMode] = useState(false);
  const [naReason, setNaReason] = useState(r.naReason ?? '');
  const [urlDraft, setUrlDraft] = useState('');
  const [picker, setPicker] = useState(false);
  const hasRecord = evidenceCount(r) > 0 || !isBlank(r.memo) || !!r.checkedBy || (r.identityMatches?.length ?? 0) > 0;
  const [open, setOpen] = useState<boolean>(hasRecord || item.selfRequired);
  const cat = categoryOf(item.cat);
  const flagged = c.review.flaggedCategories.includes(item.cat);
  const inRange = isInRecheckRange(ctx, item.id) && c.previousNames.length > 0;
  const isTrigger = item.id === ctx.rules.previousNameRecheck.triggerItem;
  const now = nowIso;

  const setR = (patch: Partial<ItemResult>) =>
    update((d) => {
      d.items[item.id] = { ...getResult(d.items, item.id), ...patch, updatedAt: now() };
    });

  const trySet = (v: Verdict, patch: Partial<ItemResult> = {}) => {
    if (v === 'unchecked') {
      update((d) => {
        d.items[item.id] = applyVerdict(getResult(d.items, item.id), 'unchecked', {}, now());
      });
      setProblems([]);
      setNaMode(false);
      return;
    }
    if (v === 'na') {
      const reason = (patch.naReason ?? naReason ?? '').trim();
      if (!reason) {
        setNaMode(true);
        setProblems([]);
        return;
      }
      patch = { ...patch, naReason: reason };
    }
    if (!r.checkedBy && !r.ai) patch = { ...patch, checkedBy: 'self' };
    const probs = validateVerdictChange(item, r, v, ctx, patch, c.items);
    if (probs.length) {
      setProblems(probs);
      setOpen(true);
      return;
    }
    update((d) => {
      d.items[item.id] = applyVerdict(getResult(d.items, item.id), v, patch, now());
    });
    setProblems([]);
    setNaMode(false);
  };

  const addUrl = () => {
    const u = urlDraft.trim();
    if (!u) return;
    const url = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    setR({ urls: [...r.urls, { url, viewedAt: now() }] });
    setUrlDraft('');
  };

  const border = r.verdict === 'unchecked' ? 'border-ink' : VERDICT_CLASS[r.verdict].split(' ').find((x) => x.startsWith('border-')) ?? 'border-ink';

  return (
    <article id={`item-${item.id}`} className={`card scroll-mt-28 space-y-3 !border-2 ${border} ${highlight ? 'outline-shu' : ''}`} aria-labelledby={`item-${item.id}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 id={`item-${item.id}-title`} className="text-lg font-bold leading-snug">
            <span className="fuda mr-2 align-middle">{item.id}</span>
            {item.question}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            {item.selfRequired && <span className="chip bg-ink text-paper-2">必ず自分で開く</span>}
            {item.identityCheck && <span className="chip bg-paper-3 text-ink-2">同一人物の手がかり2つ以上</span>}
            {flagged && <span className="chip bg-ocher-bg text-ocher">見落とし指摘あり：見直し</span>}
            {item.status && <span className="chip bg-paper-3 text-ink-2">追加項目</span>}
          </div>
        </div>
        <VerdictBadge v={r.verdict} provisional={r.provisional} size="lg" />
      </header>

      <div className="space-y-0.5 text-sm">
        <div>
          <span className="font-semibold text-v-red">赤：</span>
          {item.red ?? 'この項目では赤はない'}
          <span className="mx-2 text-rule">｜</span>
          <span className="font-semibold text-v-yellow">黄：</span>
          {item.yellow ?? (item.red ? '調べられなかった' : '—')}
        </div>
        <div className="text-ink-3">
          どこで見る：{item.where}
          {cat && (
            <>
              {' '}
              <Link className="link" to={`/guides/${cat.guide}`}>
                手引き{cat.no}
              </Link>
            </>
          )}
          {item.naAllowed && item.naHint ? `　関係ないとき：${item.naHint}` : ''}
        </div>
      </div>

      {r.autoHints && r.autoHints.length > 0 && (
        <div className="note space-y-1">
          <div className="font-semibold">こんな言葉がありました（候補です。見て、自分で判定します）</div>
          <ul className="space-y-1">
            {r.autoHints.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <VerdictBadge v={h.suggest} size="sm" />
                <span className="break-all">「{h.quote}」</span>
                {h.note && <span className="text-xs text-ink-2">{h.note}</span>}
                {!r.quotes.includes(h.quote) && (
                  <button type="button" className="btn-secondary btn-sm !min-h-7 !py-0 text-xs" onClick={() => setR({ quotes: [...r.quotes, h.quote] })}>
                    記録に入れる
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.ai && (
        <div className="note-info space-y-1">
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            AI下調べの結果（{r.provisional ? '仮' : '参考'}）
            <VerdictBadge v={r.ai.verdict} size="sm" />
            <span className="text-xs font-normal">
              {r.ai.status === 'found' ? '載っていた' : r.ai.status === 'not_found' ? '載っていなかった' : r.ai.status === 'could_not_check' ? '調べられなかった' : r.ai.status === 'na' ? '該当なし' : '状態不明'}
            </span>
          </div>
          {r.ai.result && <div className="whitespace-pre-wrap break-words">{r.ai.result}</div>}
          {r.ai.urls.length > 0 && (
            <ul className="text-xs">
              {r.ai.urls.map((u) => (
                <li key={u}>
                  <ExternalLink href={u}>{u}</ExternalLink>
                </li>
              ))}
            </ul>
          )}
          {r.ai.warnings.map((w, i) => (
            <div key={i} className="text-xs text-v-red">
              ⚠ {w}
            </div>
          ))}
          <div className="text-xs">AIの答えに「登録あり」「問題なし」と書いてあっても、そのまま信じません。{item.selfRequired ? '必ず自分で一覧を開いて確かめ、「確認した人：自分」にしてください。' : '下の判定ボタンで自分の判定として確定します。'}</div>
        </div>
      )}

      <div>
        <div className="label">あなたの判定{r.provisional && r.verdict !== 'unchecked' ? '（AIの仮の答えです。ボタンを押して自分の判定にします）' : ''}</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="判定を選ぶ">
          {VERDICT_ORDER.filter((v) => v !== 'na' || item.naAllowed).map((v) => {
            const active = r.verdict === v && !r.provisional;
            return (
              <button
                key={v}
                type="button"
                className={`btn ${VERDICT_CLASS[v]} ${active ? '!shadow-none translate-x-[2px] translate-y-[2px] ring-2 ring-ink' : 'opacity-85 hover:opacity-100'}`}
                style={{ borderColor: 'currentColor', boxShadow: active ? 'none' : '2px 2px 0 0 currentColor' }}
                aria-pressed={active}
                title={VERDICT_MEANING[v]}
                onClick={() => trySet(v)}
              >
                <span className="seal seal-sm" aria-hidden="true">{SEAL_CHAR[v]}</span>
                <span aria-hidden="true">{VERDICT_ICON[v]}</span>
                {VERDICT_SIMPLE[v]}
              </button>
            );
          })}
        </div>
        {naMode && (
          <div className="mt-2 space-y-2 border border-v-na bg-v-na-bg p-3">
            <div className="text-sm font-semibold">「関係ない」理由（必ず書く）</div>
            <input className="input" value={naReason} onChange={(e) => setNaReason(e.target.value)} placeholder={item.naHint ?? '当てはまらない理由'} />
            <div className="flex flex-wrap gap-2">
              {item.naHint && (
                <button type="button" className="btn-secondary btn-sm" onClick={() => setNaReason(item.naHint!)}>
                  理由に「{item.naHint}」を入れる
                </button>
              )}
              <button type="button" className="btn-primary btn-sm" onClick={() => trySet('na', { naReason })}>
                関係ないにする
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setNaMode(false)}>
                やめる
              </button>
            </div>
          </div>
        )}
        {r.verdict === 'na' && r.naReason && (
          <div className="mt-1 text-sm text-ink-2">
            関係ない理由：{r.naReason}{' '}
            <button type="button" className="link" onClick={() => setNaMode(true)}>
              直す
            </button>
          </div>
        )}
        {problems.length > 0 && (
          <ul className="note-danger mt-2 space-y-1">
            {problems.map((p) => (
              <li key={p.code}>{p.message}</li>
            ))}
          </ul>
        )}
      </div>

      {!open ? (
        <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
          記録を残す（メモ・見たページ・スクショ・言われた言葉）{hasRecord ? '　✓あり' : ''}
        </button>
      ) : (
        <div className="space-y-3 border-t border-dashed border-rule pt-3">
          <div className="flex items-center justify-between">
            <span className="mincho font-bold">記録</span>
            {!item.selfRequired && (
              <button type="button" className="link text-sm" onClick={() => setOpen(false)}>
                たたむ
              </button>
            )}
          </div>
      {item.identityCheck && (
        <div className="border border-rule bg-paper-3/50 p-3">
          <div className="label">同じ人物と言える手がかり（赤にするには2つ以上）</div>
          <div className="flex flex-wrap gap-3">
            {IDENTITY_KEYS.map((k) => (
              <label key={k} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={(r.identityMatches ?? []).includes(k)}
                  onChange={() => {
                    const cur = r.identityMatches ?? [];
                    setR({ identityMatches: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] });
                  }}
                />
                {IDENTITY_LABEL[k]}が一致
              </label>
            ))}
          </div>
          <div className="mt-1 text-xs text-ink-3">名前だけの一致で赤にしません。1つ以下なら黄（同じ人と確かめられなかった）。</div>
        </div>
      )}

      {isTrigger && (
        <div className="border border-rule bg-paper-3/50 p-3">
          <div className="label">見つかった前の名前（入力すると、2-1〜3-4に「前の名前でも確認」の欄が増えます）</div>
          <ListInput values={c.previousNames} onChange={(v) => update((d) => void (d.previousNames = v))} placeholder="前の会社名" />
        </div>
      )}

      {inRange && (
        <div className="border border-ocher bg-ocher-bg p-3">
          <div className="label">前の名前でも確認（4-4を青にするには全部にチェック）</div>
          <div className="flex flex-wrap gap-3">
            {c.previousNames.map((n) => (
              <label key={n} className="inline-flex items-center gap-1">
                <input type="checkbox" className="size-5" checked={!!r.previousNameChecked?.[n]} onChange={(e) => setR({ previousNameChecked: { ...(r.previousNameChecked ?? {}), [n]: e.target.checked } })} />「{n}」でも確認した
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="label">だれが見た</div>
          <div className="flex gap-3">
            {(['self', 'ai'] as const).map((k) => (
              <label key={k} className="inline-flex items-center gap-1">
                <input type="radio" className="size-5" name={`by-${item.id}`} checked={r.checkedBy === k} onChange={() => setR({ checkedBy: k })} />
                {k === 'self' ? '自分' : 'AI'}
              </label>
            ))}
          </div>
          {item.selfRequired && r.checkedBy !== 'self' && <div className="mt-1 text-xs text-v-red">ここは自分の目で見た、にならないと結果を確定できません。</div>}
        </div>
        <label className="block">
          <span className="label">メモ（何を見て、何が分かったか）</span>
          <textarea className="textarea min-h-20" value={r.memo ?? ''} onChange={(e) => setR({ memo: e.target.value })} placeholder="例：一括検索と一覧PDFで会社名を検索。載っていなかった。" />
        </label>
      </div>

      <div>
        <div className="label">
          見たページ（{r.urls.length}）<span className="font-normal text-ink-3">　青のときも残すと安心</span>
        </div>
        {r.urls.length > 0 && (
          <ul className="mb-2 space-y-1 text-sm">
            {r.urls.map((u, i) => (
              <li key={`${u.url}-${i}`} className="flex flex-wrap items-center gap-2">
                <ExternalLink href={u.url}>{u.url}</ExternalLink>
                <span className="text-xs text-ink-3">{formatDateTime(u.viewedAt)}</span>
                <button type="button" className="text-xs text-ink-3 underline" onClick={() => setR({ urls: r.urls.filter((_, j) => j !== i) })}>
                  外す
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://…（見た日時は自動で記録）"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <button type="button" className="btn-secondary shrink-0" onClick={addUrl}>
            追加
          </button>
        </div>
      </div>

      <div>
        <div className="label">スクショ（{r.screenshots.length}）</div>
        <Screenshots caseId={c.id} itemId={item.id} ids={r.screenshots} onChange={(ids) => setR({ screenshots: ids })} />
      </div>

      <div>
        <div className="label">言われた言葉（{r.quotes.length}）</div>
        {r.quotes.length > 0 && (
          <ul className="mb-2 space-y-1 text-sm">
            {r.quotes.map((q, i) => (
              <li key={`${q}-${i}`} className="flex items-start gap-2 bg-paper-3 px-2 py-1">
                <span className="flex-1 break-words">「{q}」</span>
                <button type="button" className="text-xs text-ink-3 underline" onClick={() => setR({ quotes: r.quotes.filter((_, j) => j !== i) })}>
                  外す
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn-secondary btn-sm" onClick={() => setPicker(true)}>
          ＋ 言われた言葉を貼る
        </button>
        {picker && <QuotePicker text={c.rawMessages} onPick={(q) => setR({ quotes: r.quotes.includes(q) ? r.quotes : [...r.quotes, q] })} onClose={() => setPicker(false)} />}
      </div>

      {flagged && (
        <label className="flex items-center gap-2 border border-ocher bg-ocher-bg p-3 font-semibold">
          <input type="checkbox" className="size-5" checked={!!r.reviewed} onChange={(e) => setR({ reviewed: e.target.checked })} />
          見直し済み（分類{item.cat}に見落としの指摘があったので、この項目も見直しました）
        </label>
      )}
        </div>
      )}
      {!isBlank(r.updatedAt) && <div className="text-right text-xs text-ink-3">更新：{formatDateTime(r.updatedAt)}</div>}
    </article>
  );
}
