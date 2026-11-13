import { ArrowLeft, ArrowRight, Building, Home as HomeIcon, Layers, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DISTRICTS, TYPE_LABEL } from '../data/seed';
import { useStore } from '../lib/store';
import { go } from '../lib/router';
import { publicGroups } from '../lib/selectors';
import { COMMERCIAL } from '../data/seed';
import { Button, SectionTitle, num, money } from '../components/ui';
import { PropertyCard } from '../components/PropertyCard';
import { PropertyArt } from '../components/PropertyArt';
import { setPendingFilters } from './Search';
import { setPendingPrompt } from './Agent';
import type { Deal, PropertyType } from '../types';

export function HomePage() {
  const { s, t, L, lang } = useStore();
  const groups = publicGroups(s);
  const [deal, setDeal] = useState<Deal>('sale');
  const [district, setDistrict] = useState('');
  const [type, setType] = useState<PropertyType | ''>('');
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const featured = groups.filter((g) => g.listings.some((l) => l.featured)).slice(0, 3);
  const sale = groups.filter((g) => g.best.deal === 'sale').slice(0, 4);
  const rent = groups.filter((g) => g.best.deal === 'rent').slice(0, 4);
  const multi = groups.filter((g) => g.listings.length > 1).sort((a, b) => b.listings.length - a.listings.length)[0];
  const resCount = groups.filter((g) => !COMMERCIAL.includes(g.property.type)).length;
  const comCount = groups.length - resCount;

  const search = () => { setPendingFilters({ deal, district, type }); go('search'); };
  const ask = (q: string) => { setPendingPrompt(q); go('agent'); };

  return (
    <div>
      <section className="bg-[#172B45] text-[#F8F6F1]">
        <div className="gutter mx-auto max-w-[1200px] py-10 md:py-14 grid gap-8 lg:grid-cols-[1.2fr_1fr] items-center">
          <div className="min-w-0 rise">
            <p className="text-[#B69B72] text-sm font-semibold tracking-[0.14em] uppercase">{t('hero_eyebrow')}</p>
            <h1 className="mt-3 text-3xl md:text-[44px] font-bold leading-[1.15]">{t('slogan')}</h1>
            <p className="mt-3 text-[#E8DDC9]/85 max-w-[52ch]">{t('hero_sub')}</p>

            <div className="mt-6 rounded-card bg-[#F8F6F1] text-[#172B45] p-3 shadow-card">
              <div className="flex gap-1 mb-3 p-1 rounded-ctl bg-[#E8DDC9]/70 w-fit">
                {(['sale', 'rent'] as Deal[]).map((d) => (
                  <button key={d} type="button" onClick={() => setDeal(d)}
                    className={`press h-8 px-4 rounded-[8px] text-sm font-semibold ${deal === d ? 'bg-[#172B45] text-[#F8F6F1]' : 'text-[#172B45]'}`}>
                    {d === 'sale' ? t('buy') : t('rent')}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <select id="home-district" value={district} onChange={(e) => setDistrict(e.target.value)} className="h-11 rounded-ctl border border-[#E2DBCD] bg-white px-3 text-sm text-[#172B45]">
                  <option value="">{t('all_districts')}</option>
                  {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{L(d.name)}</option>)}
                </select>
                <select id="home-type" value={type} onChange={(e) => setType(e.target.value as PropertyType)} className="h-11 rounded-ctl border border-[#E2DBCD] bg-white px-3 text-sm text-[#172B45]">
                  <option value="">{t('all_types')}</option>
                  {(Object.keys(TYPE_LABEL) as PropertyType[]).map((k) => <option key={k} value={k}>{L(TYPE_LABEL[k])}</option>)}
                </select>
                <button type="button" onClick={search} className="press h-11 px-6 rounded-ctl bg-[#172B45] text-[#F8F6F1] font-semibold inline-flex items-center justify-center gap-2">
                  <Search size={17} />{t('search')}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-[#B69B72]/40 bg-white/[0.04] p-5 min-w-0 rise">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-[#B69B72] text-[#172B45]"><Sparkles size={18} /></span>
              <div>
                <p className="font-bold">{t('agent_title')}</p>
                <p className="text-xs text-[#E8DDC9]/75">{t('agent_demo_note')}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-[#E8DDC9]/90">{t('agent_hero_q')}</p>
            <div className="mt-3 grid gap-2">
              {[t('sample_q1'), t('sample_q2'), t('sample_q3')].map((q) => (
                <button key={q} type="button" onClick={() => ask(q)}
                  className="press text-start rounded-ctl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] px-3 py-2.5 text-[13.5px] flex items-center justify-between gap-3">
                  <span className="min-w-0">{q}</span><Arrow size={16} className="shrink-0 text-[#B69B72]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="gutter mx-auto max-w-[1200px] grid gap-12 py-10">
        <section>
          <SectionTitle title={t('featured_title')} sub={t('featured_sub')} action={<Button variant="secondary" size="sm" onClick={() => go('search')}>{t('view_all')}<Arrow size={15} /></Button>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{featured.map((g) => <PropertyCard key={g.property.id} g={g} />)}</div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { key: 'residential', icon: <HomeIcon size={22} />, title: t('residential'), n: resCount, sub: t('residential_sub') },
            { key: 'commercial', icon: <Building size={22} />, title: t('commercial'), n: comCount, sub: t('commercial_sub') },
          ].map((c) => (
            <button key={c.key} type="button" onClick={() => { setPendingFilters({ category: c.key as 'residential' }); go('search'); }}
              className="press lift text-start rounded-card border border-line bg-surface p-5 flex items-center gap-4 hover:border-gold">
              <span className="grid place-items-center h-12 w-12 rounded-ctl bg-band text-ink">{c.icon}</span>
              <span className="min-w-0">
                <span className="block font-bold text-lg">{c.title}</span>
                <span className="block text-sm text-muted">{c.sub} · <span className="num">{num(c.n, lang)}</span> {t('properties')}</span>
              </span>
              <Arrow size={18} className="ms-auto text-goldink" />
            </button>
          ))}
        </section>

        {multi && (
          <section className="rounded-card bg-band/60 border border-line p-5 md:p-7 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[1fr_1.1fr] items-center">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-goldink text-sm font-bold"><Layers size={16} />{t('compare_eyebrow')}</p>
              <h2 className="mt-2 text-2xl font-bold">{t('compare_title')}</h2>
              <p className="mt-2 text-muted max-w-[55ch]">{t('compare_body')}</p>
              <Button className="mt-4" onClick={() => go(`property-${multi.property.id}`)}>{t('compare_cta')}<Arrow size={16} /></Button>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 min-w-0">
              {multi.listings.map((l, i) => {
                const a = s.advertisers.find((x) => x.id === l.advertiserId)!;
                return (
                  <div key={l.id} className="flex items-center gap-3 rounded-ctl bg-surface border border-line p-2.5">
                    <PropertyArt type={multi.property.type} seed={l.imageSeed} className="h-12 w-16 rounded-[8px] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{L(a.name)}</p>
                      <p className="text-xs text-muted">{t(`adv_${a.type}` as never)}</p>
                    </div>
                    <span className="num font-bold text-sm">{money(l.price, lang)}</span>
                    {i === 0 && <span className="text-[11px] font-bold text-good">{t('lowest')}</span>}
                  </div>
                );
              })}
              <p className="text-xs text-muted break-all">{t('land_code')}: <span className="num font-semibold">{multi.property.landCode}</span> · {t('simulated')}</p>
            </div>
          </section>
        )}

        <section>
          <SectionTitle title={t('for_sale_title')} action={<Button variant="secondary" size="sm" onClick={() => { setPendingFilters({ deal: 'sale' }); go('search'); }}>{t('view_all')}<Arrow size={15} /></Button>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{sale.map((g) => <PropertyCard key={g.property.id} g={g} />)}</div>
        </section>
        <section>
          <SectionTitle title={t('for_rent_title')} action={<Button variant="secondary" size="sm" onClick={() => { setPendingFilters({ deal: 'rent' }); go('search'); }}>{t('view_all')}<Arrow size={15} /></Button>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{rent.map((g) => <PropertyCard key={g.property.id} g={g} />)}</div>
        </section>

        <section className="rounded-card bg-[#172B45] text-[#F8F6F1] p-6 md:p-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <ShieldCheck size={36} className="text-[#B69B72]" />
          <div className="min-w-0 sm:flex-1">
            <h2 className="text-xl font-bold">{t('adv_cta_title')}</h2>
            <p className="text-[#E8DDC9]/85 text-sm mt-1 max-w-[60ch]">{t('adv_cta_body')}</p>
          </div>
          <Button variant="gold" className="w-fit" onClick={() => go('account')}>{t('adv_cta_btn')}</Button>
        </section>
      </div>
    </div>
  );
}
