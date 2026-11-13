import { List, Map as MapIcon, Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { COMMERCIAL, DISTRICTS, TYPE_LABEL } from '../../data/seed';
import { useStore } from '../../lib/store';
import { publicGroups } from '../../lib/selectors';
import { MiniMap } from '../../components/MiniMap';
import { num } from '../../components/ui';
import type { PropertyType } from '../../types';
import { AppHeader, Chip, Empty, IconBtn, PrimaryBtn, PropertyRow, Segmented, Sheet, useTx } from '../kit';

export interface Filters {
  deal?: '' | 'sale' | 'rent'; category?: '' | 'residential' | 'commercial'; type?: '' | PropertyType; district?: string;
  minPrice?: string; maxPrice?: string; minArea?: string; minRooms?: string; sort?: 'new' | 'price_asc' | 'price_desc' | 'offers';
}

function apply(groups: ReturnType<typeof publicGroups>, f: Filters, q: string, L: (x: { ar: string; en: string }) => string) {
  const term = q.trim().toLowerCase();
  const out = groups.map((g) => {
    const ls = g.listings.filter((l) => !f.deal || l.deal === f.deal);
    return { ...g, listings: ls, best: ls[0] };
  }).filter(({ property: p, listings, best }) => {
    if (!listings.length) return false;
    if (f.category === 'commercial' && !COMMERCIAL.includes(p.type)) return false;
    if (f.category === 'residential' && COMMERCIAL.includes(p.type)) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.district && p.districtId !== f.district) return false;
    if (f.minArea && p.area < +f.minArea) return false;
    if (f.minRooms && p.rooms < +f.minRooms) return false;
    if (f.minPrice && best.price < +f.minPrice) return false;
    if (f.maxPrice && best.price > +f.maxPrice) return false;
    if (term && !(`${best.title.ar} ${best.title.en} ${p.landCode ?? ''}`.toLowerCase().includes(term)) && !L(TYPE_LABEL[p.type]).includes(term)) return false;
    return true;
  });
  const sort = f.sort ?? 'new';
  return out.sort((a, b) => sort === 'price_asc' ? a.best.price - b.best.price : sort === 'price_desc' ? b.best.price - a.best.price
    : sort === 'offers' ? b.listings.length - a.listings.length : b.best.createdAt.localeCompare(a.best.createdAt));
}

