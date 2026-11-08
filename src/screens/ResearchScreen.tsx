import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCaseCtx } from '../app/CaseContext';
import { StepBar } from '../components/Layout';
import { CopyButton, Field, Section, TextArea, VerdictBadge } from '../components/ui';
import { links } from '../data/config';
import { buildResearchPrompt, personalInfoWarnings } from '../logic/prompts';
import { applyResearchImport, parseAiResearch, type ImportWarning } from '../logic/importers';
import { nowIso } from '../logic/util';

export function ResearchScreen() {
  const { c, items, update } = useCaseCtx();
  const navigate = useNavigate();
  const [paste, setPaste] = useState('');
  const [result, setResult] = useState<{ kind: 'ok'; applied: number; kept: number; warnings: ImportWarning[]; overall?: string; selfCheck: string[] } | { kind: 'ng'; error: string } | null>(null);
  const prompt = buildResearchPrompt(c, items, links);
  const piWarn = personalInfoWarnings(prompt);
  const aiCount = items.filter((it) => c.items[it.id]?.ai).length;

  return (
    <div className="space-y-4">
      <StepBar />
      <h2 className="h2">ステップ2　AIに下調べをさせる</h2>
      <div className="note-danger font-semibold">AIの答えに「登録あり」「問題なし」と書いてあっても、そのまま信じません。登録の有無は、金融庁の一覧を自分で開いて確かめます（1-1・1-2・1-3・2-1）。</div>
      <p className="text-sm text-ink-2">ウェブ検索ができるAI（Claude・ChatGPT・Gemini など、検索機能をオンにしたもの）で使ってください。どのAIでも動く依頼文です。検索ができるAIがなければ、省略して自分で調べます。</p>

      <Section title="1. 依頼文を作ってコピー">
        {piWarn.length > 0 && (
          <ul className="note space-y-1">
            {piWarn.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}
        <div className="note-info">
          貼る前に確認：自分の名前・電話・口座番号が入っていませんか？ 伏せる言葉：{c.maskWords.length ? c.maskWords.map((m) => m.label).join('、') : '（未登録）'}{' '}
          <Link className="link" to={`/case/${c.id}/card`}>
            ステップ1で登録
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={prompt} label="依頼文をコピー" className="btn-primary" />
          <span className="text-xs text-ink-3">{items.length}項目のID単位で、決まった形（JSON）で返させます。</span>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-ink-2">依頼文を見る</summary>
          <textarea readOnly className="textarea mt-2 min-h-60 text-xs" value={prompt} />
        </details>
      </Section>

      <Section title="2. 返ってきた答えを貼って取り込む" right={aiCount ? <span className="text-sm text-ink-2">取り込み済み {aiCount} 項目</span> : null}>
        <Field label="AIの答え（全文を貼ってかまいません）">
          <TextArea value={paste} onChange={setPaste} rows={8} placeholder="```json … ``` の部分だけを読み、各項目に「仮」の判定・結果メモ・URLを入れます。" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!paste.trim()}
            onClick={() => {
              const now = nowIso();
              const imp = parseAiResearch(paste, items, now);
              update((d) => {
                d.aiResearchRaw = paste; // 読めなくても全文は保存する
                d.researchStatus = 'done';
                if (imp.ok) applyResearchImport(d, imp, items, now);
              });
              if (!imp.ok) {
                setResult({ kind: 'ng', error: imp.error });
                return;
              }
              const probe = { ...c, items: { ...c.items } };
              const { applied, kept } = applyResearchImport(probe, imp, items, now);
              setResult({ kind: 'ok', applied, kept, warnings: imp.warnings, overall: imp.overall, selfCheck: imp.selfCheck });
              setPaste('');
            }}
          >
            取り込む
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              update((d) => void (d.researchStatus = 'skipped'));
              navigate(`/case/${c.id}/check`);
            }}
          >
            省略して自分で調べる
          </button>
        </div>
        {result?.kind === 'ng' && (
          <div className="note-danger space-y-2">
            <div>{result.error}</div>
            <div className="text-sm">貼った全文はこの案件に保存しました。</div>
            <Link to={`/case/${c.id}/check`} className="btn-secondary btn-sm">
              手で写す（チェック表へ）
            </Link>
          </div>
        )}
        {result?.kind === 'ok' && (
          <div className="note-info space-y-2">
            <div className="font-semibold">
              {result.applied} 項目に「仮」の判定を入れました。{result.kept > 0 ? `${result.kept} 項目は、自分で確定済みだったので判定を変えず、AIの結果だけ添えました。` : ''}
            </div>
            {result.overall && (
              <div className="flex items-center gap-2 text-sm">
                AIの全体判定（参考。アプリは自分で集計します）：{['red', 'yellow', 'blue'].includes(result.overall) ? <VerdictBadge v={result.overall as 'red' | 'yellow' | 'blue'} size="sm" /> : result.overall}
              </div>
            )}
            {result.selfCheck.length > 0 && (
              <div className="text-sm">
                <div className="font-semibold">AIが「自分の手で確かめるべき」と書いたこと：</div>
                <ul className="list-disc pl-5">
                  {result.selfCheck.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.warnings.length > 0 && (
              <details open={result.warnings.length <= 8}>
                <summary className="cursor-pointer text-sm font-semibold">注意 {result.warnings.length} 件</summary>
                <ul className="list-disc pl-5 text-sm">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="text-sm">すべて「仮」の判定です。チェック表で1項目ずつ、自分で確かめて確定してください。</div>
          </div>
        )}
        {c.aiResearchRaw && (
          <details>
            <summary className="cursor-pointer text-sm text-ink-2">保存されているAIの答え（全文）</summary>
            <textarea readOnly className="textarea mt-2 min-h-40 text-xs" value={c.aiResearchRaw} />
          </details>
        )}
      </Section>

      <div className="flex justify-between">
        <Link to={`/case/${c.id}/card`} className="btn-secondary">
          ← ステップ1
        </Link>
        <Link to={`/case/${c.id}/check`} className="btn-primary">
          ステップ3〜5 チェック表へ →
        </Link>
      </div>
    </div>
  );
}
