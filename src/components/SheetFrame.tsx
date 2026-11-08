import { useEffect, useRef, useState } from 'react';

/** 判定の1枚を、保存・印刷と同じHTMLのまま表示する */
export function SheetFrame({ html, title = '判定の1枚' }: { html: string; title?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(600);
  const measure = () => {
    const doc = ref.current?.contentDocument;
    if (doc?.documentElement) setH(Math.max(300, doc.documentElement.scrollHeight + 8));
  };
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => ref.current?.contentWindow?.print()}>
          印刷・PDFで保存
        </button>
      </div>
      <iframe ref={ref} title={title} srcDoc={html} className="w-full border border-ink bg-paper-2" style={{ height: h }} onLoad={measure} />
    </div>
  );
}
