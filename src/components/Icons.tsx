// 線画のアイコン（帳票の世界観に合わせた細い線・角を少し丸めた形）
import type { ReactNode } from 'react';

export type IconName = 'search' | 'records' | 'book' | 'gear' | 'building' | 'flag' | 'hand' | 'clock' | 'talk' | 'robot' | 'copy' | 'coin' | 'camera' | 'close' | 'check' | 'cross' | 'triangle' | 'circle' | 'arrow';

const P: Record<IconName, ReactNode> = {
  search: (<><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></>),
  records: (<><path d="M4 6.5h6l1.8 2H20v10.5H4z" /><path d="M4 11h16" /></>),
  book: (<><path d="M4 5.5c2.8-1 5.5-1 8 .8 2.5-1.8 5.2-1.8 8-.8V19c-2.8-1-5.5-1-8 .8-2.5-1.8-5.2-1.8-8-.8z" /><path d="M12 6.3v13.5" /></>),
  gear: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9" /></>),
  building: (<><path d="M3.5 20.5h17" /><path d="M5 20.5v-9M9.7 20.5v-9M14.3 20.5v-9M19 20.5v-9" /><path d="M3.5 9.5 12 4l8.5 5.5z" /></>),
  flag: (<><path d="M5 21V4" /><path d="M5 4.5h11.5l-2 3.8 2 3.7H5" /></>),
  hand: (<><path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11" /><path d="M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5" /><path d="M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.6 6.5-6 6.5-2.6 0-4.2-1.2-5.6-3.3L3.6 14.5a1.5 1.5 0 0 1 2.5-1.6L8 15" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.4 2" /></>),
  talk: (<><path d="M4 5.5h16v10H10l-4.5 3.8V15.5H4z" /><path d="M8 9.5h8M8 12h5" /></>),
  robot: (<><rect x="5" y="8" width="14" height="11" rx="2" /><path d="M12 4.5V8M9.5 13h0M14.5 13h0" /><path d="M9.5 16.2h5" /><circle cx="12" cy="4" r="0.8" /></>),
  copy: (<><path d="M7 7h-.5A2.5 2.5 0 0 0 4 9.5v8A2.5 2.5 0 0 0 6.5 20h8a2.5 2.5 0 0 0 2.5-2.5V17" /><rect x="8" y="4" width="12" height="12" rx="2.5" /><path d="M11.5 10h5M14 7.5v5" /></>),
  coin: (<><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" /><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>),
  camera: (<><path d="M4 8h3.2l1.6-2.5h6.4L16.8 8H20v11H4z" /><circle cx="12" cy="13.2" r="3.4" /></>),
  close: (<><path d="M6 6l12 12M18 6 6 18" /></>),
  check: (<><path d="M5 12.5 10 17l9-10" /></>),
  cross: (<><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></>),
  triangle: (<><path d="M12 4.5 20.5 19h-17z" /></>),
  circle: (<><circle cx="12" cy="12" r="7.5" /></>),
  arrow: (<><path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" /></>),
};

export function Icon({ name, size = 22, className = '', strokeWidth = 1.8 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 ${className}`} aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}
