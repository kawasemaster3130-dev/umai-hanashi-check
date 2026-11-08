// 文字読み取り（OCR）の部品を public/ocr にコピーする（npm install のあとに自動で動く）。外部CDNに頼らず、端末の中だけで動かすため。
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
mkdirSync(out, { recursive: true });
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz', 'jpn.traineddata.gz'],
];
for (const [src, dst] of files) {
  const s = join(root, src);
  if (!existsSync(s)) { console.warn('なし:', src); continue; }
  copyFileSync(s, join(out, dst));
}
console.log('OCRの部品を public/ocr にコピーしました');
