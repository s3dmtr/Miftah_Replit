import { ArrowLeft, ArrowRight, BadgeCheck, Bath, BedDouble, Check, Flag, Layers, MapPin, MessageCircle, Ruler, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { districtById, FEATURE_LABEL, POI_LABEL, TYPE_LABEL } from '../data/seed';
import { useStore } from '../lib/store';
import { go } from '../lib/router';
import { nearest, POI_ORDER } from '../lib/geo';
import { isPublic } from '../lib/rules';
import { Badge, Button, Card, Empty, Price, dateFmt, money, num } from '../components/ui';
import { PropertyArt } from '../components/PropertyArt';
import { FavButton } from '../components/PropertyCard';
import { MiniMap } from '../components/MiniMap';

export function PropertyPage({ id }: { id: string }) {
  const { s, ops, t, L, lang, me } = useStore();
  const p = s.properties.find((x) => x.id === id);
  const all = useMemo(() => s.listings.filter((l) => l.propertyId === id), [s.listings, id]);
  const visible = all.filter((l) => isPublic(s, l)).sort((a, b) => a.price - b.price);
  const shown = visible.length ? visible : all;
  const [sel, setSel] = useState<string>(() => shown[0]?.id ?? '');
  const [img, setImg] = useState(0);
  const [report, setReport] = useState(false);
  const [reported, setReported] = useState(false);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;

  const l = shown.find((x) => x.id === sel) ?? shown[0];
  useEffect(() => {
    if (!l) return;
    ops.view(l.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l?.id]);

  if (!p || !l) return <div className="gutter mx-auto max-w-[1200px] py-10"><Empty title={t('not_found')} action={<Button onClick={() => go('search')}>{t('nav_search')}</Button>} /></div>;
  const d = districtById(p.districtId);
  const adv = s.advertisers.find((a) => a.id === l.advertiserId)!;
  const lowest = Math.min(...shown.map((x) => x.price));
  const closed = p.availability !== 'available';
  const mine = me.advertiserId && all.find((x) => x.advertiserId === me.advertiserId);

  const message = async (listingId: string, advertiserId: string) => {
    const conv = await ops.startConversation(listingId, advertiserId);
    go(`chat-${conv}`);
  };
  const canMessage = me.role !== 'admin' && me.role !== 'supervisor';

  return (
    <div className="gutter mx-auto max-w-[1200px] py-6 grid gap-6">
      <button type="button" onClick={() => history.length > 1 ? history.back() : go('search')} className="press inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink w-fit">
        <Back size={16} />{t('back')}
      </button>

      {closed && (
        <div className="rounded-card border border-warn/40 bg-warn/10 p-4 flex items-start gap-3">
          <ShieldAlert className="text-warn shrink-0" size={20} />
          <div>
            <p className="font-bold">{p.availability === 'sold' ? t('closed_sold') : t('closed_rented')}</p>
            <p className="text-sm text-muted">{t('closed_body')}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="min-w-0 grid gap-3">
          <div className="relative rounded-card overflow-hidden aspect-[16/10] border border-line">
            <PropertyArt type={p.type} seed={l.imageSeed} variant={img} className="h-full w-full" />
            <div className="absolute top-3 start-3 flex gap-1.5">
              <Badge tone="navy">{l.deal === 'sale' ? t('for_sale') : t('for_rent')}</Badge>
              {l.featured && <Badge className="bg-[#B69B72] text-[#172B45]">{t('featured')}</Badge>}
            </div>
            <FavButton propertyId={p.id} className="absolute top-3 end-3" />
            <span className="absolute bottom-3 end-3 rounded-full bg-[#172B45]/85 text-[#F8F6F1] px-2.5 py-1 text-[11.5px]">{t('photos_by')} {L(adv.name)}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((v) => (
              <button key={v} type="button" onClick={() => setImg(v)} aria-label={`${t('photo')} ${v + 1}`}
                className={`press rounded-[10px] overflow-hidden aspect-[4/3] border-2 ${img === v ? 'border-gold' : 'border-transparent opacity-80'}`}>
                <PropertyArt type={p.type} seed={l.imageSeed} variant={v} className="h-full w-full" />
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 grid gap-4 content-start">
          <div>
            <p className="text-sm text-muted flex items-center gap-1"><MapPin size={14} />{L(d.name)}، {lang === 'ar' ? 'الرياض' : 'Riyadh'}</p>
            <h1 className="text-2xl font-bold mt-1 leading-snug">{L(l.title)}</h1>
            <Price n={l.price} deal={l.deal} lang={lang} className="text-[26px] mt-2 block" />
            {shown.length > 1 && <p className="text-sm text-muted mt-1">{t('offer_from')} {L(adv.name)} · {num(shown.length, lang)} {t('offers_total')}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Fact icon={<Ruler size={16} />} v={`${num(p.area, lang)} ${lang === 'ar' ? 'م²' : 'm²'}`} k={t('area')} />
            <Fact icon={<BedDouble size={16} />} v={p.rooms ? num(p.rooms, lang) : '—'} k={t('rooms')} />
            <Fact icon={<Bath size={16} />} v={p.baths ? num(p.baths, lang) : '—'} k={t('baths')} />
          </div>
          <Card className="p-4 grid gap-3">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-11 w-11 rounded-full bg-band font-bold text-ink">{L(adv.name).slice(0, 1)}</span>
              <div className="min-w-0">
                <p className="font-bold truncate">{L(adv.name)}</p>
                <p className="text-xs text-muted">{t(`adv_${adv.type}` as never)}{adv.license && <> · {t('fal')} <span className="num">{adv.license}</span></>}</p>
              </div>
              {adv.verified === 'verified' && <BadgeCheck size={20} className="ms-auto text-good shrink-0" aria-label={t('verified')} />}
            </div>
            {canMessage && !closed && l.advertiserId !== me.advertiserId && (
              <Button className="w-full" onClick={() => message(l.id, l.advertiserId)}><MessageCircle size={17} />{t('message_advertiser')}</Button>
            )}
            {mine && <p className="text-sm text-goldink font-semibold">{t('you_advertise_this')}</p>}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
              <dt className="text-muted">{t('property_type')}</dt><dd className="font-semibold">{L(TYPE_LABEL[p.type])}</dd>
              <dt className="text-muted">{t('land_code')}</dt><dd className="font-semibold num">{p.landCode ?? t('not_provided')}</dd>
              <dt className="text-muted">{t('identity')}</dt><dd>{p.identity === 'simulated_verified' ? <Badge tone="good">{t('identity_sim')}</Badge> : <Badge tone="demo">{t('identity_none')}</Badge>}</dd>
              <dt className="text-muted">{t('ad_license')}</dt><dd className="num">{l.adLicense}</dd>
              <dt className="text-muted">{t('listed')}</dt><dd>{dateFmt(l.createdAt, lang)}</dd>
            </dl>
          </Card>
        </div>
      </div>

      {/* Offer comparison */}
      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Layers size={19} className="text-goldink" />{t('offers_title')} ({num(shown.length, lang)})</h2>
            <p className="text-sm text-muted">{p.identity === 'simulated_verified' ? t('offers_sub') : t('offers_sub_none')}</p>
          </div>
        </div>
        <div className="scroll-x rounded-card border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-band/60 text-start">
              <tr className="text-[12px] uppercase tracking-wider text-muted">
                <th className="text-start font-semibold p-3">{t('advertiser')}</th>
                <th className="text-start font-semibold p-3">{t('photos')}</th>
                <th className="text-start font-semibold p-3">{t('price')}</th>
                <th className="text-start font-semibold p-3">{t('per_m2')}</th>
                <th className="text-start font-semibold p-3">{t('vs_lowest')}</th>
                <th className="text-start font-semibold p-3">{t('listed')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const a = s.advertisers.find((x) => x.id === o.advertiserId)!;
                const diff = o.price - lowest;
                const isSel = o.id === l.id;
                return (
                  <tr key={o.id} className={`border-t border-line ${isSel ? 'bg-gold/10' : ''}`}>
                    <td className="p-3">
                      <p className="font-semibold flex items-center gap-1">{L(a.name)}{a.verified === 'verified' && <BadgeCheck size={14} className="text-good" />}</p>
                      <p className="text-xs text-muted">{t(`adv_${a.type}` as never)}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">{[0, 1].map((v) => <PropertyArt key={v} type={p.type} seed={o.imageSeed} variant={v} className="h-9 w-12 rounded-[6px]" />)}</div>
                    </td>
                    <td className="p-3"><Price n={o.price} deal={o.deal} lang={lang} /></td>
                    <td className="p-3 num text-muted">{money(Math.round(o.price / p.area), lang)}</td>
                    <td className="p-3 num">{diff === 0 ? <Badge tone="good"><Check size={12} />{t('lowest')}</Badge> : <span className="text-warn font-semibold">+{money(diff, lang)} ({num(+((diff / lowest) * 100).toFixed(1), lang)}{lang === 'ar' ? '٪' : '%'})</span>}</td>
                    <td className="p-3 text-muted">{dateFmt(o.createdAt, lang)}</td>
                    <td className="p-3">
                      <div className="flex gap-1.5 justify-end">
                        <Button size="sm" variant={isSel ? 'gold' : 'secondary'} onClick={() => { setSel(o.id); setImg(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{isSel ? t('viewing') : t('view_offer')}</Button>
                        {canMessage && !closed && o.advertiserId !== me.advertiserId && <Button size="sm" variant="ghost" aria-label={t('message_advertiser')} onClick={() => message(o.id, o.advertiserId)}><MessageCircle size={15} /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="min-w-0 grid gap-6 content-start">
          <section>
            <h2 className="text-lg font-bold mb-2">{t('description')}</h2>
            <p className="text-[15px] leading-relaxed max-w-[68ch]">{L(l.desc)}</p>
            {p.features.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">{p.features.map((f) => <Badge key={f}><Check size={12} />{L(FEATURE_LABEL[f])}</Badge>)}</div>
            )}
          </section>
          <section>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-bold">{t('nearby')}</h2><Badge tone="demo">{t('demo_data')}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {POI_ORDER.map((c) => {
                const n = nearest(p.lat, p.lng, c);
                if (!n) return null;
                return (
                  <div key={c} className="flex items-center gap-3 rounded-ctl border border-line bg-surface p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">{L(POI_LABEL[c])}</p>
                      <p className="text-sm font-semibold truncate">{L(n.poi.name)}</p>
                    </div>
                    <span className={`num text-sm font-bold ${n.km <= 1.2 ? 'text-good' : n.km <= 3 ? 'text-ink' : 'text-muted'}`}>{num(+n.km.toFixed(1), lang)} {lang === 'ar' ? 'كم' : 'km'}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <div className="min-w-0 grid gap-3 content-start">
          <MiniMap focus={{ lat: p.lat, lng: p.lng }} height={300} />
          <a className="text-sm text-goldink font-semibold hover:underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.name.en}, Riyadh`)}`} target="_blank" rel="noreferrer">{t('open_maps')}</a>
          {!reported ? (
            report ? (
              <Card className="p-3 grid gap-2">
                <p className="text-sm font-semibold">{t('report_reason')}</p>
                {[t('report_r1'), t('report_r2'), t('report_r3')].map((r) => (
                  <Button key={r} size="sm" variant="secondary" className="justify-start" onClick={() => {
                    void ops.report(l.id, r);
                    setReported(true);
                  }}>{r}</Button>
                ))}
              </Card>
            ) : <Button variant="ghost" size="sm" className="w-fit text-muted" onClick={() => setReport(true)}><Flag size={14} />{t('report_ad')}</Button>
          ) : <p className="text-sm text-good font-semibold">{t('reported')}</p>}
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, v, k }: { icon: React.ReactNode; v: string; k: string }) {
  return (
    <div className="rounded-ctl border border-line bg-surface py-2.5">
      <div className="flex justify-center text-goldink">{icon}</div>
      <p className="num font-bold mt-1">{v}</p>
      <p className="text-[11.5px] text-muted">{k}</p>
    </div>
  );
}
