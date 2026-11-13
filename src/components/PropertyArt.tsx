import type { PropertyType } from '../types';

// Generated illustrations stand in for advertiser photos (each ad gets its own "photo set").
const SKIES = [
  ['#C9D6E3', '#F3E7D3'], ['#E9D3B4', '#F8EEDD'], ['#B7C7D8', '#E8DDC9'], ['#D8C3A5', '#F4ECDF'], ['#AFC0D3', '#F1E4CE'],
];
const WALLS = ['#EFE6D6', '#E4D5BC', '#F4EEE3', '#D9C7A8', '#E9DFCE'];

function rng(seed: number) {
  let a = seed || 1;
  return () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; };
}

export function PropertyArt({ type, seed, variant = 0, className = '' }: { type: PropertyType; seed: number; variant?: number; className?: string }) {
  const r = rng(seed * 7 + variant * 131 + 3);
  const sky = SKIES[Math.floor(r() * SKIES.length)];
  const wall = WALLS[Math.floor(r() * WALLS.length)];
  const sunX = 60 + r() * 280;
  const id = `g${seed}-${variant}`;
  const navy = '#172B45', gold = '#B69B72', slate = '#68788A';
  const shift = variant % 4;

  let building: JSX.Element;
  if (type === 'villa') {
    const w = 200 + shift * 10, x = 100 - shift * 5;
    building = (
      <g>
        <rect x={x} y={120} width={w} height={95} fill={wall} />
        <rect x={x + 30} y={78} width={w * 0.55} height={50} fill={wall} />
        <rect x={x - 6} y={114} width={w + 12} height={8} fill={gold} />
        <rect x={x + 24} y={72} width={w * 0.55 + 12} height={7} fill={gold} />
        {[0, 1, 2].map((i) => <rect key={i} x={x + 20 + i * 60} y={140} width={34} height={44} fill={navy} opacity={0.82} rx={2} />)}
        <rect x={x + 48} y={88} width={28} height={28} fill={navy} opacity={0.75} />
        <rect x={x + 92} y={88} width={28} height={28} fill={navy} opacity={0.75} />
        <rect x={x + w - 46} y={160} width={30} height={55} fill={slate} />
        <ellipse cx={x - 20} cy={196} rx={22} ry={30} fill="#7C8F6E" />
        <rect x={x - 22} y={200} width={4} height={18} fill="#6B5A44" />
      </g>
    );
  } else if (type === 'apartment' || type === 'floor') {
    const floors = type === 'floor' ? 3 : 6 + shift;
    const h = floors * 22, x = 130 + shift * 12, y0 = 215 - h;
    building = (
      <g>
        <rect x={x} y={y0} width={140} height={h} fill={wall} />
        <rect x={x - 4} y={y0 - 6} width={148} height={7} fill={gold} />
        {Array.from({ length: floors }).map((_, f) => (
          <g key={f}>
            {[0, 1, 2, 3].map((c) => <rect key={c} x={x + 12 + c * 32} y={y0 + 6 + f * 22} width={20} height={12} fill={navy} opacity={0.8} />)}
          </g>
        ))}
        <rect x={x + 160} y={215 - h * 0.6} width={70} height={h * 0.6} fill={slate} opacity={0.55} />
      </g>
    );
  } else if (type === 'land') {
    building = (
      <g>
        <polygon points="40,215 120,170 330,170 370,215" fill="#D9C4A0" />
        <polygon points="120,170 330,170 330,176 124,176" fill={gold} />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={110 + i * 70} y={160} width={3} height={22} fill={navy} />)}
        <rect x={150 + shift * 15} y={145} width={64} height={22} fill={navy} rx={3} />
        <text x={182 + shift * 15} y={160} fontSize={10} textAnchor="middle" fill="#F8F6F1" fontFamily="Manrope">PLOT</text>
      </g>
    );
  } else {
    const x = 120 + shift * 10, h = type === 'office' ? 150 : 70;
    building = (
      <g>
        <rect x={x} y={215 - h} width={160} height={h} fill={type === 'office' ? '#A9B6C4' : wall} />
        {type === 'office'
          ? Array.from({ length: 6 }).map((_, f) => <rect key={f} x={x + 8} y={215 - h + 8 + f * 24} width={144} height={14} fill={navy} opacity={0.72} />)
          : <><rect x={x + 10} y={160} width={140} height={55} fill={navy} opacity={0.82} /><rect x={x - 6} y={144} width={172} height={14} fill={gold} /></>}
      </g>
    );
  }

  return (
    <svg viewBox="0 0 400 240" className={className} preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="1" stopColor={sky[1]} />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${id})`} />
      <circle cx={sunX} cy={48} r={16} fill="#F8F6F1" opacity={0.85} />
      <rect x="0" y="205" width="400" height="35" fill="#CDB58E" />
      <rect x="0" y="213" width="400" height="27" fill="#BFA67D" />
      {building}
    </svg>
  );
}
