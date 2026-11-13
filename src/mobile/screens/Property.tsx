import { BadgeCheck, Bath, BedDouble, Check, Columns3, Flag, Layers, MapPin, MessageCircle, Ruler, ShieldAlert, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { districtById, FEATURE_LABEL, POI_LABEL, TYPE_LABEL } from '../../data/seed';
import { useStore } from '../../lib/store';
import { nearest, POI_ORDER } from '../../lib/geo';
import { isPublic } from '../../lib/rules';
import { PropertyArt } from '../../components/PropertyArt';
import { MiniMap } from '../../components/MiniMap';
import { dateFmt, money, num } from '../../components/ui';
import { BackIcon, Empty, FavHeart, IconBtn, PriceTag, PrimaryBtn, Sheet, SimTag, useToast, useTx } from '../kit';
import { useNav } from '../nav';

export function PropertyScreen({ id, offer }: { id: string; offer?: string }) {
  const { s, ops, L, lang, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const toast = useToast();
  const p = s.properties.find((x) => x.id === id);
  const all = useMemo(() => s.listings.filter((l) => l.propertyId === id), [s.listings, id]);
  const visible = all.filter((l) => isPublic(s, l)).sort((a, b) => a.price - b.price);
  const shown = visible.length ? visible : all;
  const [sel, setSel] = useState(offer ?? shown[0]?.id);
  const [slide, setSlide] = useState(0);
  const [report, setReport] = useState(false);
  const gal = useRef<HTMLDivElement>(null);
  const l = shown.find((x) => x.id === sel) ?? shown[0];
  useEffect(() => { if (l) ops.view(l.id); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [l?.id]);
  if (!p || !l) return <div className="screen"><Empty icon={<ShieldAlert size={26} />} title={tx('العقار غير موجود', 'Property not found')} action={<PrimaryBtn onClick={nav.pop}>{tx('رجوع', 'Back')}</PrimaryBtn>} /></div>;

  const d = districtById(p.districtId);
  const adv = s.advertisers.find((a) => a.id === l.advertiserId)!;
  const lowest = Math.min(...shown.map((x) => x.price));
  const closed = p.availability !== 'available';
  const canMessage = me.role !== 'admin' && me.role !== 'supervisor' && l.advertiserId !== me.advertiserId && !closed;
  const message = async () => { const c = await ops.startConversation(l.id, l.advertiserId); nav.push('chat', { id: c }); };
  const onScroll = () => { const el = gal.current; if (el) setSlide(Math.round(Math.abs(el.scrollLeft) / el.clientWidth)); };

  return (
    <div className="screen">
      <div className="scroll pb-28">
        <div className="relative">
          <div ref={gal} onScroll={onScroll} className="hscroll h-[330px] gallery">
            {[0, 1, 2, 3].map((v) => <div key={v} className="w-full h-full"><PropertyArt type={p.type} seed={l.imageSeed} variant={v} className="h-full w-full" /></div>)}
          </div>
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#172B45]/45 to-transparent pointer-events-none" />
          <div className="absolute top-0 inset-x-0 safe-top">
            <div className="h-14 px-3 flex items-center justify-between">
              <IconBtn tone="glass" label={tx('رجوع', 'Back')} onClick={nav.pop}><BackIcon /></IconBtn>
              <div className="flex gap-2">
                <IconBtn tone="glass" label={tx('مشاركة', 'Share')} onClick={() => { try { void navigator.clipboard.writeText(`${L(l.title)} · ${money(l.price, lang)}`); } catch { /* ignore */ } toast(tx('تم نسخ تفاصيل العقار', 'Property details copied')); }}><Share2 size={18} /></IconBtn>
                <FavHeart propertyId={p.id} className="!h-10 !w-10" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-9 inset-x-0 flex justify-center gap-1.5">{[0, 1, 2, 3].map((v) => <span key={v} className={`h-1.5 rounded-full transition-all ${slide === v ? 'w-5 bg-[#F8F6F1]' : 'w-1.5 bg-[#F8F6F1]/60'}`} />)}</div>
          <span className="absolute bottom-9 end-4 rounded-full bg-[#172B45]/80 text-[#F8F6F1] px-2.5 py-1 text-[11px]">{tx('صور', 'Photos by')} {L(adv.name)}</span>
        </div>

        <div className="relative -mt-6 rounded-t-[28px] bg-bg pt-5 grid grid-cols-1 gap-5 narrow">
          {closed && (
            <div className="pad"><div className="rounded-[16px] bg-warn/10 border border-warn/40 p-3 flex gap-2 text-[13px]"><ShieldAlert size={18} className="text-warn shrink-0" />
              <div><p className="font-bold">{p.availability === 'sold' ? tx('تم البيع، وثّقه مفتاح', 'Sold, verified by MIFTAH') : tx('تم التأجير، وثّقه مفتاح', 'Rented, verified by MIFTAH')}</p><p className="text-muted">{tx('أُغلقت كل إعلانات هذا العقار تلقائياً.', 'All ads for this property were closed automatically.')}</p></div></div></div>
          )}
          <div className="pad">
            <div className="flex items-center gap-2 text-[12.5px] text-muted">
              <span className="rounded-full bg-[#172B45] text-[#F8F6F1] px-2.5 py-0.5 font-semibold">{l.deal === 'sale' ? tx('للبيع', 'For sale') : tx('للإيجار', 'For rent')}</span>
              <span>{L(TYPE_LABEL[p.type])}</span><span>·</span><span className="inline-flex items-center gap-1"><MapPin size={13} />{L(d.name)}، {tx('الرياض', 'Riyadh')}</span>
            </div>
            <h1 className="text-[21px] font-bold leading-snug mt-2">{L(l.title)}</h1>
            <PriceTag n={l.price} deal={l.deal} className="text-[26px] mt-1.5 block" />
          </div>

          <div className="pad grid grid-cols-3 gap-2">
            {[[<Ruler size={17} key="a" />, `${num(p.area, lang)} ${tx('م²', 'm²')}`, tx('المساحة', 'Area')], [<BedDouble size={17} key="b" />, p.rooms ? num(p.rooms, lang) : '—', tx('غرف', 'Bedrooms')], [<Bath size={17} key="c" />, p.baths ? num(p.baths, lang) : '—', tx('دورات مياه', 'Baths')]].map(([icon, v, k], i) => (
              <div key={i} className="rounded-[16px] bg-surface border border-line py-3 grid justify-items-center gap-0.5">
                <span className="text-goldink">{icon}</span><span className="font-bold num text-[15px]">{v}</span><span className="text-[11px] text-muted">{k}</span>
              </div>
            ))}
          </div>

          {shown.length > 1 && (
            <section className="pad">
              <div className="rounded-[22px] bg-[#172B45] text-[#F8F6F1] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold flex items-center gap-2"><Layers size={18} className="text-[#B69B72]" />{tx(`${num(shown.length, lang)} عروض لهذا العقار`, `${shown.length} offers for this property`)}</p>
                  <span className="text-[11px] text-[#E8DDC9]/70 num">{p.landCode}</span>
                </div>
                <p className="text-[12.5px] text-[#E8DDC9]/75 mt-1">{tx('نفس رقم كود الأرض من معلنين مختلفين. اختر عرضاً لرؤية صوره وسعره.', 'Same land code from different advertisers. Pick one to see its photos and price.')}</p>
                <div className="hscroll gap-2 mt-3 -mx-4 px-4">
                  {shown.map((o) => {
                    const a = s.advertisers.find((x) => x.id === o.advertiserId)!;
                    const on = o.id === l.id;
                    return (
                      <button key={o.id} type="button" onClick={() => { setSel(o.id); setSlide(0); gal.current?.scrollTo({ left: 0 }); }}
                        className={`tap w-[150px] rounded-[16px] p-2.5 text-start border ${on ? 'bg-[#F8F6F1] text-[#172B45] border-[#B69B72]' : 'bg-white/[0.06] border-white/15'}`}>
                        <p className="text-[12px] font-semibold truncate">{L(a.name)}</p>
                        <p className="num font-bold text-[14px] mt-0.5">{money(o.price, lang)}</p>
                        <p className={`text-[11px] mt-0.5 font-semibold ${o.price === lowest ? (on ? 'text-good' : 'text-[#9FE0BF]') : on ? 'text-warn' : 'text-[#F2C27B]'}`}>
                          {o.price === lowest ? tx('الأقل سعراً', 'Lowest') : `+${num(+(((o.price - lowest) / lowest) * 100).toFixed(1), lang)}${lang === 'ar' ? '٪' : '%'}`}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <PrimaryBtn tone="gold" className="w-full mt-3 !h-12" onClick={() => nav.push('compare', { pid: p.id })}><Columns3 size={18} />{tx('قارن العروض', 'Compare offers')}</PrimaryBtn>
              </div>
            </section>
          )}

          <section className="pad">
            <div className="rounded-[20px] bg-surface border border-line p-3.5 flex items-center gap-3">
              <span className="grid place-items-center h-12 w-12 rounded-full bg-band font-bold text-[17px]">{L(adv.name).slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate flex items-center gap-1">{L(adv.name)}{adv.verified === 'verified' && <BadgeCheck size={16} className="text-good shrink-0" />}</p>
                <p className="text-[12px] text-muted">{adv.type === 'company' ? tx('شركة عقارية', 'Real estate company') : adv.type === 'marketer' ? tx('مسوّق مرخّص', 'Licensed marketer') : tx('مالك العقار', 'Owner')}{adv.license && <span className="num"> · {adv.license}</span>}</p>
              </div>
            </div>
          </section>

          <section className="pad">
            <h2 className="font-bold text-[16px] mb-2">{tx('الوصف', 'Description')}</h2>
            <p className="text-[14.5px] leading-relaxed text-ink/90">{L(l.desc)}</p>
            {p.features.length > 0 && <div className="flex flex-wrap gap-2 mt-3">{p.features.map((f) => <span key={f} className="inline-flex items-center gap-1 rounded-full bg-band px-3 py-1.5 text-[12.5px] font-semibold"><Check size={13} className="text-goldink" />{L(FEATURE_LABEL[f])}</span>)}</div>}
          </section>

          <section className="pad">
            <div className="flex items-center justify-between mb-2"><h2 className="font-bold text-[16px]">{tx('الخدمات القريبة', 'Nearby')}</h2><SimTag>{tx('بيانات تجريبية', 'Demo data')}</SimTag></div>
            <div className="rounded-[20px] bg-surface border border-line divide-y divide-line">
              {POI_ORDER.map((c) => {
                const n = nearest(p.lat, p.lng, c);
                if (!n) return null;
                return (
                  <div key={c} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1"><p className="text-[11.5px] text-muted">{L(POI_LABEL[c])}</p><p className="text-[13.5px] font-semibold truncate">{L(n.poi.name)}</p></div>
                    <span className={`num text-[13px] font-bold ${n.km <= 1.2 ? 'text-good' : 'text-ink'}`}>{num(+n.km.toFixed(1), lang)} {tx('كم', 'km')}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="pad grid gap-2">
            <MiniMap focus={{ lat: p.lat, lng: p.lng }} height={220} />
            <div className="rounded-[18px] bg-surface border border-line p-3.5 grid grid-cols-2 gap-y-2 text-[12.5px]">
              <span className="text-muted">{tx('رقم كود الأرض', 'Land code')}</span><span className="font-semibold num text-end">{p.landCode ?? tx('غير متوفر', 'Not provided')}</span>
              <span className="text-muted">{tx('الهوية', 'Identity')}</span><span className="text-end">{p.identity === 'simulated_verified' ? <span className="text-good font-semibold">{tx('مرتبط (محاكاة)', 'Linked (simulated)')}</span> : tx('غير محدد', 'Not identified')}</span>
              <span className="text-muted">{tx('رقم ترخيص الإعلان', 'Ad licence')}</span><span className="num text-end">{l.adLicense}</span>
              <span className="text-muted">{tx('تاريخ النشر', 'Listed')}</span><span className="text-end">{dateFmt(l.createdAt, lang)}</span>
            </div>
            <button type="button" onClick={() => setReport(true)} className="tap justify-self-center mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-muted"><Flag size={13} />{tx('الإبلاغ عن الإعلان', 'Report this ad')}</button>
          </section>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line safe-bottom">
        <div className="pad py-3 flex items-center gap-3 narrow">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">{shown.length > 1 ? tx('العرض المختار', 'Selected offer') : tx('السعر', 'Price')}</p>
            <PriceTag n={l.price} deal={l.deal} className="text-[17px]" short />
          </div>
          {canMessage
            ? <>
                <PrimaryBtn tone="ghost" className="!px-4" onClick={() => void message()}><MessageCircle size={18} /><span className="sr-only">{tx('راسل المعلن', 'Message advertiser')}</span></PrimaryBtn>
                <PrimaryBtn className="flex-1" tone="gold" onClick={() => nav.push('pay', { listingId: l.id })}>{l.deal === 'sale' ? tx('احجز الآن', 'Book now') : tx('ادفع الإيجار', 'Pay rent')}</PrimaryBtn>
              </>
            : <PrimaryBtn className="flex-1" tone="ghost" disabled>{closed ? tx('غير متاح', 'Not available') : l.advertiserId === me.advertiserId ? tx('إعلانك', 'Your ad') : tx('للعرض فقط', 'View only')}</PrimaryBtn>}
        </div>
      </div>

      <Sheet open={report} onClose={() => setReport(false)} title={tx('الإبلاغ عن الإعلان', 'Report this ad')}>
        <div className="grid gap-2">
          {[tx('الصور لا تطابق الوصف', 'Photos do not match the description'), tx('العقار لم يعد متاحاً', 'No longer available'), tx('سعر مضلل', 'Misleading price')].map((r) => (
            <button key={r} type="button" onClick={() => { void ops.report(l.id, r); setReport(false); toast(tx('تم إرسال البلاغ للمراجعة', 'Report sent for review')); }} className="tap h-12 rounded-[14px] bg-surface border border-line px-4 text-start font-semibold text-[14px]">{r}</button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
