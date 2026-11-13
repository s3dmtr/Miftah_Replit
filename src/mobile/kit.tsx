// Shared mobile UI pieces: app header, icon buttons, chips, bottom sheets, property cards, toast.
import { ArrowLeft, ArrowRight, Bath, BedDouble, Heart, Layers, MapPin, Ruler, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { districtById, TYPE_LABEL } from '../data/seed';
import { useStore } from '../lib/store';
import type { Group } from '../lib/selectors';
import { PropertyArt } from '../components/PropertyArt';
import { money, num } from '../components/ui';
import type { Deal, Lang } from '../types';
import { useNav } from './nav';

export function useTx() {
  const { lang } = useStore();
  return (ar: string, en: string) => (lang === 'ar' ? ar : en);
}

export const shortMoney = (n: number, lang: Lang) => {
  const ar = lang === 'ar';
  if (n >= 1_000_000) return `${num(+(n / 1_000_000).toFixed(2), lang)} ${ar ? 'مليون' : 'M'}`;
  if (n >= 1000) return `${num(Math.round(n / 1000), lang)} ${ar ? 'ألف' : 'K'}`;
  return num(n, lang);
};
export function PriceTag({ n, deal, className = '', short = false }: { n: number; deal: Deal; className?: string; short?: boolean }) {
  const { lang } = useStore();
  return (
    <span className={`num font-bold whitespace-nowrap ${className}`}>
      {short ? `${shortMoney(n, lang)} ${lang === 'ar' ? 'ريال' : 'SAR'}` : money(n, lang)}
      {deal === 'rent' && <span className="font-medium opacity-70 text-[0.78em]">{lang === 'ar' ? ' / سنة' : ' / yr'}</span>}
    </span>
  );
}

export function IconBtn({ label, onClick, children, tone = 'plain', className = '' }:
  { label: string; onClick?: () => void; children: ReactNode; tone?: 'plain' | 'glass' | 'solid' | 'light'; className?: string }) {
  const t = tone === 'glass' ? 'bg-[#F8F6F1]/92 shadow-[0_2px_10px_rgba(23,43,69,.18)] text-[#172B45]'
    : tone === 'solid' ? 'bg-primary text-onprimary' : tone === 'light' ? 'text-[#F8F6F1] hover:bg-white/10' : 'text-ink hover:bg-band/60';
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={`tap grid place-items-center h-10 w-10 rounded-full shrink-0 ${t} ${className}`}>{children}</button>
  );
}

export function BackIcon({ size = 20 }: { size?: number }) {
  const { lang } = useStore();
  return lang === 'ar' ? <ArrowRight size={size} /> : <ArrowLeft size={size} />;
}

/** App-style top bar: back button, centered title, trailing actions. */
export function AppHeader({ title, sub, back = true, actions, transparent = false }:
  { title?: ReactNode; sub?: ReactNode; back?: boolean; actions?: ReactNode; transparent?: boolean }) {
  const nav = useNav();
  const tx = useTx();
  return (
    <header className={`safe-top shrink-0 z-10 ${transparent ? '' : 'bg-bg/95 backdrop-blur border-b border-line/70'}`}>
      <div className="h-14 px-2 flex items-center gap-1">
        {back ? <IconBtn label={tx('رجوع', 'Back')} onClick={nav.pop}><BackIcon /></IconBtn> : <span className="w-2" />}
        <div className="min-w-0 flex-1 text-center">
          {title && <p className="font-bold text-[16px] truncate leading-tight">{title}</p>}
          {sub && <p className="text-[11.5px] text-muted truncate">{sub}</p>}
        </div>
        <div className="flex items-center min-w-10 justify-end">{actions}</div>
      </div>
    </header>
  );
}

