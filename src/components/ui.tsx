import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Deal, Lang } from '../types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger' | 'good';
const V: Record<Variant, string> = {
  primary: 'bg-primary text-onprimary hover:opacity-90 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:border-gold',
  ghost: 'text-ink hover:bg-band/60',
  gold: 'bg-gold text-[#172B45] hover:brightness-105 shadow-sm',
  danger: 'bg-bad text-white hover:opacity-90',
  good: 'bg-good text-white hover:opacity-90',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm';
  return (
    <button type="button" {...rest}
      className={`press inline-flex items-center justify-center gap-2 rounded-ctl font-semibold whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none ${sz} ${V[variant]} ${className}`}>
      {children}
    </button>
  );
}

type Tone = 'neutral' | 'gold' | 'good' | 'warn' | 'bad' | 'navy' | 'demo';
const TONES: Record<Tone, string> = {
  neutral: 'bg-band text-ink',
  gold: 'bg-gold/20 text-goldink',
  good: 'bg-good/15 text-good',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  navy: 'bg-primary text-onprimary',
  demo: 'border border-dashed border-muted/60 text-muted',
};
export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-5 whitespace-nowrap ${TONES[tone]} ${className}`}>{children}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface ${className}`}>{children}</div>;
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
        {sub && <p className="text-muted text-sm mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line p-8 text-center">
      <p className="font-semibold">{title}</p>
      {sub && <p className="text-muted text-sm mt-1">{sub}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function money(n: number, lang: Lang) {
  const s = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 0 }).format(n);
  return lang === 'ar' ? `${s} ريال` : `SAR ${s}`;
}
export function Price({ n, deal, lang, className = '' }: { n: number; deal: Deal; lang: Lang; className?: string }) {
  return (
    <span className={`num font-bold ${className}`}>
      {money(n, lang)}
      {deal === 'rent' && <span className="text-muted font-medium text-[0.8em]">{lang === 'ar' ? ' / سنوياً' : ' / year'}</span>}
    </span>
  );
}
export const num = (n: number, lang: Lang) => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US').format(n);
export const dateFmt = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm min-w-0">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
