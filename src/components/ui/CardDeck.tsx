"use client";

export function CardDeck({ size = 40 }: { size?: number }) {
  const scale = size / 40;
  const w = 52 * scale;
  const h = 48 * scale;

  return (
    <svg width={w} height={h} viewBox="0 0 52 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      <g transform="rotate(-14 20 24)">
        <rect x="8" y="3" width="26" height="36" rx="4" stroke="#FF4444" strokeWidth="2.2" fill="rgba(255,68,68,0.08)"/>
      </g>
      <g transform="rotate(0 22 24)">
        <rect x="12" y="2" width="26" height="36" rx="4" stroke="#FFCB05" strokeWidth="2.5" fill="rgba(255,203,5,0.1)"/>
        <path d="M22 28 L25 16 L28 28" stroke="#FFCB05" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <line x1="25" y1="16" x2="25" y2="28" stroke="#FFCB05" strokeWidth="2.2" strokeLinecap="round"/>
      </g>
      <g transform="rotate(14 30 24)">
        <rect x="16" y="3" width="26" height="36" rx="4" stroke="#4488FF" strokeWidth="2.2" fill="rgba(68,136,255,0.08)"/>
      </g>
      <circle cx="42" cy="6" r="2.5" fill="#FFCB05" opacity="0.8"/>
      <line x1="42" y1="2" x2="42" y2="10" stroke="#FFCB05" strokeWidth="0.8" opacity="0.5"/>
      <line x1="38" y1="6" x2="46" y2="6" stroke="#FFCB05" strokeWidth="0.8" opacity="0.5"/>
    </svg>
  );
}
