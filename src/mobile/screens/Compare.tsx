// Interactive comparison: either all offers for one property (same land code), or 2–3 saved properties.
import { BadgeCheck, Check, MessageCircle, Trophy } from 'lucide-react';
import { useState } from 'react';
import { districtById, TYPE_LABEL } from '../../data/seed';
import { useStore } from '../../lib/store';
import { nearest } from '../../lib/geo';
import { isPublic } from '../../lib/rules';
import { PropertyArt } from '../../components/PropertyArt';
import { dateFmt, money, num } from '../../components/ui';
import { AppHeader, Chip, PrimaryBtn, useTx } from '../kit';
import { useNav } from '../nav';

export function CompareScreen({ pid, ids }: { pid?: string; ids?: string[] }) {
  return pid ? <OfferCompare pid={pid} /> : <SavedCompare ids={ids ?? []} />;
}

function OfferCompare({ pid }: { pid: string }) {
  const { s, ops, L, lang, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const [sort, setSort] = useState<'price' | 'new'>('price');
  const [picked, setPicked] = useState<string | null>(null);
  const p = s.properties.find((x) => x.id === pid)!;
  const offers = s.listings.filter((l) => l.propertyId === pid && isPublic(s, l))
    .sort((a, b) => (sort === 'price' ? a.price - b.price : b.createdAt.localeCompare(a.createdAt)));
  const prices = offers.map((o) => o.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const pct = (v: number) => `${num(+(((v - lo) / lo) * 100).toFixed(1), lang)}${lang === 'ar' ? '٪' : '%'}`;
  const sel = offers.find((o) => o.id === picked) ?? offers[0];
  const canMessage = me.role !== 'admin' && me.role !== 'supervisor';

  return (
    <div className="screen">
      <AppHeader title={tx('مقارنة العروض', 'Compare offers')} sub={<span className="num">{p.landCode}</span>} />
      <div className="scroll pb-28">
        <div className="pad pt-4 grid gap-4 narrow">
          <div className="rounded-[22px] bg-[#172B45] text-[#F8F6F1] p-4">
            <p className="text-[12.5px] text-[#E8DDC9]/75">{tx('الفرق بين أعلى وأقل عرض', 'Gap between highest and lowest offer')}</p>
            <p className="text-[24px] font-bold num mt-0.5">{money(hi - lo, lang)}</p>
            <p className="text-[12.5px] text-[#B69B72] font-semibold num">{pct(hi)} · {tx(`${num(offers.length, lang)} معلنين`, `${offers.length} advertisers`)}</p>
            <div className="grid gap-2.5 mt-4">
              {offers.map((o) => {
                const a = s.advertisers.find((x) => x.id === o.advertiserId)!;
                const w = 35 + (hi === lo ? 65 : ((o.price - lo) / (hi - lo)) * 65);
                return (
                  <button key={o.id} type="button" onClick={() => setPicked(o.id)} className="tap text-start">
                    <div className="flex justify-between text-[12px] mb-1"><span className="truncate">{L(a.name)}</span><span className="num font-semibold">{money(o.price, lang)}</span></div>
                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${o.price === lo ? 'bg-[#9FE0BF]' : 'bg-[#B69B72]'} ${sel?.id === o.id ? '' : 'opacity-60'}`} style={{ width: `${w}%` }} /></div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Chip active={sort === 'price'} onClick={() => setSort('price')}>{tx('الأقل سعراً', 'Lowest price')}</Chip>
            <Chip active={sort === 'new'} onClick={() => setSort('new')}>{tx('الأحدث', 'Newest')}</Chip>
          </div>
        </div>
        <div className="hscroll gap-3 px-[18px] scroll-px-[18px] mt-4 pb-1">
          {offers.map((o) => {
            const a = s.advertisers.find((x) => x.id === o.advertiserId)!;
            const on = sel?.id === o.id;
            return (
              <button key={o.id} type="button" onClick={() => setPicked(o.id)}
                className={`tap offer-card w-[78%] max-w-[300px] rounded-[22px] bg-surface text-start overflow-hidden border-2 ${on ? 'border-gold shadow-[0_10px_30px_rgba(182,155,114,.25)]' : 'border-line'}`}>
                <div className="relative h-[130px]">
                  <PropertyArt type={p.type} seed={o.imageSeed} className="h-full w-full" />
                  {o.price === lo && <span className="absolute top-2.5 start-2.5 inline-flex items-center gap-1 rounded-full bg-good text-white px-2.5 py-1 text-[11px] font-bold"><Trophy size={12} />{tx('الأقل سعراً', 'Lowest')}</span>}
                  {on && <span className="absolute top-2.5 end-2.5 h-7 w-7 rounded-full bg-gold text-[#172B45] grid place-items-center"><Check size={16} /></span>}
                </div>
                <div className="p-3.5 grid gap-2 text-[13px]">
                  <p className="font-bold flex items-center gap-1 truncate">{L(a.name)}{a.verified === 'verified' && <BadgeCheck size={15} className="text-good shrink-0" />}</p>
                  <Row k={tx('السعر', 'Price')} v={money(o.price, lang)} strong />
                  <Row k={tx('سعر المتر', 'Per m²')} v={money(Math.round(o.price / p.area), lang)} />
                  <Row k={tx('مقارنة بالأقل', 'vs lowest')} v={o.price === lo ? tx('—', '—') : `+${money(o.price - lo, lang)}`} tone={o.price === lo ? 'good' : 'warn'} />
                  <Row k={tx('نوع المعلن', 'Advertiser')} v={a.type === 'company' ? tx('شركة', 'Company') : a.type === 'marketer' ? tx('مسوّق', 'Marketer') : tx('مالك', 'Owner')} />
                  <Row k={tx('الرخصة', 'Licence')} v={a.license ?? tx('غير مطلوبة', 'Not required')} />
                  <Row k={tx('تاريخ النشر', 'Listed')} v={dateFmt(o.createdAt, lang)} />
                  <Row k={tx('المشاهدات', 'Views')} v={num(o.views, lang)} />
                </div>
              </button>
            );
          })}
        </div>
        <p className="pad text-[12px] text-muted mt-3">{tx('لكل معلن صوره ووصفه وسعره. اختر العرض الأنسب ثم راسل صاحبه مباشرة.', 'Each advertiser sets their own photos, description and price. Pick one and message them directly.')}</p>
      </div>
      {sel && (
        <div className="absolute bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line safe-bottom">
          <div className="pad py-3 flex gap-2 narrow">
            <PrimaryBtn tone="ghost" onClick={() => nav.push('property', { id: pid, offer: sel.id })}>{tx('عرض التفاصيل', 'Details')}</PrimaryBtn>
            {canMessage && sel.advertiserId !== me.advertiserId && (
              <PrimaryBtn className="flex-1" onClick={async () => { const c = await ops.startConversation(sel.id, sel.advertiserId); nav.push('chat', { id: c }); }}>
                <MessageCircle size={18} />{tx('راسل هذا المعلن', 'Message this advertiser')}
              </PrimaryBtn>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: 'good' | 'warn' }) {
  return (
    <div className="flex justify-between gap-2 border-b border-line/70 pb-1.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className={`num text-end ${strong ? 'font-bold' : 'font-semibold'} ${tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : ''}`}>{v}</span>
    </div>
  );
}

function SavedCompare({ ids }: { ids: string[] }) {
  const { s, L, lang } = useStore();
  const nav = useNav();
  const tx = useTx();
  const cols = ids.map((id) => {
    const p = s.properties.find((x) => x.id === id)!;
    const ls = s.listings.filter((l) => l.propertyId === id && isPublic(s, l)).sort((a, b) => a.price - b.price);
    return { p, l: ls[0] ?? s.listings.find((l) => l.propertyId === id)!, offers: ls.length };
  }).filter((c) => c.p && c.l);
  const best = (vals: number[], low = true) => (low ? Math.min(...vals) : Math.max(...vals));
  const rows: { k: string; v: (c: typeof cols[0]) => number | string; num?: (c: typeof cols[0]) => number; low?: boolean }[] = [
    { k: tx('السعر', 'Price'), v: (c) => money(c.l.price, lang), num: (c) => c.l.price, low: true },
    { k: tx('سعر المتر', 'Per m²'), v: (c) => money(Math.round(c.l.price / c.p.area), lang), num: (c) => c.l.price / c.p.area, low: true },
    { k: tx('المساحة', 'Area'), v: (c) => `${num(c.p.area, lang)} ${tx('م²', 'm²')}`, num: (c) => c.p.area, low: false },
    { k: tx('الغرف', 'Bedrooms'), v: (c) => (c.p.rooms ? num(c.p.rooms, lang) : '—'), num: (c) => c.p.rooms, low: false },
    { k: tx('دورات المياه', 'Baths'), v: (c) => (c.p.baths ? num(c.p.baths, lang) : '—'), num: (c) => c.p.baths, low: false },
    { k: tx('الحي', 'District'), v: (c) => L(districtById(c.p.districtId).name) },
    { k: tx('النوع', 'Type'), v: (c) => L(TYPE_LABEL[c.p.type]) },
    { k: tx('عدد العروض', 'Offers'), v: (c) => num(c.offers, lang) },
    { k: tx('أقرب مسجد', 'Nearest masjid'), v: (c) => `${num(+nearest(c.p.lat, c.p.lng, 'masjid')!.km.toFixed(1), lang)} ${tx('كم', 'km')}`, num: (c) => nearest(c.p.lat, c.p.lng, 'masjid')!.km, low: true },
    { k: tx('أقرب مدرسة', 'Nearest school'), v: (c) => `${num(+Math.min(nearest(c.p.lat, c.p.lng, 'school_middle')!.km, nearest(c.p.lat, c.p.lng, 'school_high')!.km).toFixed(1), lang)} ${tx('كم', 'km')}`, num: (c) => Math.min(nearest(c.p.lat, c.p.lng, 'school_middle')!.km, nearest(c.p.lat, c.p.lng, 'school_high')!.km), low: true },
  ];
  return (
    <div className="screen">
      <AppHeader title={tx('مقارنة المحفوظات', 'Compare saved')} sub={tx(`${num(cols.length, lang)} عقارات`, `${cols.length} properties`)} />
      <div className="scroll pb-8 narrow">
        <div className="pad pt-4" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))`, gap: 8 }}>
          {cols.map((c) => (
            <button key={c.p.id} type="button" onClick={() => nav.push('property', { id: c.p.id })} className="tap text-start min-w-0">
              <PropertyArt type={c.p.type} seed={c.l.imageSeed} className="h-24 w-full rounded-[14px]" />
              <p className="text-[12px] font-semibold mt-1.5 line-clamp-2 leading-snug">{L(c.l.title)}</p>
            </button>
          ))}
        </div>
        <div className="pad mt-4 grid gap-2">
          {rows.map((r) => {
            const nums = r.num ? cols.map(r.num) : [];
            const winner = r.num && cols.length > 1 ? best(nums, r.low) : null;
            return (
              <div key={r.k} className="rounded-[16px] bg-surface border border-line p-3">
                <p className="text-[11.5px] text-muted mb-1.5">{r.k}</p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))`, gap: 8 }}>
                  {cols.map((c) => {
                    const win = winner !== null && r.num!(c) === winner && new Set(nums).size > 1;
                    return <span key={c.p.id} className={`num text-[13px] font-semibold min-w-0 break-words ${win ? 'text-good' : ''}`}>{r.v(c)}{win && ' ✓'}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="pad text-[12px] text-muted mt-3">{tx('✓ = الأفضل في هذا البند. المسافات من بيانات تجريبية.', '✓ = best on this row. Distances use demo data.')}</p>
      </div>
    </div>
  );
}
