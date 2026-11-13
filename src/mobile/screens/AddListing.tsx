// Add a listing in 3 steps. Uses the same publishing rules as the backend:
// land-code lookup, one live ad per account per land code, grouping with other advertisers' offers.
import { Check, CheckCircle2, KeyRound, Minus, Plus, Search, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DISTRICTS, districtById, FEATURE_LABEL, TYPE_LABEL } from '../../data/seed';
import { useStore } from '../../lib/store';
import { findDuplicate, lookupLandCode, LIVE_STATUSES, type CreateResult } from '../../lib/rules';
import { num, money } from '../../components/ui';
import type { Deal, PropertyType } from '../../types';
import { AppHeader, Chip, PrimaryBtn, Segmented, SimTag, useTx } from '../kit';
import { useNav } from '../nav';

export function AddListingScreen() {
  const { s, ops, L, lang, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const adv = me.advertiserId!;
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [looked, setLooked] = useState<string | null>(null);
  const [noCode, setNoCode] = useState(false);
  const [district, setDistrict] = useState('malqa');
  const [area, setArea] = useState('');
  const [deal, setDeal] = useState<Deal>('sale');
  const [type, setType] = useState<PropertyType>('villa');
  const [rooms, setRooms] = useState(4);
  const [baths, setBaths] = useState(3);
  const [features, setFeatures] = useState<string[]>(['parking']);
  const [price, setPrice] = useState('');
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);

  const samples = useMemo(() => {
    const used = new Set(s.properties.map((p) => p.landCode));
    const free = s.landRegistry.find((r) => !used.has(r.code));
    const join = s.properties.find((p) => p.landCode && p.availability === 'available' && !findDuplicate(s, adv, p.landCode) && s.listings.some((l) => l.propertyId === p.id && l.status === 'active'));
    const mine = s.listings.find((l) => l.advertiserId === adv && (LIVE_STATUSES as readonly string[]).includes(l.status) && s.properties.find((p) => p.id === l.propertyId)?.landCode);
    return [free && [free.code, tx('قطعة جديدة', 'New parcel')], join && [join.landCode!, tx('يعلن عنها آخرون', 'Listed by others')], mine && [s.properties.find((p) => p.id === mine.propertyId)!.landCode!, tx('تعلن عنها مسبقاً', 'You list it')]].filter(Boolean) as [string, string][];
  }, [s, adv, tx]);

  const rec = looked ? lookupLandCode(s, looked) : null;
  const existing = rec ? s.properties.find((p) => p.landCode === rec.code) : undefined;
  const dup = rec ? findDuplicate(s, adv, rec.code) : undefined;
  const others = existing ? s.listings.filter((l) => l.propertyId === existing.id && l.status === 'active') : [];
  const effType = existing?.type ?? type;
  const residential = !['land', 'office', 'shop'].includes(effType);
  const step1ok = noCode ? +area > 0 : !!rec && !dup && existing?.availability !== 'sold' && existing?.availability !== 'rented';
  const lookup = (c = code) => { setCode(c); setLooked(c.trim().toUpperCase()); setNoCode(false); setResult(null); };

  const publish = async (force = false) => {
    setBusy(true);
    const r = await ops.createListing(adv, {
      landCode: noCode ? '' : (looked ?? ''), type: effType, deal, price: force ? (+price || 1) : +price, districtId: rec?.districtId ?? district,
      area: existing?.area ?? rec?.area ?? +area, rooms: residential ? rooms : 0, baths: effType === 'land' ? 0 : baths, features, descAr, descEn,
    });
    setBusy(false); setResult(r);
  };

  if (result?.ok) {
    return (
      <div className="screen">
        <AppHeader title={tx('تم النشر', 'Published')} />
        <div className="scroll pad grid content-center justify-items-center text-center gap-3 pb-16">
          <span className="grid place-items-center h-20 w-20 rounded-full bg-good/15 text-good tab-in"><CheckCircle2 size={44} /></span>
          <p className="text-[22px] font-bold">{tx('إعلانك منشور', 'Your ad is live')}</p>
          <p className="text-[14px] text-muted max-w-[30ch]">{result.joinedExisting ? tx(`انضم إعلانك إلى عقار قائم، ويظهر الآن ضمن ${num(result.otherOffers + 1, lang)} عروض للمقارنة.`, `Your ad joined an existing property and now appears among ${result.otherOffers + 1} offers.`) : tx('أُنشئ سجل العقار وإعلانك.', 'The property record and your ad were created.')}</p>
          <div className="grid gap-2 w-full mt-4">
            <PrimaryBtn onClick={() => { nav.pop(); window.setTimeout(() => nav.push('property', { id: result.listing.propertyId, offer: result.listing.id }), 280); }}>{tx('عرض الإعلان', 'View ad')}</PrimaryBtn>
            <PrimaryBtn tone="ghost" onClick={() => { nav.pop(); nav.setTab('dashboard'); }}>{tx('إعلاناتي', 'My ads')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <AppHeader title={tx('إضافة عقار', 'Add a property')} sub={tx(`الخطوة ${num(step, lang)} من ${num(3, lang)}`, `Step ${step} of 3`)} />
      <div className="pad pt-3 shrink-0 grid grid-cols-3 gap-1.5">{[1, 2, 3].map((n) => <span key={n} className={`h-1.5 rounded-full transition-colors ${n <= step ? 'bg-gold' : 'bg-line'}`} />)}</div>
      <div className="scroll pad py-5 pb-28 grid gap-5 content-start narrow">
        {step === 1 && <>
          <div>
            <p className="text-[19px] font-bold">{tx('رقم كود الأرض', 'Land code')}</p>
            <p className="text-[13px] text-muted mt-1">{tx('نتحقق من القطعة في البوابة المكانية لأمانة الرياض، ونربط إعلانك بالعقار نفسه.', 'We check the parcel in the Riyadh spatial portal and link your ad to the property.')}</p>
            <div className="mt-2"><SimTag>{tx('البوابة المكانية: محاكاة', 'Spatial portal: simulated')}</SimTag></div>
          </div>
          <div className="flex gap-2">
            <label className="flex-1 h-12 rounded-[16px] bg-surface border border-line flex items-center gap-2 px-3 min-w-0">
              <KeyRound size={18} className="text-goldink shrink-0" />
              <input id="m-land" dir="ltr" disabled={noCode} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }} placeholder="DEMO-RYD-10001" className="min-w-0 flex-1 bg-transparent outline-none num uppercase text-[14.5px]" />
            </label>
            <button type="button" aria-label={tx('بحث', 'Look up')} onClick={() => lookup()} disabled={noCode || !code.trim()} className="tap h-12 w-12 rounded-[16px] bg-primary text-onprimary grid place-items-center disabled:opacity-40"><Search size={19} /></button>
          </div>
          <div className="flex flex-wrap gap-2">{samples.map(([c, label]) => <button key={c} type="button" onClick={() => lookup(c)} className="tap rounded-full border border-line bg-surface px-3 py-1.5 text-[12px]"><span className="num font-bold">{c}</span> · {label}</button>)}</div>
          {looked && !noCode && (!rec ? (
            <Note tone="bad" title={tx('رقم كود الأرض غير موجود', 'Land code not found')} body={tx('تحقق من الرقم. لا يختلق مفتاح أي رقم.', 'Check the code. MIFTAH never invents one.')} />
          ) : dup ? (
            <Note tone="bad" title={tx('لديك إعلان حي لنفس رقم كود الأرض', 'You already have a live ad for this land code')} body={tx('يُسمح بإعلان حي واحد لكل عقار لكل حساب. عدّل إعلانك الحالي.', 'One live ad per property per account. Edit your existing ad instead.')}>
              <div className="flex gap-2 mt-2">
                <PrimaryBtn tone="ghost" className="!h-10 text-[13px]" onClick={() => { nav.pop(); nav.setTab('dashboard'); }}>{tx('إدارة إعلاني', 'Manage my ad')}</PrimaryBtn>
                <PrimaryBtn tone="ghost" className="!h-10 text-[13px]" onClick={() => void publish(true)}>{tx('اختبار الرفض من الخادم', 'Test server-side rejection')}</PrimaryBtn>
              </div>
            </Note>
          ) : existing && existing.availability !== 'available' ? (
            <Note tone="bad" title={tx('هذا العقار مُباع أو مؤجَّر', 'This property is already sold or rented')} body="" />
          ) : (
            <Note tone="good" title={`${tx('تم العثور على القطعة', 'Parcel found')} · ${L(districtById(rec.districtId).name)} · ${num(rec.area, lang)} ${tx('م²', 'm²')}`}
              body={existing ? tx(`يعلن عن هذا العقار ${num(others.length, lang)} معلنين. سينضم إعلانك إلى مقارنة الأسعار.`, `${others.length} advertisers list this property. Your ad will join the price comparison.`) : tx('لا توجد إعلانات بعد. سيُنشأ سجل العقار مع إعلانك.', 'No ads yet. A property record is created with your ad.')} />
          ))}
          {result && !result.ok && <Note tone="bad" title={result.error === 'duplicate' ? tx('رفضه الخادم: إعلان مكرر', 'Rejected: duplicate ad') : tx('تعذّر النشر', 'Could not publish')} body={result.error === 'duplicate' ? tx('سُجلت المحاولة لدى الإدارة.', 'The attempt was logged for administrators.') : result.error} />}
          <button type="button" onClick={() => { setNoCode(!noCode); setLooked(null); setResult(null); }} className="tap flex items-center gap-2 text-[13.5px] font-semibold text-start">
            <span className={`h-5 w-5 rounded-[6px] border grid place-items-center ${noCode ? 'bg-primary border-primary text-onprimary' : 'border-line bg-surface'}`}>{noCode && <Check size={13} />}</span>{tx('لا أملك رقم كود الأرض', 'I don’t have a land code')}
          </button>
          {noCode && <>
            <Note tone="warn" title={tx('لن يُربط إعلانك بعروض أخرى', 'Your ad will not be linked')} body={tx('بدون كود أرض لا يمكن تحديد العقار أو مقارنته.', 'Without a land code the property cannot be identified or compared.')} />
            <div><p className="text-[13px] font-bold mb-2">{tx('الحي', 'District')}</p><div className="flex flex-wrap gap-2">{DISTRICTS.map((d) => <Chip key={d.id} active={district === d.id} onClick={() => setDistrict(d.id)}>{L(d.name)}</Chip>)}</div></div>
            <div><p className="text-[13px] font-bold mb-2">{tx('المساحة (م²)', 'Area (m²)')}</p><input id="m-area" inputMode="numeric" className="field h-12 num" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))} /></div>
          </>}
        </>}

        {step === 2 && <>
          <p className="text-[19px] font-bold">{tx('تفاصيل العقار', 'Property details')}</p>
          <div><p className="text-[13px] font-bold mb-2">{tx('نوع العرض', 'Deal')}</p><Segmented value={deal} onChange={setDeal} options={[['sale', tx('للبيع', 'For sale')], ['rent', tx('للإيجار', 'For rent')]]} /></div>
          <div>
            <p className="text-[13px] font-bold mb-2">{tx('نوع العقار', 'Property type')} {existing && <span className="text-muted font-normal">· {tx('من سجل العقار', 'from the property record')}</span>}</p>
            <div className="flex flex-wrap gap-2">{(Object.keys(TYPE_LABEL) as PropertyType[]).map((k) => <Chip key={k} active={effType === k} onClick={() => !existing && setType(k)} className={existing && effType !== k ? 'opacity-40' : ''}>{L(TYPE_LABEL[k])}</Chip>)}</div>
          </div>
          {residential && !existing && <div className="grid grid-cols-2 gap-3">
            <Stepper label={tx('غرف النوم', 'Bedrooms')} v={rooms} set={setRooms} />
            <Stepper label={tx('دورات المياه', 'Baths')} v={baths} set={setBaths} />
          </div>}
          {!existing && <div><p className="text-[13px] font-bold mb-2">{tx('المزايا', 'Features')}</p>
            <div className="flex flex-wrap gap-2">{Object.keys(FEATURE_LABEL).map((f) => <Chip key={f} active={features.includes(f)} onClick={() => setFeatures(features.includes(f) ? features.filter((x) => x !== f) : [...features, f])}>{L(FEATURE_LABEL[f])}</Chip>)}</div></div>}
        </>}

        {step === 3 && <>
          <p className="text-[19px] font-bold">{tx('السعر والوصف', 'Price & description')}</p>
          <div>
            <p className="text-[13px] font-bold mb-2">{deal === 'sale' ? tx('السعر المطلوب (ريال)', 'Asking price (SAR)') : tx('الإيجار السنوي (ريال)', 'Yearly rent (SAR)')}</p>
            <input id="m-price" inputMode="numeric" className="field h-14 num text-[20px] font-bold" placeholder={deal === 'sale' ? '2,500,000' : '75,000'} value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
            {+price > 0 && <p className="text-[12.5px] text-muted mt-1 num">{money(+price, lang)}{others.length > 0 && <> · {tx('أقل عرض حالي', 'Current lowest')} {money(Math.min(...others.map((o) => o.price)), lang)}</>}</p>}
          </div>
          <div><p className="text-[13px] font-bold mb-2">{tx('الوصف بالعربية', 'Description (Arabic)')}</p><textarea id="m-desc-ar" dir="rtl" rows={3} className="field" value={descAr} onChange={(e) => setDescAr(e.target.value)} /></div>
          <div><p className="text-[13px] font-bold mb-2">{tx('الوصف بالإنجليزية', 'Description (English)')}</p><textarea id="m-desc-en" dir="ltr" rows={3} className="field" value={descEn} onChange={(e) => setDescEn(e.target.value)} /></div>
          <div className="rounded-[18px] bg-band/60 p-4 text-[13px] grid gap-1.5">
            <p className="font-bold">{tx('ملخص', 'Summary')}</p>
            <p>{L(TYPE_LABEL[effType])} · {deal === 'sale' ? tx('للبيع', 'For sale') : tx('للإيجار', 'For rent')} · {L(districtById(rec?.districtId ?? district).name)}</p>
            <p className="num">{noCode ? tx('بدون كود أرض', 'No land code') : rec?.code}</p>
            <p className="text-muted">{tx('الصور في النموذج رسوم مولّدة.', 'Photos in the prototype are generated illustrations.')}</p>
          </div>
          {result && !result.ok && <Note tone="bad" title={tx('تعذّر النشر', 'Could not publish')} body={result.error} />}
        </>}
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line safe-bottom">
        <div className="pad py-3 flex gap-2 narrow">
          {step > 1 && <PrimaryBtn tone="ghost" onClick={() => setStep(step - 1)}>{tx('السابق', 'Back')}</PrimaryBtn>}
          {step < 3 ? <PrimaryBtn className="flex-1" disabled={step === 1 && !step1ok} onClick={() => setStep(step + 1)}>{tx('التالي', 'Next')}</PrimaryBtn>
            : <PrimaryBtn className="flex-1" tone="gold" disabled={!(+price > 0) || busy} onClick={() => void publish()}>{busy ? tx('جارٍ النشر…', 'Publishing…') : tx('نشر الإعلان', 'Publish ad')}</PrimaryBtn>}
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, v, set }: { label: string; v: number; set: (n: number) => void }) {
  const { lang } = useStore();
  return (
    <div className="rounded-[16px] bg-surface border border-line p-3">
      <p className="text-[12.5px] text-muted">{label}</p>
      <div className="flex items-center justify-between mt-1.5">
        <button type="button" aria-label="-" onClick={() => set(Math.max(0, v - 1))} className="tap h-9 w-9 rounded-full bg-band grid place-items-center"><Minus size={16} /></button>
        <span className="text-[20px] font-bold num">{num(v, lang)}</span>
        <button type="button" aria-label="+" onClick={() => set(Math.min(15, v + 1))} className="tap h-9 w-9 rounded-full bg-primary text-onprimary grid place-items-center"><Plus size={16} /></button>
      </div>
    </div>
  );
}

function Note({ tone, title, body, children }: { tone: 'good' | 'bad' | 'warn'; title: string; body: string; children?: React.ReactNode }) {
  const c = tone === 'good' ? 'border-good/40 bg-good/10' : tone === 'bad' ? 'border-bad/40 bg-bad/10' : 'border-warn/40 bg-warn/10';
  const Icon = tone === 'good' ? CheckCircle2 : XCircle;
  return (
    <div className={`tab-in rounded-[16px] border p-3.5 ${c}`}>
      <p className="font-bold text-[13.5px] flex items-center gap-1.5"><Icon size={16} className={tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-warn'} />{title}</p>
      {body && <p className="text-[12.5px] text-muted mt-1">{body}</p>}
      {children}
    </div>
  );
}
