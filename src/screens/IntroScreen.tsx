import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../app/hooks';
import { saveSettings } from '../app/store';
import { feel } from '../app/feedback';
import { Spinner } from '../components/ui';
import { Icon } from '../components/Icons';
import { applyYears, formatMan, INTRO_GOAL_YEARS, INTRO_PNL, INTRO_PRODUCTS, INTRO_TITLES, INTRO_YEARS, manToYen, missingIntro, parseAmount, toggleProduct } from '../logic/intro';
import { buildIntroPayload, collectConfig, collectEnabled, sendPayload } from '../logic/collect';
import { nowIso } from '../logic/util';
import type { IntroAnswers } from '../types';

function Q({ n, sub, done, children }: { n: number; sub?: ReactNode; done: boolean; children: ReactNode }) {
  return (
    <section className={`s-ask intro-q ${done ? '' : 'intro-q-todo'}`} id={`intro-q${n}`} aria-labelledby={`intro-t${n}`}>
      <div className="intro-head">
        <h2 className="s-ask-q" id={`intro-t${n}`}>
          <span className="intro-no">{n}</span>
          {INTRO_TITLES[n - 1]}
        </h2>
        {done ? <span className="seal seal-sm text-shu">済</span> : <span className="intro-mi">未回答</span>}
      </div>
      {sub && <p className="intro-sub">{sub}</p>}
      {children}
    </section>
  );
}

