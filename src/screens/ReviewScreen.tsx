import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCaseCtx } from '../app/CaseContext';
import { StepBar } from '../components/Layout';
import { CopyButton, Field, Section, TextArea } from '../components/ui';
import { buildReviewPrompt } from '../logic/prompts';
import { applyReviewImport, parseReviewJson, type ImportWarning } from '../logic/importers';
import { getResult } from '../logic/verdict';
import { nowIso } from '../logic/util';
import { CATEGORIES } from '../data/checklist';

const TYPE_LABEL: Record<string, string> = {
  no_url: 'URLがないのに「見つけた」',
  not_found_as_safe: '「見つからなかった」を「問題なし」にしている',
  should_be_red: '赤にすべき事実がある',
  name_only_match: '名前だけの一致で同じ人と決めている',
  other: 'その他',
};

export function ReviewScreen() {
  const { c, items, update } = useCaseCtx();
  const [paste, setPaste] = useState('');
  const [skipReason, setSkipReason] = useState(c.review.skipReason ?? '');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'ng'; text: string; warnings?: ImportWarning[] } | null>(null);
  const prompt = buildReviewPrompt(c, items);
  const rv = c.review;
  const progress = rv.flaggedCategories.map((cat) => {
    const list = items.filter((it) => it.cat === cat);
    return { cat, total: list.length, done: list.filter((it) => getResult(c.items, it.id).reviewed).length };
  });

  return (
    <div className="space-y-4">
      <StepBar />
      <h2 className="h2">ステップ6　別のAIで見落としを探す</h2>
      <p className="text-sm text-ink-2">別のAI、または同じAIの新しい会話で使ってください（同じ会話だと、自分の答えをかばいます）。下調べの結果といまのチェック表を渡し、辛口の確認役として4点だけ指摘させます。</p>

      <div className="card flex flex-wrap items-center gap-2">
        <span className="font-semibold">いまの状態：</span>
        {rv.status === 'pending' && <span className="chip border-rule bg-paper-3">未実施</span>}
        {rv.status === 'done' && <span className="chip border-shu bg-paper-2 text-shu">実施済み（指摘 {rv.findings.length} 件）</span>}
        {rv.status === 'skipped' && <span className="chip border-ocher bg-ocher-bg text-ocher">省略（{rv.skipReason || '理由未記入'}）</span>}
        {rv.status !== 'pending' && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => update((d) => void (d.review = { status: 'pending', flaggedCategories: [], findings: [] }))}>
            やり直す
          </button>
        )}
      </div>

      <Section title="1. 依頼文をコピー">
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={prompt} label="依頼文をコピー" className="btn-primary" />
          <span className="text-xs text-ink-3">チェック表（{items.length}行）と下調べの全文が入ります。伏せる言葉は置き換え済みです。</span>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-ink-2">依頼文を見る</summary>
          <textarea readOnly className="textarea mt-2 min-h-60 text-xs" value={prompt} />
        </details>
      </Section>

      <Section title="2. 指摘を貼って取り込む">
        <Field label="AIの答え（全文でかまいません）">
          <TextArea value={paste} onChange={setPaste} rows={6} placeholder='```json {"findings": [...]} ``` の部分を読みます。' />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!paste.trim()}
            onClick={() => {
              const r = parseReviewJson(paste, items);
              if (!r.ok) {
                setMsg({ kind: 'ng', text: r.error });
                update((d) => void (d.reviewRaw = paste));
                return;
              }
              update((d) => {
                d.reviewRaw = paste;
                applyReviewImport(d, r.findings, items, nowIso());
              });
              setMsg({ kind: 'ok', text: r.findings.length ? `指摘 ${r.findings.length} 件を取り込みました。指摘のあった分類の全項目に「見直し」の印を付けました。` : '指摘なしとして取り込みました。', warnings: r.warnings });
              setPaste('');
            }}
          >
            取り込む
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              update((d) => applyReviewImport(d, [], items, nowIso()));
              setMsg({ kind: 'ok', text: '指摘なしとして記録しました。' });
            }}
          >
            指摘なしとして取り込む
          </button>
        </div>
        {msg && (
          <div className={msg.kind === 'ok' ? 'note-info' : 'note-danger'}>
            {msg.text}
            {msg.warnings?.length ? <ul className="list-disc pl-5 text-sm">{msg.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul> : null}
          </div>
        )}
      </Section>

      {rv.findings.length > 0 && (
        <Section title="指摘の一覧">
          <ul className="space-y-2">
            {rv.findings.map((f, i) => {
              const it = items.find((x) => x.id === f.id);
              return (
                <li key={i} className="rounded-lg border border-ocher bg-ocher-bg p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="link font-bold" to={`/case/${c.id}/check?cat=${it?.cat ?? 1}#item-${f.id}`}>
                      {f.id} {it?.question}
                    </Link>
                    <span className="chip border-ocher bg-paper-2 text-xs text-ocher">{TYPE_LABEL[f.type] ?? f.type}</span>
                  </div>
                  <div className="mt-1 text-sm">{f.comment}</div>
                </li>
              );
            })}
          </ul>
          <div className="space-y-1">
            <div className="font-semibold">見直しの進み具合（指摘のあった分類は全項目を見直します）</div>
            {progress.map((p) => (
              <div key={p.cat} className="flex flex-wrap items-center gap-2 text-sm">
                <Link className="link" to={`/case/${c.id}/check?cat=${p.cat}`}>
                  分類{p.cat} {CATEGORIES.find((k) => k.no === p.cat)?.title}
                </Link>
                <span className={p.done === p.total ? 'text-shu' : 'text-ocher'}>
                  見直し済み {p.done}/{p.total}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="3. 省略する（検索ができるAIがないときなど）">
        <Field label="省略する理由（必須）">
          <input className="input" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} placeholder="例：検索ができるAIが使えない" />
        </Field>
        <button
          type="button"
          className="btn-secondary"
          disabled={!skipReason.trim()}
          onClick={() => {
            update((d) => void (d.review = { status: 'skipped', skipReason: skipReason.trim(), flaggedCategories: [], findings: [] }));
            setMsg({ kind: 'ok', text: '省略として記録しました。判定の1枚に「見落としチェックは省略（理由）」と出ます。' });
          }}
        >
          省略する
        </button>
      </Section>

      <div className="flex justify-between">
        <Link to={`/case/${c.id}/check`} className="btn-secondary">
          ← チェック表
        </Link>
        <Link to={`/case/${c.id}/sheet`} className="btn-primary">
          ステップ7 判定の1枚へ →
        </Link>
      </div>
    </div>
  );
}
