// スクリーンショットから文字を読み取る（端末の中だけで動く。外には送らない）
export type OcrProgress = (p: { status: string; progress: number }) => void;

/** 読み取った文章を、言葉の検索に向く形にそろえる（行の途中の改行や空白を詰める） */
export function normalizeOcrText(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[ \t　]+/g, ' ').trim());
  const out: string[] = [];
  let buf = '';
  for (const l of lines) {
    if (!l) {
      if (buf) out.push(buf);
      buf = '';
      continue;
    }
    if (!buf) buf = l;
    else if (/[。！？!?」』）)]$/.test(buf)) {
      out.push(buf);
      buf = l;
    } else buf += l;
  }
  if (buf) out.push(buf);
  // 日本語の文字の間の空白を落とす
  return out.map((s) => s.replace(/([　-鿿＀-￯])\s+(?=[　-鿿＀-￯])/g, '$1')).join('\n');
}

export async function recognizeImages(files: File[], onProgress?: OcrProgress): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const base = `${import.meta.env.BASE_URL}ocr/`;
  const worker = await createWorker('jpn', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    gzip: true,
    logger: (m: { status: string; progress: number }) => onProgress?.(m),
  });
  try {
    const parts: string[] = [];
    for (const f of files) {
      const { data } = await worker.recognize(f);
      parts.push(normalizeOcrText(data.text));
    }
    return parts.join('\n\n');
  } finally {
    await worker.terminate();
  }
}