function Choice({ on, onClick, children, sub }: { on: boolean; onClick: () => void; children: ReactNode; sub?: string }) {
  return (
    <button type="button" className={`s-choice s-choice-sm ${on ? 's-choice-on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
      {sub && <small>{sub}</small>}
    </button>
  );
}

function ManInput({ id, value, onChange, label }: { id: string; value?: string; onChange: (v: string) => void; label: string }) {
  const n = parseAmount(value);
  return (
    <div>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <div className="intro-amount">
        <input id={id} className="intro-input" inputMode="decimal" autoComplete="off" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="例：120" />
        <span className="intro-unit">万円</span>
      </div>
      {value?.trim() ? n === undefined ? <p className="intro-err">数字で入れてください（例：120、3.5）</p> : <p className="intro-yen">＝ {manToYen(n)}（{formatMan(n)}）</p> : null}
    </div>
  );
}

/** 最初の5つの質問。edit のときは設定から開いて、直したら設定へ戻る */
export function IntroScreen({ edit = false }: { edit?: boolean }) {
  const settings = useSettings();
  const navigate = useNavigate();
  const [a, setA] = useState<IntroAnswers | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings && a === null) setA(settings.intro ?? {});
  }, [settings, a]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  if (!settings || a === null) return <Spinner />;

  const missing = missingIntro(a);
  const done = (n: number) => !missing.includes(n);
  const set = (patch: Partial<IntroAnswers>) => setA((cur) => ({ ...(cur ?? {}), ...patch }));

  const submit = async () => {
    if (missing.length) {
      document.getElementById(`intro-q${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setBusy(true);
    const next: IntroAnswers = { ...a, answeredAt: nowIso() };
    await saveSettings({ intro: next });
    sendPayload(buildIntroPayload(next));
    feel('stamp-blue');
    window.scrollTo({ top: 0 });
    if (edit) navigate('/settings');
  };

  return (
    <div className="k-wrap">
      <div className="hero">
        <div className="hero-kicker">{edit ? '答えを直す' : 'はじめに'}</div>
        <h1 className="hero-title">
          <span className="nowrap">あなたのことを、</span>
          <span className="nowrap">5つ教えてください</span>
        </h1>
      </div>
      <p className="k-sub">
        全部に答えると、チェックに進めます。だいたいで大丈夫です。
        {collectEnabled() ? `答えは${collectConfig.operator}に届きます。` : '答えはこの端末の中だけに保存されます。'}
      </p>

      <Q n={1} sub="投資を始めてから、どのくらいですか？" done={done(1)}>
        <div className="intro-grid">
          {INTRO_YEARS.map(([k, l]) => (
            <Choice key={k} on={a.years === k} onClick={() => setA(applyYears(a, k))}>
              {l}
            </Choice>
          ))}
        </div>
      </Q>

      <Q n={2} sub="当てはまるものを全部押してください。" done={done(2)}>
        <div className="intro-grid">
          {INTRO_PRODUCTS.map(([k, l]) => {
            const on = (a.products ?? []).includes(k);
            return (
              <Choice key={k} on={on} onClick={() => setA(toggleProduct(a, k))}>
                {l}
              </Choice>
            );
          })}
        </div>
        {(a.products ?? []).includes('other') && (
          <div>
            <label className="intro-sub" htmlFor="intro-other">
              その他の商品の名前
            </label>
            <input id="intro-other" className="intro-input" value={a.productsOther ?? ''} onChange={(e) => set({ productsOther: e.target.value })} placeholder="例：金（ゴールド）、不動産、債券" autoComplete="off" />
          </div>
        )}
      </Q>

      <Q n={3} sub="これまでの投資を全部合わせて、いくら増えた（減った）か。" done={done(3)}>
        <div className="intro-grid">
          {INTRO_PNL.map(([k, l, sub]) => (
            <Choice key={k} on={a.pnlSign === k} sub={sub} onClick={() => set({ pnlSign: k, pnlMan: k === 'plus' || k === 'minus' ? a.pnlMan : '' })}>
              {l}
            </Choice>
          ))}
        </div>
        {a.pnlSign === 'plus' || a.pnlSign === 'minus' ? <p className="intro-sub">{a.pnlSign === 'plus' ? 'もうかった' : '損をした'}金額を、万円で入れてください。</p> : null}
        {(a.pnlSign === 'plus' || a.pnlSign === 'minus') && <ManInput id="intro-pnl" label={a.pnlSign === 'plus' ? 'もうかった金額（万円）' : '損をした金額（万円）'} value={a.pnlMan} onChange={(v) => set({ pnlMan: v })} />}
      </Q>

      <Q n={4} sub="生活費や、近いうちに使うお金を除いて、投資に回してよいお金。なければ 0 と入れてください。" done={done(4)}>
        <ManInput id="intro-surplus" label="投資に回せるお金（万円）" value={a.surplusMan} onChange={(v) => set({ surplusMan: v })} />
      </Q>

      <Q n={5} sub="何年後までに、どうなっていたいですか？" done={done(5)}>
        <div className="intro-years">
          <label className="sr-only" htmlFor="intro-gy">
            何年後
          </label>
          <input id="intro-gy" className="intro-input intro-input-s" inputMode="numeric" autoComplete="off" value={a.goalYears ?? ''} onChange={(e) => set({ goalYears: e.target.value })} />
          <span className="intro-unit">年後までに</span>
        </div>
        <div className="intro-chips">
          {INTRO_GOAL_YEARS.map((y) => (
            <button key={y} type="button" className={`intro-chip ${parseAmount(a.goalYears) === y ? 'is-on' : ''}`} aria-pressed={parseAmount(a.goalYears) === y} onClick={() => set({ goalYears: String(y) })}>
              {y}年後
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="intro-goal">
          どうなっていたいか
        </label>
        <textarea id="intro-goal" className="intro-input intro-text" rows={3} value={a.goalText ?? ''} onChange={(e) => set({ goalText: e.target.value })} placeholder="例：資産を2,000万円にして、年金のほかに毎月5万円を受け取れるようにしたい" />
      </Q>

      <button type="button" className="k-btn k-btn-ink" disabled={busy} aria-disabled={missing.length > 0} onClick={submit}>
        {missing.length ? (
          <span>
            あと{missing.length}問
            <small className="intro-left">（{missing.map((n) => `${n}`).join('・')}番が未回答）</small>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            {edit ? '直して保存する' : '答えて、次へ進む'}
            <Icon name="arrow" size={26} />
          </span>
        )}
      </button>
      {edit && (
        <Link to="/settings" className="link block text-center text-lg">
          直さずに戻る
        </Link>
      )}
    </div>
  );
}
