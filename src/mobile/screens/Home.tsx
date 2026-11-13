import { Bell, Building, Building2, Home as HomeIcon, KeyRound, Landmark, LayoutGrid, MapPin, Plus, Sparkles, Store, Warehouse } from 'lucide-react';
import { useState } from 'react';
import { DISTRICTS } from '../../data/seed';
import { SNAPSHOT_AT } from '../../data/snapshot';
import { useStore } from '../../lib/store';
import { publicGroups } from '../../lib/selectors';
import { num, dateFmt } from '../../components/ui';
import type { Deal, PropertyType } from '../../types';
import { IconBtn, PropertyRow, PropertyTile, SectionHead, Segmented, SimTag, useTx } from '../kit';
import { useNav } from '../nav';
import { setAgentPrompt } from './Agent';

const CATS: [PropertyType, typeof HomeIcon, string, string][] = [
  ['villa', HomeIcon, 'فلل', 'Villas'], ['apartment', Building2, 'شقق', 'Flats'], ['floor', LayoutGrid, 'أدوار', 'Floors'],
  ['land', Landmark, 'أراضٍ', 'Land'], ['office', Building, 'مكاتب', 'Offices'], ['shop', Store, 'محلات', 'Shops'],
];

export function HomeScreen() {
  const { s, L, lang, me, remote } = useStore();
  const nav = useNav();
  const tx = useTx();
  const [deal, setDeal] = useState<Deal>('sale');
  const groups = publicGroups(s);
  const forDeal = groups.map((g) => ({ ...g, listings: g.listings.filter((l) => l.deal === deal) }))
    .filter((g) => g.listings.length).map((g) => ({ ...g, best: g.listings[0] }));
  const multi = forDeal.filter((g) => g.listings.length > 1).sort((a, b) => b.listings.length - a.listings.length);
  const featured = forDeal.filter((g) => g.listings.some((l) => l.featured));
  const latest = [...forDeal].sort((a, b) => b.best.createdAt.localeCompare(a.best.createdAt)).slice(0, 6);
  const unread = s.notices.filter((n) => (n.to === me.id || n.to === me.advertiserId) && !n.read).length;
  const isAdv = !!me.advertiserId;
  const hour = new Date().getHours();
  const greet = hour < 12 ? tx('صباح الخير', 'Good morning') : tx('مساء الخير', 'Good evening');
  const firstName = L(me.name).split(/[ (]/)[0];
  const districtCounts = DISTRICTS.map((d) => ({ d, n: forDeal.filter((g) => g.property.districtId === d.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 8);

  const openSearch = (filters: Record<string, string>) => nav.push('search', { filters: { deal, ...filters } });
  const ask = (q?: string) => { if (q) setAgentPrompt(q); nav.setTab('ai'); };

  return (
    <div className="scroll">
      <section className="bg-[#172B45] text-[#F8F6F1] rounded-b-[32px] safe-top pb-6 relative overflow-hidden">
        <svg className="absolute -top-10 -end-16 opacity-[.07]" width="260" height="260" viewBox="0 0 24 24" fill="none" stroke="#E8DDC9" strokeWidth="1"><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" /></svg>
        <div className="pad pt-3 flex items-center gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-full bg-[#B69B72]/25 border border-[#B69B72]/50 text-[#E8DDC9] font-bold">{L(me.name).slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-[#E8DDC9]/75">{greet}</p>
            <p className="font-bold text-[16px] truncate">{firstName}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 h-8 text-[12.5px] font-semibold"><MapPin size={14} className="text-[#B69B72]" />{tx('الرياض', 'Riyadh')}</span>
          <IconBtn tone="light" label={tx('الإشعارات', 'Notifications')} onClick={() => nav.push('notifications')} className="relative">
            <Bell size={20} />{unread > 0 && <span className="absolute top-2 end-2 h-2.5 w-2.5 rounded-full bg-[#B69B72] ring-2 ring-[#172B45]" />}
          </IconBtn>
        </div>
        <div className="pad mt-5">
          <h1 className="text-[26px] font-bold leading-tight">{tx('عقارك يبدأ', 'Your property starts')} <span className="text-[#B69B72]">{tx('بمفتاح', 'with Miftah')}</span></h1>
          <p className="text-[13px] text-[#E8DDC9]/75 mt-1">{tx('كل عروض العقار الواحد في مكان واحد', 'Every offer for a property, in one place')}</p>
        </div>
        <div className="pad mt-4">
          <button type="button" onClick={() => ask()} className="tap w-full h-[54px] rounded-[18px] bg-[#F8F6F1] text-[#172B45] flex items-center gap-3 px-4 text-start shadow-[0_8px_24px_rgba(0,0,0,.18)]">
            <span className="grid place-items-center h-8 w-8 rounded-full bg-[#B69B72] text-[#172B45]"><Sparkles size={16} /></span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-[#5C6A7A]">{tx('اسأل مفتاح: فيلا في الملقا بحدود ٤ مليون…', 'Ask Miftah: villa in Al Malqa under 4M…')}</span>
          </button>
          <div className="hscroll gap-2 mt-3 -mx-[18px] px-[18px]">
            {[tx('شقة للإيجار شمال الرياض حدود ٧٠ ألف', 'Apartment for rent in north Riyadh up to 70K'), tx('فيلا للشراء قريبة من مسجد ومدرسة', 'Villa to buy near a masjid and school'), tx('مكتب للإيجار في العليا', 'Office for rent in Al Olaya')].map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} className="tap h-8 px-3 rounded-full border border-white/15 bg-white/[0.06] text-[12.5px] text-[#E8DDC9] whitespace-nowrap">{q}</button>
            ))}
          </div>
        </div>
        <div className="pad mt-4"><Segmented dark value={deal} onChange={setDeal} options={[['sale', tx('شراء', 'Buy')], ['rent', tx('إيجار', 'Rent')]]} /></div>
      </section>

      <div className="grid grid-cols-1 gap-7 py-6">
        <div className="pad grid grid-cols-6 gap-1.5">
          {CATS.map(([type, Icon, ar, en]) => (
            <button key={type} type="button" onClick={() => openSearch({ type })} className="tap grid justify-items-center gap-1.5 py-1">
              <span className="grid place-items-center h-12 w-12 rounded-[16px] bg-surface border border-line text-ink"><Icon size={20} /></span>
              <span className="text-[11.5px] font-semibold truncate max-w-full">{tx(ar, en)}</span>
            </button>
          ))}
        </div>

        {isAdv && (
          <div className="pad">
            <button type="button" onClick={() => nav.push('add')} className="tap w-full rounded-[20px] bg-band p-4 flex items-center gap-3 text-start">
              <span className="grid place-items-center h-11 w-11 rounded-[14px] bg-[#172B45] text-[#B69B72]"><Plus size={22} /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold">{tx('أضف عقاراً جديداً', 'Add a new property')}</span><span className="block text-[12.5px] text-muted">{tx('برقم كود الأرض، مع منع التكرار تلقائياً', 'By land code, with automatic duplicate checks')}</span></span>
              <KeyRound size={18} className="text-goldink" />
            </button>
          </div>
        )}

        {multi.length > 0 && (
          <section>
            <SectionHead title={tx('عقار واحد، عدة عروض', 'One property, several offers')} action={tx('عرض الكل', 'See all')} onAction={() => openSearch({ sort: 'offers' })} />
            <p className="pad -mt-2 mb-3 text-[12.5px] text-muted">{tx('قارن أسعار المعلنين لنفس رقم كود الأرض', 'Compare advertisers on the same land code')}</p>
            <div className="hscroll gap-3 px-[18px] scroll-px-[18px]">{multi.map((g) => <PropertyTile key={g.property.id} g={g} />)}</div>
          </section>
        )}

        {featured.length > 0 && (
          <section>
            <SectionHead title={tx('عقارات مميزة', 'Featured')} />
            <div className="hscroll gap-3 px-[18px] scroll-px-[18px]">{featured.map((g) => <PropertyTile key={g.property.id} g={g} width={240} />)}</div>
          </section>
        )}

        <section>
          <SectionHead title={tx('أحياء رائجة', 'Popular districts')} />
          <div className="hscroll gap-2 px-[18px]">
            {districtCounts.map(({ d, n }) => (
              <button key={d.id} type="button" onClick={() => openSearch({ district: d.id })} className="tap h-10 px-4 rounded-full bg-surface border border-line text-[13px] font-semibold whitespace-nowrap">
                {L(d.name)} <span className="text-muted num">· {num(n, lang)}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionHead title={tx('أحدث العقارات', 'Latest listings')} action={tx('الكل', 'All')} onAction={() => openSearch({})} />
          <div className="pad grid gap-3 list-grid">{latest.map((g) => <PropertyRow key={g.property.id} g={g} />)}</div>
        </section>

        <div className="pad">
          <div className="rounded-[18px] border border-dashed border-line p-4 flex gap-3 items-start">
            <Warehouse size={18} className="text-goldink shrink-0 mt-0.5" />
            <div className="text-[12px] text-muted leading-relaxed">
              <p className="font-semibold text-ink mb-1">{remote ? tx('متصل بخادم مفتاح', 'Connected to the MIFTAH server') : tx('بيانات من قاعدة بيانات مفتاح', 'Data from the MIFTAH database')}</p>
              {remote ? tx('الإعلانات والرسائل تُحفظ في PostgreSQL مباشرة.', 'Ads and messages are saved to PostgreSQL directly.')
                : <>{tx('نسخة من PostgreSQL', 'PostgreSQL snapshot')}{SNAPSHOT_AT ? ` · ${dateFmt(SNAPSHOT_AT, lang)}` : ''}. {tx('التغييرات في هذا العرض تُحفظ على جهازك فقط.', 'Changes in this demo are kept on this device only.')}</>}
              <div className="flex flex-wrap gap-1.5 mt-2"><SimTag>{tx('عقارات ومكاتب وهمية', 'Fictional properties')}</SimTag><SimTag>{tx('كود الأرض: محاكاة', 'Land codes: simulated')}</SimTag></div>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-muted -mt-3">{tx('عقارك يبدأ بمفتاح', 'Your property starts with Miftah')}</p>
      </div>
    </div>
  );
}
