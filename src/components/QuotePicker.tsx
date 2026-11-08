import { useRef, useState } from 'react';

/** 案件カードのやり取りの文章から、選んだ部分を引用として貼る */
export function QuotePicker({ text, onPick, onClose }: { text: string; onPick: (q: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [manual, setManual] = useState('');
  const [msg, setMsg] = useState('');
  const pickSelection = () => {
    const ta = ref.current;
    if (!ta) return;
    const q = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
    if (!q) {
      setMsg('文章の中で、引用したい部分を指でなぞって（マウスで選んで）から押してください。');
      return;
    }
    onPick(q);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-hidden border border-ink bg-paper-2 p-4 outline outline-1 outline-offset-4 outline-ink">
        <div className="flex items-center justify-between">
          <h3 className="h3">やり取りから引用する</h3>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            閉じる
          </button>
        </div>
        {text ? (
          <>
            <p className="text-sm text-ink-2">引用したい部分を選んで「選んだ部分を引用」を押します。言い換えず、そのまま残します。</p>
            <textarea ref={ref} readOnly className="textarea min-h-48 flex-1 text-sm" value={text} />
            {msg && <div className="note">{msg}</div>}
            <button type="button" className="btn-primary" onClick={pickSelection}>
              選んだ部分を引用
            </button>
          </>
        ) : (
          <div className="note">案件カード（ステップ1）に、勧誘のやり取りがまだ貼られていません。下に手で入力することもできます。</div>
        )}
        <div className="flex gap-2">
          <input className="input" placeholder="手で引用を入力（言われた言葉をそのまま）" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => {
              if (!manual.trim()) return;
              onPick(manual.trim());
              onClose();
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