export function SearchScreen({ root = false, filters: initial = {} }: { root?: boolean; filters?: Filters }) {
  const { s, L, lang } = useStore();
  const tx = useTx();
  const [f, setF] = useState<Filters>({ sort: 'new', ...initial });
  const [draft, setDraft] = useState<Filters>(f);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const groups = useMemo(() => publicGroups(s), [s]);
  const results = useMemo(() => apply(groups, f, q, L), [groups, f, q, L]);
  const preview = useMemo(() => apply(groups, draft, q, L).length, [groups, draft, q, L]);
  const active = Object.entries(f).filter(([k, v]) => k !== 'sort' && v).length;
  const set = (k: keyof Filters, v: string) => setDraft((d) => ({ ...d, [k]: d[k] === v && k !== 'sort' ? '' : v }));
  const quick = (k: keyof Filters, v: string) => setF((d) => ({ ...d, [k]: d[k] === v ? '' : v }));

  return (
    <div className="screen">
      <AppHeader back={!root} title={tx('البحث عن عقار', 'Find a property')} sub={tx(`${num(results.length, lang)} عقار في الرياض`, `${results.length} properties in Riyadh`)}
        actions={<IconBtn label={view === 'list' ? tx('الخريطة', 'Map') : tx('القائمة', 'List')} onClick={() => setView(view === 'list' ? 'map' : 'list')}>{view === 'list' ? <MapIcon size={20} /> : <List size={20} />}</IconBtn>} />
      <div className="pad pt-3 pb-2 flex gap-2 shrink-0">
        <label className="flex-1 h-12 rounded-[16px] bg-surface border border-line flex items-center gap-2 px-3 min-w-0">
          <SearchIcon size={18} className="text-muted shrink-0" />
          <input id="m-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('ابحث بالحي أو النوع أو كود الأرض', 'District, type or land code')} className="min-w-0 flex-1 bg-transparent outline-none text-[14px]" />
          {q && <button type="button" aria-label={tx('مسح', 'Clear')} onClick={() => setQ('')}><X size={16} className="text-muted" /></button>}
        </label>
        <button type="button" onClick={() => { setDraft(f); setOpen(true); }} aria-label={tx('الفلاتر', 'Filters')}
          className="tap relative h-12 w-12 rounded-[16px] bg-primary text-onprimary grid place-items-center">
          <SlidersHorizontal size={19} />
          {active > 0 && <span className="absolute -top-1 -end-1 h-5 min-w-5 px-1 rounded-full bg-gold text-[#172B45] text-[11px] font-bold grid place-items-center num">{num(active, lang)}</span>}
        </button>
      </div>
      <div className="hscroll gap-2 px-[18px] pb-3 shrink-0">
        <Chip active={f.deal === 'sale'} onClick={() => quick('deal', 'sale')}>{tx('للبيع', 'For sale')}</Chip>
        <Chip active={f.deal === 'rent'} onClick={() => quick('deal', 'rent')}>{tx('للإيجار', 'For rent')}</Chip>
        <Chip active={f.sort === 'price_asc'} onClick={() => setF((d) => ({ ...d, sort: d.sort === 'price_asc' ? 'new' : 'price_asc' }))}>{tx('الأقل سعراً', 'Lowest price')}</Chip>
        <Chip active={f.sort === 'offers'} onClick={() => setF((d) => ({ ...d, sort: d.sort === 'offers' ? 'new' : 'offers' }))}>{tx('الأكثر عروضاً', 'Most offers')}</Chip>
        {f.type && <Chip active onClick={() => quick('type', f.type!)}>{L(TYPE_LABEL[f.type])} <X size={13} /></Chip>}
        {f.district && <Chip active onClick={() => quick('district', f.district!)}>{L(DISTRICTS.find((d) => d.id === f.district)!.name)} <X size={13} /></Chip>}
      </div>
      <div className="scroll pb-6">
        {view === 'map' ? (
          <div className="pad grid gap-3">
            <MiniMap groups={results} height={430} />
            <p className="text-[12px] text-muted text-center">{tx('اضغط على أي نقطة لفتح العقار', 'Tap a pin to open the property')}</p>
          </div>
        ) : results.length === 0 ? (
          <Empty icon={<SearchIcon size={26} />} title={tx('لا توجد نتائج', 'No results')} sub={tx('جرّب توسيع نطاق السعر أو اختيار حي آخر.', 'Try a wider price range or another district.')}
            action={<PrimaryBtn tone="ghost" onClick={() => { setF({ sort: 'new' }); setQ(''); }}>{tx('مسح الفلاتر', 'Clear filters')}</PrimaryBtn>} />
        ) : (
          <div className="pad grid gap-3 list-grid">{results.map((g) => <PropertyRow key={g.property.id} g={g} />)}</div>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={tx('الفلاتر', 'Filters')}
        footer={<div className="flex gap-2">
          <PrimaryBtn tone="ghost" onClick={() => setDraft({ sort: draft.sort })}>{tx('مسح', 'Reset')}</PrimaryBtn>
          <PrimaryBtn className="flex-1" onClick={() => { setF(draft); setOpen(false); }}>{tx(`عرض ${num(preview, lang)} نتيجة`, `Show ${preview} results`)}</PrimaryBtn>
        </div>}>
        <div className="grid gap-5">
          <Group label={tx('نوع العرض', 'Deal')}><Segmented value={draft.deal || ''} onChange={(v) => setDraft((d) => ({ ...d, deal: v }))} options={[['', tx('الكل', 'All')], ['sale', tx('شراء', 'Buy')], ['rent', tx('إيجار', 'Rent')]]} /></Group>
          <Group label={tx('التصنيف', 'Category')}><Segmented value={draft.category || ''} onChange={(v) => setDraft((d) => ({ ...d, category: v }))} options={[['', tx('الكل', 'All')], ['residential', tx('سكني', 'Residential')], ['commercial', tx('تجاري', 'Commercial')]]} /></Group>
          <Group label={tx('نوع العقار', 'Property type')}>
            <div className="flex flex-wrap gap-2">{(Object.keys(TYPE_LABEL) as PropertyType[]).map((k) => <Chip key={k} active={draft.type === k} onClick={() => set('type', k)}>{L(TYPE_LABEL[k])}</Chip>)}</div>
          </Group>
          <Group label={tx('الحي', 'District')}>
            <div className="flex flex-wrap gap-2">{DISTRICTS.map((d) => <Chip key={d.id} active={draft.district === d.id} onClick={() => set('district', d.id)}>{L(d.name)}</Chip>)}</div>
          </Group>
          <Group label={tx('السعر (ريال)', 'Price (SAR)')}>
            <div className="grid grid-cols-2 gap-2">
              <input id="m-min" inputMode="numeric" className="field h-12 num" placeholder={tx('من', 'Min')} value={draft.minPrice ?? ''} onChange={(e) => setDraft((d) => ({ ...d, minPrice: e.target.value.replace(/\D/g, '') }))} />
              <input id="m-max" inputMode="numeric" className="field h-12 num" placeholder={tx('إلى', 'Max')} value={draft.maxPrice ?? ''} onChange={(e) => setDraft((d) => ({ ...d, maxPrice: e.target.value.replace(/\D/g, '') }))} />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(draft.deal === 'rent' ? [50000, 100000, 200000] : [1000000, 2000000, 4000000]).map((v) => (
                <Chip key={v} active={draft.maxPrice === String(v)} onClick={() => set('maxPrice', String(v))}>{tx('حتى', 'Up to')} {v >= 1e6 ? `${num(v / 1e6, lang)} ${tx('مليون', 'M')}` : `${num(v / 1000, lang)} ${tx('ألف', 'K')}`}</Chip>
              ))}
            </div>
          </Group>
          <Group label={tx('غرف النوم', 'Bedrooms')}>
            <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((n) => <Chip key={n} active={draft.minRooms === String(n)} onClick={() => set('minRooms', String(n))}>{num(n, lang)}+</Chip>)}</div>
          </Group>
          <Group label={tx('أقل مساحة (م²)', 'Min area (m²)')}>
            <div className="flex flex-wrap gap-2">{[100, 200, 300, 500].map((n) => <Chip key={n} active={draft.minArea === String(n)} onClick={() => set('minArea', String(n))}>{num(n, lang)}+</Chip>)}</div>
          </Group>
        </div>
      </Sheet>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[13px] font-bold mb-2">{label}</p>{children}</div>;
}
