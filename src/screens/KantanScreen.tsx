import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CaseProvider, useCaseCtx } from '../app/CaseContext';
import { createCase } from '../app/store';
import { ANSWER_LABEL, applyKantanToCase, kantan, kantanOverall } from '../logic/kantan';
import type { KantanAnswer } from '../types';
import { linkByKey, contacts } from '../data/config';
import { nowIso, ymd } from '../logic/util';
import { Seal, Spinner } from '../components/ui';
import { VERDICT_ICON, VERDICT_LABEL } from '../types';

const FSA = linkByKey('fsa_search')?.url ?? 'https://search.fsa.go.jp/';

function BigButton({ children, onClick, tone = 'plain', to }: { children: React.ReactNode; onClick?: () => void; tone?: 'plain' | 'ink' | 'shu'; to?: string }) {
  const cls = `k-btn ${tone === 'ink' ? 'k-btn-ink' : tone === 'shu' ? 'k-btn-shu' : ''}`;
  return to ? (
    <Link to={to} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

export function KantanStart() {
  const navigate = useNavigate();
  return (
    <div className="k-wrap">
      <div className="k-title">
        <Seal v="unchecked" size="lg" />
        <h1 className="h1">かんたん版</h1>
      </div>
      <p className="k-lead">10個の質問に「はい」「いいえ」で答えるだけ。だいたい2分で終わります。</p>
      <p className="k-lead">お金を払う前に、まずこれだけ。</p>
      <BigButton
        tone="ink"
        onClick={async () => {
          const c = await createCase();
          c.card.caseName = `かんたんチェック ${ymd()}`;
          c.kantan = { answers: {} };
          const { saveCase } = await import('../app/store');
          await saveCase(c);
          navigate(`/kantan/${c.id}?q=1`);
        }}
      >
        はじめる
      </BigButton>
      <BigButton to="/paid" tone="shu">
        もう払ってしまった
      </BigButton>
      <Link to="/" className="link mt-4 block text-center text-lg">
        くわしい版に切り替える
      </Link>
    </div>
  );
}

function Question() {
  const { c, update } = useCaseCtx();
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const n = Math.max(1, Number(sp.get('q') ?? '1') || 1);
  const q = kantan.questions[n - 1];
  const total = kantan.questions.length;
  const answers = c.kantan?.answers ?? {};
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [n]);
  if (!q) return null;
  const answer = (a: KantanAnswer) => {
    update((d) => {
      d.kantan = { answers: { ...(d.kantan?.answers ?? {}), [q.id]: a } };
      applyKantanToCase(d, FSA, nowIso());
      if (n >= total) d.kantan.finishedAt = nowIso();
    });
    if (n >= total) navigate(`/kantan/${c.id}?q=result`);
    else setSp({ q: String(n + 1) });
  };
  const current = answers[q.id];
  const choices: KantanAnswer[] = q.type === 'registry' ? ['listed', 'not_listed', 'not_yet'] : ['yes', 'no', 'unknown'];
  return (
    <div className="k-wrap">
      <div className="k-progress" aria-label={`質問 ${n} / ${total}`}>
        <span className="mono">
          {n} / {total}
        </span>
        <div className="k-bar">
          <div style={{ width: `${(n / total) * 100}%` }} />
        </div>
      </div>
      <h1 className="k-q">{q.text}</h1>
      {q.sub && <p className="k-sub">{q.sub}</p>}
      {q.type === 'registry' && (
        <a className="k-btn k-btn-ink" href={FSA} target="_blank" rel="noopener noreferrer">
          金融庁のページを開く
        </a>
      )}
      <div className="k-choices">
        {choices.map((a) => (
          <button key={a} type="button" className={`k-btn ${current === a ? 'k-btn-on' : ''}`} onClick={() => answer(a)}>
            {ANSWER_LABEL[a]}
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-between text-lg">
        <button type="button" className="link" disabled={n <= 1} onClick={() => setSp({ q: String(n - 1) })} style={{ visibility: n <= 1 ? 'hidden' : 'visible' }}>
          ← もどる
        </button>
        <Link className="link" to="/kantan">
          やめる
        </Link>
      </div>
    </div>
  );
}

function Result() {
  const { c } = useCaseCtx();
  const answers = c.kantan?.answers ?? {};
  const r = kantanOverall(answers);
  const txt = kantan.results[r.overall];
  const tel = contacts.contacts[0];
  return (
    <div className="k-wrap">
      <div className={`k-result k-result-${r.overall}`}>
        <Seal v={r.overall} size="xl" />
        <div className="k-result-word">
          <span aria-hidden="true">{VERDICT_ICON[r.overall]}</span> {VERDICT_LABEL[r.overall]}
        </div>
        <h1 className="k-q">{txt.title}</h1>
        <p className="k-sub">{txt.body}</p>
      </div>
      {r.reds.length > 0 && (
        <div className="k-list">
          <div className="k-list-title">やめる理由（{r.reds.length}つ）</div>
          <ul>
            {r.reds.map((q) => (
              <li key={q.id}>{q.text}</li>
            ))}
          </ul>
        </div>
      )}
      {r.yellows.length > 0 && (
        <div className="k-list">
          <div className="k-list-title">確かめること（{r.yellows.length}つ）</div>
          <ul>
            {r.yellows.map((q) => (
              <li key={q.id}>{q.text}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="k-sub">答えは {r.answered} / {kantan.questions.length} 問。この判定は、払うかどうかを決めるための材料です。安全の保証ではありません。</p>
      <BigButton to={`/case/${c.id}/sheet`} tone="ink">
        家族に見せる（判定の1枚）
      </BigButton>
      <BigButton to={`/case/${c.id}/check`}>くわしく調べる（41項目）</BigButton>
      <BigButton to={`/case/${c.id}/paid`} tone="shu">
        もう払ってしまった
      </BigButton>
      <a className="k-btn" href={`tel:${tel.tel}`}>
        電話で相談する　{tel.name} {tel.tel}
      </a>
      <Link className="link mt-4 block text-center text-lg" to={`/kantan/${c.id}?q=1`}>
        答えを直す
      </Link>
      <Link className="link block text-center text-lg" to="/kantan">
        最初から
      </Link>
    </div>
  );
}

export function KantanScreen() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Spinner />;
  return (
    <CaseProvider id={id} fallback={(s) => (s === 'loading' ? <Spinner /> : <div className="k-wrap"><p className="k-lead">この記録は見つかりません。</p><BigButton to="/kantan">最初から</BigButton></div>)}>
      {sp.get('q') === 'result' ? <Result /> : <Question />}
    </CaseProvider>
  );
}
