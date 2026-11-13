import { List, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { COMMERCIAL, DISTRICTS, TYPE_LABEL } from '../data/seed';
import { useStore } from '../lib/store';
import { publicGroups } from '../lib/selectors';
import { Button, Empty, Field, num } from '../components/ui';
import { PropertyCard } from '../components/PropertyCard';
import { MiniMap } from '../components/MiniMap';
import type { Deal, PropertyType } from '../types';

export interface Filters {
  deal?: Deal | ''; category?: 'residential' | 'commercial' | ''; type?: PropertyType | ''; district?: string;
  minPrice?: string; maxPrice?: string; minArea?: string; minRooms?: string; sort?: 'new' | 'price_asc' | 'price_desc' | 'offers';
}
let pending: Filters | null = null;
export const setPendingFilters = (f: Filters) => { pending = f; };

export function SearchPage() {
  const { s, t, L, lang } = useStore();
  const [f, setF] = useState<Filters>(() => { const p = pending ?? {}; pending = null; return { sort: 'new', ...p }; });
  const [view, setView] = useState<'list' | 'map'>('list');
  const [open, setOpen] = useState(false);
  const set = (k: keyof Filters, v: string) => setF((x) => ({ ...x, [k]: v }));

  const results = useMemo(() => {
    let g = publicGroups(s);
    g = g.filter(({ property: p, listings }) => {
      const ls = listings.filter((l) => !f.deal || l.deal === f.deal);
      if (!ls.length) return false;
      if (f.category === 'commercial' && !COMMERCIAL.includes(p.type)) return false;
      if (f.category === 'residential' && COMMERCIAL.includes(p.type)) return false;
      if (f.type && p.type !== f.type) return false;
      if (f.district && p.districtId !== f.district) return false;
      if (f.minArea && p.area < +f.minArea) return false;
      if (f.minRooms && p.rooms < +f.minRooms) return false;
      const price = Math.min(...ls.map((l) => l.price));
      if (f.minPrice && price < +f.minPrice) return false;
      if (f.maxPrice && price > +f.maxPrice) return false;
      return true;
    }).map((x) => {
      const ls = x.listings.filter((l) => !f.deal || l.deal === f.deal);
      return { ...x, listings: ls, best: ls[0] };
    });
    const sorters = {
      new: (a: typeof g[0], b: typeof g[0]) => b.best.createdAt.localeCompare(a.best.createdAt),
      price_asc: (a: typeof g[0], b: typeof g[0]) => a.best.price - b.best.price,
      price_desc: (a: typeof g[0], b: typeof g[0]) => b.best.price - a.best.price,
      offers: (a: typeof g[0], b: typeof g[0]) => b.listings.length - a.listings.length,
    };
    return g.sort(sorters[f.sort ?? 'new']);
  }, [s, f]);

  const active = Object.entries(f).filter(([k, v]) => k !== 'sort' && v).length;

  const panel = (
    <div className="grid gap-4">
      <Field label={t('deal')}>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-ctl bg-band/70">
          {([['', t('all')], ['sale', t('buy')], ['rent', t('rent')]] as const).map(([v, lab]) => (
            <button key={v} type="button" onClick={() => set('deal', v)} className={`press h-8 rounded-[8px] text-[13px] font-semibold ${(f.deal ?? '') === v ? 'bg-primary text-onprimary' : ''}`}>{lab}</button>
          ))}
        </div>
      </Field>
      <Field label={t('category')}>
        <select id="f-cat" className="field" value={f.category ?? ''} onChange={(e) => set('category', e.target.value)}>
          <option value="">{t('all')}</option><option value="residential">{t('residential')}</option><option value="commercial">{t('commercial')}</option>
        </select>
      </Field>
      <Field label={t('property_type')}>
        <select id="f-type" className="field" value={f.type ?? ''} onChange={(e) => set('type', e.target.value)}>
          <option value="">{t('all_types')}</option>
          {(Object.keys(TYPE_LABEL) as PropertyType[]).map((k) => <option key={k} value={k}>{L(TYPE_LABEL[k])}</option>)}
        </select>
      </Field>
      <Field label={t('city')} hint={t('riyadh_only')}>
        <input id="f-city" className="field opacity-70" value={lang === 'ar' ? 'الرياض' : 'Riyadh'} disabled />
      </Field>
      <Field label={t('district')}>
        <select id="f-district" className="field" value={f.district ?? ''} onChange={(e) => set('district', e.target.value)}>
          <option value="">{t('all_districts')}</option>
          {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{L(d.name)}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('min_price')}><input id="f-min" inputMode="numeric" className="field num" placeholder="0" value={f.minPrice ?? ''} onChange={(e) => set('minPrice', e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label={t('max_price')}><input id="f-max" inputMode="numeric" className="field num" placeholder="∞" value={f.maxPrice ?? ''} onChange={(e) => set('maxPrice', e.target.value.replace(/\D/g, ''))} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('min_area')}><input id="f-area" inputMode="numeric" className="field num" placeholder="m²" value={f.minArea ?? ''} onChange={(e) => set('minArea', e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label={t('min_rooms')}>
          <select id="f-rooms" className="field" value={f.minRooms ?? ''} onChange={(e) => set('minRooms', e.target.value)}>
            <option value="">{t('any')}</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{num(n, lang)}+</option>)}
          </select>
        </Field>
      </div>
      <Button variant="secondary" onClick={() => setF({ sort: f.sort })}>{t('clear_filters')}</Button>
    </div>
  );

  return (
    <div className="gutter mx-auto max-w-[1200px] py-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="min-w-0 me-auto">
          <h1 className="text-2xl font-bold">{t('search_title')}</h1>
          <p className="text-sm text-muted"><span className="num">{num(results.length, lang)}</span> {t('properties_found')} · {t('grouped_note')}</p>
        </div>
        <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setOpen(true)}><SlidersHorizontal size={15} />{t('filters')}{active ? ` (${num(active, lang)})` : ''}</Button>
        <select id="f-sort" className="field !w-auto h-8 !py-0 text-[13px]" value={f.sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="new">{t('sort_new')}</option><option value="price_asc">{t('sort_price_asc')}</option>
          <option value="price_desc">{t('sort_price_desc')}</option><option value="offers">{t('sort_offers')}</option>
        </select>
        <div className="flex rounded-ctl border border-line overflow-hidden">
          <button type="button" aria-label={t('list_view')} onClick={() => setView('list')} className={`press h-8 w-9 grid place-items-center ${view === 'list' ? 'bg-primary text-onprimary' : 'bg-surface'}`}><List size={16} /></button>
          <button type="button" aria-label={t('map_view')} onClick={() => setView('map')} className={`press h-8 w-9 grid place-items-center ${view === 'map' ? 'bg-primary text-onprimary' : 'bg-surface'}`}><MapIcon size={16} /></button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-24 rounded-card border border-line bg-surface p-4">{panel}</div></aside>
        <div className="min-w-0">
          {view === 'map' && <div className="mb-5"><MiniMap groups={results} height={420} /></div>}
          {results.length === 0
            ? <Empty title={t('no_results')} sub={t('no_results_sub')} action={<Button variant="secondary" onClick={() => setF({ sort: 'new' })}>{t('clear_filters')}</Button>} />
            : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{results.map((g) => <PropertyCard key={g.property.id} g={g} />)}</div>}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-[18px] bg-surface p-4 gutter rise" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold">{t('filters')}</p>
              <button type="button" aria-label={t('close')} className="press h-8 w-8 grid place-items-center" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {panel}
            <Button className="w-full mt-3" onClick={() => setOpen(false)}>{t('show_results')} ({num(results.length, lang)})</Button>
          </div>
        </div>
      )}
    </div>
  );
}
