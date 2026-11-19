// 押した手ごたえ：スマホは軽く震える。音は設定でオンにした人だけ（小さな木の音）
let soundOn = false;
let ac: AudioContext | undefined;
export function setSound(on: boolean): void {
  soundOn = on;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function tone(freqs: number[], dur = 0.07, gap = 0.06, vol = 0.07): void {
  try {
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t0 = ac.currentTime;
    freqs.forEach((f, i) => {
      const o = ac!.createOscillator();
      const g = ac!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const s = t0 + i * gap;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(vol, s + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      o.connect(g).connect(ac!.destination);
      o.start(s);
      o.stop(s + dur + 0.02);
    });
  } catch {
    // 音が出せない端末では何もしない
  }
}

export type Feel = 'tap' | 'select' | 'stamp-red' | 'stamp-yellow' | 'stamp-blue' | 'stamp-none';

export function feel(kind: Feel = 'tap'): void {
  const vib: Record<Feel, number | number[]> = { tap: 6, select: 10, 'stamp-red': [24, 50, 40], 'stamp-yellow': [20, 40, 20], 'stamp-blue': 22, 'stamp-none': 14 };
  if (!reduced()) navigator.vibrate?.(vib[kind]);
  if (!soundOn) return;
  if (kind === 'tap') tone([620], 0.05, 0, 0.05);
  else if (kind === 'select') tone([700, 940], 0.06, 0.05, 0.05);
  else if (kind === 'stamp-red') tone([180, 140], 0.14, 0.09, 0.12);
  else if (kind === 'stamp-yellow') tone([330, 280], 0.11, 0.08, 0.09);
  else tone([520, 780], 0.1, 0.07, 0.08);
}

/** ボタン・リンクを押したら、どこでも軽い手ごたえ */
export function installGlobalFeel(): () => void {
  const h = (e: PointerEvent) => {
    const el = (e.target as HTMLElement | null)?.closest('button, a.btn, a.btn-primary, a.btn-secondary, a.btn-danger, a.k-btn, .s-choice, .tab-item, summary');
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (el.classList.contains('sos-btn')) return; // 赤いボタンは、結果の印で鳴らす
    feel(el.classList.contains('s-choice') ? 'select' : 'tap');
  };
  document.addEventListener('pointerdown', h, { passive: true });
  return () => document.removeEventListener('pointerdown', h);
}
