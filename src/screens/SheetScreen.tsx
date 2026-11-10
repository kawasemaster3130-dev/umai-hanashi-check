import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCaseCtx } from '../app/CaseContext';
import { StepBar } from '../components/Layout';
import { SheetFrame } from '../components/SheetFrame';
import { Section, TextInput } from '../components/ui';
import { confirmBlockers, countVerdicts, overallVerdict } from '../logic/verdict';
import { buildSheetData, renderSheetHtml, SHARE_CAUTION } from '../logic/sheet';
import { buildCaseZip, downloadBlob, zipFileName } from '../app/exportImport';
import { formatDateTime, nowIso } from '../logic/util';

export function SheetScreen() {
  const { c, ctx, items, update, flush } = useCaseCtx();
  const [viewVersion, setViewVersion] = useState<number | 'draft'>('draft');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const blockers = useMemo(() => confirmBlockers(c, ctx), [c, ctx]);
  const unchecked = blockers.filter((b) => b.code === 'unchecked');
  const others = blockers.filter((b) => b.code !== 'unchecked');
  const counts = useMemo(() => countVerdicts(items, c.items), [items, c.items]);
  const latest = c.snapshots.at(-1);
  const changedSince = latest ? c.updatedAt > latest.confirmedAt : false;
  const draftHtml = useMemo(() => renderSheetHtml(buildSheetData(c, ctx, { evidenceFileName: zipFileName(c) })), [c, ctx]);
  const shown = viewVersion === 'draft' ? draftHtml : c.snapshots.find((s) => s.version === viewVersion)?.html ?? draftHtml;

  const confirm = () => {
    if (blockers.length) return;
    const confirmedAt = nowIso();
    const version = (latest?.version ?? 0) + 1;
    const html = renderSheetHtml(buildSheetData(c, ctx, { version, confirmedAt, evidenceFileName: zipFileName(c, confirmedAt) }));
    update((d) => {
      d.snapshots.push({ version, confirmedAt, counts, overall: overallVerdict(counts), html });
      d.updatedAt = confirmedAt; // 確定直後は「変更なし」
    });
    setViewVersion(version);
    setMsg(`第${version}版として確定しました。この時点の内容を凍結して保存しています。あとで直すと、次の確定で新しい版になります。`);
  };

  const exportZip = async () => {
    setBusy(true);
    try {
      await flush();
      const { blob, fileName } = await buildCaseZip(c, ctx);
      downloadBlob(blob, fileName);
      setMsg(`${fileName} を書き出しました（case.json・判定の1枚.html・チェック表.csv・evidence/・urls.txt）。`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <StepBar />
      <h2 className="h2">ステップ7　判定の1枚</h2>
      <p className="text-sm text-ink-2">アプリが数えて作ります（AIにまとめさせません）。A4縦1枚。印刷・PDF保存・家族への共有に使います。</p>

      <Section title="確定する">
        <label className="block sm:max-w-sm">
          <span className="label">調べた人（任意）</span>
          <TextInput value={c.investigator} onChange={(v) => update((d) => void (d.investigator = v))} placeholder="名前や呼び名" />
        </label>
        {blockers.length > 0 ? (
          <div className="note-danger space-y-3">
            <div className="mincho text-lg font-extrabold">まだ結果を確定できません</div>
            {unchecked.length > 0 && (
              <div className="space-y-2">
                <div>
                  まだ答えていない質問が <b>{unchecked.length}</b> あります。{counts.red >= 1 ? '赤が出ているので、ここで打ち切ることもできます。' : ''}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="btn-primary" to={`/case/${c.id}/check?cat=${items.find((x) => x.id === unchecked[0].itemId)?.cat ?? 1}#item-${unchecked[0].itemId}`}>
                    続きの質問に答える
                  </Link>
                  {counts.red >= 1 && !c.stoppedEarly && (
                    <button type="button" className="btn-danger" onClick={() => update((d) => void (d.stoppedEarly = true))}>
                      赤で打ち切る
                    </button>
                  )}
                </div>
              </div>
            )}
            {others.length > 0 && (
              <div>
                <div className="font-bold">ほかに直すところ（{others.length}）。押すとそこへ飛びます</div>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {others.slice(0, 20).map((b, i) => (
                    <li key={i}>
                      <Link className="link" to={b.itemId ? `/case/${c.id}/check?cat=${items.find((x) => x.id === b.itemId)?.cat ?? 1}#item-${b.itemId}` : b.code === 'review_pending' || b.code === 'skip_needs_reason' ? `/case/${c.id}/review` : `/case/${c.id}/check`}>
                        {b.message}
                      </Link>
                    </li>
                  ))}
                  {others.length > 20 && <li>ほか {others.length - 20} 件</li>}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="note-info">確定できる条件をすべて満たしています。{latest && !changedSince ? `第${latest.version}版（${formatDateTime(latest.confirmedAt)}）として確定済みです。` : latest && changedSince ? `第${latest.version}版のあとに変更があります。確定すると第${latest.version + 1}版になります。` : ''}</div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={blockers.length > 0 || (!!latest && !changedSince)} onClick={confirm}>
            {latest ? `第${latest.version + 1}版として確定` : '確定する（第1版）'}
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={exportZip}>
            ZIPで書き出す（証拠つき）
          </button>
        </div>
        {msg && <div className="note-info">{msg}</div>}
      </Section>

      <Section
        title="判定の1枚"
        right={
          c.snapshots.length > 0 ? (
            <select className="input !w-auto" value={String(viewVersion)} onChange={(e) => setViewVersion(e.target.value === 'draft' ? 'draft' : Number(e.target.value))}>
              <option value="draft">いまの内容（下書き）</option>
              {[...c.snapshots].reverse().map((s) => (
                <option key={s.version} value={s.version}>
                  第{s.version}版（{formatDateTime(s.confirmedAt)}）
                </option>
              ))}
            </select>
          ) : null
        }
      >
        <SheetFrame html={shown} />
        <div className="text-xs text-ink-2">{SHARE_CAUTION}</div>
      </Section>

      <div className="flex justify-between">
        <Link to={`/case/${c.id}/review`} className="btn-secondary">
          ← ステップ6
        </Link>
        <Link to={`/case/${c.id}/next`} className="btn-primary">
          ステップ8 このあとどうするか →
        </Link>
      </div>
    </div>
  );
}
