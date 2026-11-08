import { Link } from 'react-router-dom';
import { useCaseCtx } from '../app/CaseContext';
import { StepBar } from '../components/Layout';
import { CopyButton, OverallBadge, Section } from '../components/ui';
import { yellowItems, getResult } from '../logic/verdict';
import { SHARE_CAUTION } from '../logic/sheet';

export const DECLINE_MESSAGE = '家族と相談して、やめることにしました。';

export function NextScreen() {
  const { c, items, overall, counts } = useCaseCtx();
  const ys = yellowItems(items, c.items);
  return (
    <div className="space-y-4">
      <StepBar />
      <h2 className="h2">ステップ8　このあとどうするか（払う前）</h2>
      <div className="flex flex-wrap items-center gap-3">
        <OverallBadge o={overall} big />
        {c.snapshots.length === 0 && <span className="note">判定の1枚はまだ確定していません。確定してから家族に見せることを勧めます。</span>}
      </div>

      {overall === 'red' && (
        <Section title="赤：払いません">
          <p>やめる理由になる事実が{counts.red}件あります。払いません。理由の言い合いはしません。相手に送る文はこれだけで足ります。</p>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3">
            <span className="font-semibold">「{DECLINE_MESSAGE}」</span>
            <CopyButton text={DECLINE_MESSAGE} label="この文をコピー" />
          </div>
          <p className="text-sm text-gray-700">送ったあと、追加の説明を求められても答えなくてかまいません。連絡をやめてもかまいません。</p>
        </Section>
      )}
      {overall === 'yellow' && (
        <Section title="黄：確かめ終わるまで払いません">
          <p>締め切りで急かされても待ちます。本当に良い話なら、確かめる時間を与えてくれます。次を確かめ終わるまで払いません。</p>
          <ul className="space-y-1">
            {ys.map((it) => {
              const r = getResult(c.items, it.id);
              return (
                <li key={it.id} className="rounded border border-v-yellow bg-v-yellow-bg px-3 py-2 text-sm">
                  <Link className="font-bold underline" to={`/case/${c.id}/check?cat=${it.cat}#item-${it.id}`}>
                    {it.id}
                  </Link>{' '}
                  {it.question}
                  <div className="text-xs text-gray-800">{r.verdict === 'unchecked' ? '未調査。' : ''}確かめること：{it.yellow ?? it.red ?? it.question}{r.memo ? `／メモ：${r.memo}` : ''}</div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {overall === 'blue' && (
        <Section title="青：大きな問題は見つかりませんでした">
          <p>これは安全の保証ではありません。「見つからなかった」は「安全」ではありません。払うかどうかは自分で決めます。払うなら、なくなっても生活に差し支えない額にとどめます。</p>
        </Section>
      )}

      <Section title="家族に見せる">
        <p className="text-sm text-gray-700">判定の1枚を印刷・PDFにして、家族や信頼できる人に見せます。一人で決めないことが、いちばんの守りです。</p>
        <div className="flex flex-wrap gap-2">
          <Link to={`/case/${c.id}/sheet`} className="btn-primary">
            判定の1枚を開く（印刷・PDF）
          </Link>
        </div>
        <div className="text-xs text-gray-700">{SHARE_CAUTION}</div>
      </Section>

      <Section title="すでに払ってしまったとき">
        <p className="text-sm text-gray-700">追加では払わず、少額で出金を試し、やり取りを保存し、相談窓口へ。「取り戻します」と連絡してくる業者には注意します。</p>
        <Link to={`/case/${c.id}/paid`} className="btn-secondary">
          すでに払ってしまった人へ →
        </Link>
      </Section>
    </div>
  );
}
