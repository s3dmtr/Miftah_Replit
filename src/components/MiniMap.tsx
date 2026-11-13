import { DISTRICTS } from '../data/seed';
import { useStore } from '../lib/store';
import type { Group } from '../lib/selectors';

// Simulated map (Google Maps is not configured in this prototype). Positions use real-ish coordinates.
const B = { latMin: 24.68, latMax: 24.9, lngMin: 46.58, lngMax: 46.8 };
const W = 600, H = 520;
const X = (lng: number) => ((lng - B.lngMin) / (B.lngMax - B.lngMin)) * W;
const Y = (lat: number) => H - ((lat - B.latMin) / (B.latMax - B.latMin)) * H;

export function MiniMap({ groups = [], focus, height = 380 }: { groups?: Group[]; focus?: { lat: number; lng: number }; height?: number }) {
  const { L, t } = useStore();
  return (
    <div className="relative rounded-card border border-line overflow-hidden bg-band/40" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label={t('map_demo')}>
        <rect width={W} height={H} fill="rgb(var(--band))" opacity="0.35" />
        {/* stylised main roads */}
        <path d={`M${X(46.655)} 0 L${X(46.69)} ${H}`} stroke="rgb(var(--muted))" strokeOpacity="0.35" strokeWidth="6" fill="none" />
        <path d={`M0 ${Y(24.79)} L${W} ${Y(24.775)}`} stroke="rgb(var(--muted))" strokeOpacity="0.28" strokeWidth="5" fill="none" />
        <path d={`M${X(46.6)} 0 C ${X(46.62)} ${H * 0.4}, ${X(46.63)} ${H * 0.7}, ${X(46.61)} ${H}`} stroke="rgb(var(--muted))" strokeOpacity="0.22" strokeWidth="4" fill="none" />
        <path d={`M0 ${Y(24.72)} L${W} ${Y(24.73)}`} stroke="rgb(var(--muted))" strokeOpacity="0.22" strokeWidth="4" fill="none" />
        {DISTRICTS.map((d) => (
          <g key={d.id}>
            <circle cx={X(d.lng)} cy={Y(d.lat)} r="34" fill="rgb(var(--surface))" fillOpacity="0.55" stroke="rgb(var(--line))" />
            <text x={X(d.lng)} y={Y(d.lat) + 48} textAnchor="middle" fontSize="13" fontWeight="600" fill="rgb(var(--muted))">{L(d.name)}</text>
          </g>
        ))}
        {groups.map((g) => (
          <a key={g.property.id} href={`#property-${g.property.id}`}>
            <circle cx={X(g.property.lng)} cy={Y(g.property.lat)} r={g.listings.length > 1 ? 9 : 7}
              fill="#172B45" stroke="#B69B72" strokeWidth={g.listings.length > 1 ? 3 : 2} />
          </a>
        ))}
        {focus && (
          <g>
            <circle cx={X(focus.lng)} cy={Y(focus.lat)} r="22" fill="#B69B72" fillOpacity="0.25" />
            <circle cx={X(focus.lng)} cy={Y(focus.lat)} r="9" fill="#172B45" stroke="#B69B72" strokeWidth="3" />
          </g>
        )}
      </svg>
      <span className="absolute bottom-2 start-2 rounded-full bg-surface/90 border border-dashed border-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted">{t('map_demo')}</span>
    </div>
  );
}