export function Chip({ active, onClick, children, className = '' }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`tap no-select shrink-0 h-9 px-4 rounded-full text-[13.5px] font-semibold inline-flex items-center gap-1.5 border ${active ? 'bg-primary text-onprimary border-primary' : 'bg-surface border-line text-ink'} ${className}`}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, dark = false }: { value: T; options: [T, string][]; onChange: (v: T) => void; dark?: boolean }) {
  return (
    <div className={`grid p-1 rounded-[14px] ${dark ? 'bg-white/10' : 'bg-band/70'}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`tap h-9 rounded-[10px] text-[13.5px] font-semibold ${value === v ? (dark ? 'bg-[#F8F6F1] text-[#172B45]' : 'bg-primary text-onprimary shadow-sm') : dark ? 'text-[#E8DDC9]' : 'text-ink'}`}>{l}</button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const tx = useTx();
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50">
      <div className="backdrop absolute inset-0 bg-[#0F1D30]/45" onClick={onClose} />
      <div className="sheet absolute bottom-0 inset-x-0 max-h-[88%] flex flex-col rounded-t-[26px] bg-bg shadow-[0_-10px_40px_rgba(23,43,69,.25)]">
        <div className="pt-2.5 pb-1 grid place-items-center"><span className="h-1.5 w-10 rounded-full bg-line" /></div>
        <div className="pad flex items-center justify-between pb-2">
          <p className="font-bold text-[17px]">{title}</p>
          <IconBtn label={tx('إغلاق', 'Close')} onClick={onClose}><X size={19} /></IconBtn>
        </div>
        <div className="scroll pad pb-4">{children}</div>
        {footer && <div className="pad pt-3 pb-4 border-t border-line safe-bottom">{footer}</div>}
      </div>
    </div>
  );
}

export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="pad flex items-end justify-between mb-3">
      <h2 className="text-[17px] font-bold">{title}</h2>
      {action && <button type="button" onClick={onAction} className="tap text-[13px] font-semibold text-goldink">{action}</button>}
    </div>
  );
}

export function SimTag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-dashed border-muted/60 px-2 py-0.5 text-[10.5px] font-semibold text-muted whitespace-nowrap">{children}</span>;
}

export function FavHeart({ propertyId, className = '' }: { propertyId: string; className?: string }) {
  const { s, ops, me } = useStore();
  const tx = useTx();
  const on = (s.favorites[me.id] ?? []).includes(propertyId);
  return (
    <IconBtn tone="glass" label={on ? tx('إزالة من المحفوظات', 'Remove from saved') : tx('حفظ', 'Save')} className={`h-9 w-9 ${className}`}
      onClick={() => { void ops.toggleFavorite(propertyId); }}>
      <Heart size={17} className={on ? 'fill-[#B23434] text-[#B23434]' : ''} />
    </IconBtn>
  );
}

/** Large carousel card. */
export function PropertyTile({ g, width = 268 }: { g: Group; width?: number }) {
  const { L, lang } = useStore();
  const nav = useNav();
  const tx = useTx();
  const p = g.property, l = g.best, d = districtById(p.districtId);
  return (
    <div style={{ width }} className="tap relative rounded-[22px] overflow-hidden bg-surface border border-line text-start cursor-pointer"
      role="button" tabIndex={0} onClick={() => nav.push('property', { id: p.id })} onKeyDown={(e) => { if (e.key === 'Enter') nav.push('property', { id: p.id }); }}>
      <div className="relative h-[168px]">
        <PropertyArt type={p.type} seed={l.imageSeed} className="h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#172B45]/70 to-transparent" />
        <span className="absolute top-3 start-3 rounded-full bg-[#172B45]/88 text-[#F8F6F1] px-2.5 py-1 text-[11px] font-semibold">{l.deal === 'sale' ? tx('للبيع', 'For sale') : tx('للإيجار', 'For rent')}</span>
        <FavHeart propertyId={p.id} className="absolute top-2.5 end-2.5" />
        <div className="absolute bottom-2.5 start-3 end-3 flex items-end justify-between gap-2 text-[#F8F6F1]">
          <PriceTag n={l.price} deal={l.deal} className="text-[17px]" short />
          {g.listings.length > 1 && <span className="inline-flex items-center gap-1 rounded-full bg-[#B69B72] text-[#172B45] px-2 py-0.5 text-[11px] font-bold"><Layers size={12} />{num(g.listings.length, lang)} {tx('عروض', 'offers')}</span>}
        </div>
      </div>
      <div className="p-3.5">
        <p className="font-semibold text-[14.5px] truncate">{L(l.title)}</p>
        <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted num">
          <span className="inline-flex items-center gap-1 min-w-0"><MapPin size={13} className="shrink-0" /><span className="truncate">{L(d.name)}</span></span>
          <span className="inline-flex items-center gap-1"><Ruler size={13} />{num(p.area, lang)}{lang === 'ar' ? 'م²' : 'm²'}</span>
          {p.rooms > 0 && <span className="inline-flex items-center gap-1"><BedDouble size={13} />{num(p.rooms, lang)}</span>}
        </div>
      </div>
    </div>
  );
}

/** Compact list row. */
export function PropertyRow({ g, note }: { g: Group; note?: ReactNode }) {
  const { L, lang } = useStore();
  const nav = useNav();
  const tx = useTx();
  const p = g.property, l = g.best, d = districtById(p.districtId);
  return (
    <div role="button" tabIndex={0} onClick={() => nav.push('property', { id: p.id })} onKeyDown={(e) => { if (e.key === 'Enter') nav.push('property', { id: p.id }); }}
      className="tap flex gap-3 rounded-[20px] bg-surface border border-line p-2.5 text-start cursor-pointer">
      <div className="relative h-[104px] w-[112px] shrink-0 rounded-[15px] overflow-hidden">
        <PropertyArt type={p.type} seed={l.imageSeed} className="h-full w-full" />
        {g.listings.length > 1 && <span className="absolute bottom-1.5 start-1.5 inline-flex items-center gap-1 rounded-full bg-[#172B45]/90 text-[#F8F6F1] px-1.5 py-0.5 text-[10.5px] font-semibold"><Layers size={11} className="text-[#B69B72]" />{num(g.listings.length, lang)}</span>}
      </div>
      <div className="min-w-0 flex-1 py-0.5 flex flex-col">
        <div className="flex items-start justify-between gap-1">
          <p className="text-[11.5px] text-muted">{L(TYPE_LABEL[p.type])} · {l.deal === 'sale' ? tx('بيع', 'Sale') : tx('إيجار', 'Rent')}</p>
          <FavHeart propertyId={p.id} className="!h-8 !w-8 -mt-1 -me-1" />
        </div>
        <p className="font-semibold text-[14px] leading-snug line-clamp-2">{L(l.title)}</p>
        <p className="text-[12px] text-muted flex items-center gap-1 mt-0.5"><MapPin size={12} />{L(d.name)}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <PriceTag n={l.price} deal={l.deal} className="text-[14.5px]" />
          <span className="flex items-center gap-2 text-[11.5px] text-muted num">
            {p.rooms > 0 && <span className="inline-flex items-center gap-0.5"><BedDouble size={12} />{num(p.rooms, lang)}</span>}
            {p.baths > 0 && <span className="inline-flex items-center gap-0.5"><Bath size={12} />{num(p.baths, lang)}</span>}
          </span>
        </div>
        {note}
      </div>
    </div>
  );
}

export function Empty({ icon, title, sub, action }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="pad py-14 grid justify-items-center text-center gap-2">
      <span className="grid place-items-center h-16 w-16 rounded-full bg-band text-goldink mb-2">{icon}</span>
      <p className="font-bold">{title}</p>
      {sub && <p className="text-sm text-muted max-w-[30ch]">{sub}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PrimaryBtn({ children, onClick, disabled, tone = 'navy', className = '', type = 'button' }:
  { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: 'navy' | 'gold' | 'ghost' | 'danger' | 'good'; className?: string; type?: 'button' | 'submit' }) {
  const t = { navy: 'bg-primary text-onprimary', gold: 'bg-gold text-[#172B45]', ghost: 'bg-surface border border-line text-ink', danger: 'bg-bad text-white', good: 'bg-good text-white' }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`tap h-[52px] px-5 rounded-[16px] font-bold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none ${t} ${className}`}>{children}</button>
  );
}

// ---------- toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => { setMsg(m); window.setTimeout(() => setMsg((x) => (x === m ? null : x)), 2400); }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="absolute z-[60] inset-x-0 bottom-[calc(var(--sab,env(safe-area-inset-bottom,0px))+96px)] flex justify-center pointer-events-none px-4">
          <div className="tab-in rounded-full bg-[#172B45] text-[#F8F6F1] px-4 py-2.5 text-[13.5px] font-semibold shadow-[0_8px_24px_rgba(23,43,69,.35)]">{msg}</div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
