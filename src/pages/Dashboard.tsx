import { AlertTriangle, BadgeCheck, CheckCircle2, Eye, Layers, MessageCircle, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DISTRICTS, districtById, FEATURE_LABEL, TYPE_LABEL } from '../data/seed';
import { useStore } from '../lib/store';
import { go } from '../lib/router';
import { commission, findDuplicate, lookupLandCode, LIVE_STATUSES, ASSUMED_BROKERAGE, type CreateResult } from '../lib/rules';
import { Badge, Button, Card, Empty, Field, Price, SectionTitle, dateFmt, money, num } from '../components/ui';
import { PropertyArt } from '../components/PropertyArt';
import type { Deal, Listing, PropertyType } from '../types';

type Tab = 'ads' | 'new' | 'inquiries' | 'fees' | 'account';

export function StatusBadge({ l }: { l: Listing }) {
  const { t } = useStore();
  if (l.status === 'active') return <Badge tone="good">{t('status_active')}</Badge>;
  if (l.status === 'paused') return <Badge>{t('status_paused')}</Badge>;
  if (l.status === 'under_review') return <Badge tone="warn">{t('status_review')}</Badge>;
  return <Badge tone="bad">{l.closedReason === 'sold' ? t('status_sold') : l.closedReason === 'rented' ? t('status_rented') : t('status_removed')}</Badge>;
}

export function DashboardPage() {
  const { s, t, lang, me, L } = useStore();
  const [tab, setTab] = useState<Tab>('ads');
  const adv = s.advertisers.find((a) => a.id === me.advertiserId);
  if (!adv) return <div className="gutter mx-auto max-w-[1200px] py-6"><Empty title={t('adv_only')} action={<Button onClick={() => go('account')}>{t('adv_cta_btn')}</Button>} /></div>;
  const mine = s.listings.filter((l) => l.advertiserId === adv.id);
  const live = mine.filter((l) => (LIVE_STATUSES as readonly string[]).includes(l.status));
  const views = mine.reduce((a, l) => a + l.views, 0);
  const inquiries = s.conversations.filter((c) => c.advertiserId === adv.id);
  const competing = live.filter((l) => s.listings.some((o) => o.propertyId === l.propertyId && o.advertiserId !== adv.id && o.status === 'active')).length;

  const tabs: [Tab, string][] = [['ads', t('my_ads')], ['new', t('new_ad')], ['inquiries', t('inquiries')], ['fees', t('fees_tab')], ['account', t('account_licence')]];

  return (
    <div className="gutter mx-auto max-w-[1200px] py-6 grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 me-auto">
          <p className="text-sm text-muted">{t(`adv_${adv.type}` as never)}</p>
          <h1 className="text-2xl font-bold flex items-center gap-2">{L(adv.name)}{adv.verified === 'verified' && <BadgeCheck className="text-good" size={20} />}</h1>
        </div>
        <Button onClick={() => setTab('new')}><Plus size={16} />{t('new_ad')}</Button>
      </div>
      {adv.verified !== 'verified' && (
        <div className="rounded-card border border-warn/40 bg-warn/10 p-4 text-sm flex gap-2"><AlertTriangle size={18} className="text-warn shrink-0" />{t('pending_verification')}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat k={t('live_ads')} v={num(live.length, lang)} />
        <Stat k={t('total_views')} v={num(views, lang)} icon={<Eye size={16} />} />
        <Stat k={t('inquiries')} v={num(inquiries.length, lang)} icon={<MessageCircle size={16} />} />
        <Stat k={t('competing_ads')} v={num(competing, lang)} icon={<Layers size={16} />} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`press relative shrink-0 px-3.5 h-10 text-sm font-semibold ${tab === id ? 'text-ink' : 'text-muted'}`}>
            {label}{tab === id && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gold" />}
          </button>
        ))}
      </div>

      {tab === 'ads' && <MyAds advertiserId={adv.id} onNew={() => setTab('new')} />}
      {tab === 'new' && <NewAd advertiserId={adv.id} onDone={() => setTab('ads')} />}
      {tab === 'inquiries' && (
        inquiries.length ? (
          <div className="grid gap-2">
            {inquiries.map((c) => {
              const l = s.listings.find((x) => x.id === c.listingId)!;
              const last = c.messages[c.messages.length - 1];
              return (
                <a key={c.id} href={`#chat-${c.id}`} className="press flex items-center gap-3 rounded-ctl border border-line bg-surface p-3">
                  <MessageCircle size={18} className="text-goldink" />
                  <div className="min-w-0 flex-1"><p className="font-semibold truncate">{L(l.title)}</p><p className="text-xs text-muted truncate">{last?.text ?? t('no_messages_yet')}</p></div>
                  <span className="text-xs text-muted">{num(c.messages.length, lang)}</span>
                </a>
              );
            })}
          </div>
        ) : <Empty title={t('no_inquiries')} />
      )}
      {tab === 'fees' && <Fees type={adv.type} />}
      {tab === 'account' && (
        <Card className="p-5 grid gap-3 max-w-xl">
          <Row k={t('account_type')} v={t(`adv_${adv.type}` as never)} />
          <Row k={t('fal')} v={adv.license ?? t('not_required_owner')} />
          <Row k={t('verification')} v={adv.verified === 'verified' ? t('verified') : t('pending')} />
          <Row k={t('joined')} v={dateFmt(adv.joined, lang)} />
          <p className="text-xs text-muted">{t('licence_note')}</p>
        </Card>
      )}
    </div>
  );
}

function Stat({ k, v, icon }: { k: string; v: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs text-muted flex items-center gap-1.5">{icon}{k}</p>
      <p className="text-2xl font-bold num mt-1">{v}</p>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4 text-sm border-b border-line pb-2"><span className="text-muted">{k}</span><span className="font-semibold num text-end">{v}</span></div>;
}

function MyAds({ advertiserId, onNew }: { advertiserId: string; onNew: () => void }) {
  const { s, ops, t, L, lang } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [closing, setClosing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const mine = s.listings.filter((l) => l.advertiserId === advertiserId);
  if (!mine.length) return <Empty title={t('no_ads')} action={<Button onClick={onNew}><Plus size={16} />{t('new_ad')}</Button>} />;
  return (
    <div className="grid gap-3">
      {mine.map((l) => {
        const p = s.properties.find((x) => x.id === l.propertyId)!;
        const others = s.listings.filter((o) => o.propertyId === p.id && o.id !== l.id && o.status === 'active');
        const lowestOther = others.length ? Math.min(...others.map((o) => o.price)) : null;
        const pending = s.statusRequests.find((r) => r.listingId === l.id && r.state === 'pending');
        return (
          <Card key={l.id} className="p-3 grid gap-3 sm:grid-cols-[120px_1fr] items-start">
            <PropertyArt type={p.type} seed={l.imageSeed} className="h-24 sm:h-[84px] w-full rounded-[10px]" />
            <div className="min-w-0 grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <a href={`#property-${p.id}`} className="font-semibold hover:underline min-w-0 truncate">{L(l.title)}</a>
                <StatusBadge l={l} />
                {p.landCode ? <Badge tone="demo">{p.landCode}</Badge> : <Badge tone="demo">{t('no_land_code')}</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <Price n={l.price} deal={l.deal} lang={lang} />
                <span className="text-muted inline-flex items-center gap-1 num"><Eye size={14} />{num(l.views, lang)} {t('visits')}</span>
                {others.length > 0 && (
                  <span className="text-muted inline-flex items-center gap-1"><Layers size={14} />{num(others.length, lang)} {t('competing')}
                    {lowestOther !== null && <span className={lowestOther < l.price ? 'text-warn font-semibold' : 'text-good font-semibold'}>· {t('lowest_other')} {money(lowestOther, lang)}</span>}
                  </span>
                )}
              </div>
              {pending && <p className="text-xs text-warn">{t('awaiting_verification')}</p>}
              {editing === l.id ? (
                <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const v = +price; if (v > 0) void ops.updateListing(l.id, { price: v }); setEditing(null); }}>
                  <input id={`price-${l.id}`} inputMode="numeric" className="field !w-40 h-8 num" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
                  <Button size="sm" type="submit">{t('save')}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Button>
                </form>
              ) : closing === l.id ? (
                <form className="grid gap-2 rounded-ctl bg-band/50 p-3" onSubmit={(e) => { e.preventDefault(); void ops.requestStatus(l.id, l.deal === 'sale' ? 'sold' : 'rented', +value || l.price); setClosing(null); }}>
                  <p className="text-sm font-semibold">{l.deal === 'sale' ? t('report_sold') : t('report_rented')}</p>
                  <p className="text-xs text-muted">{t('report_status_note')}</p>
                  <Field label={l.deal === 'sale' ? t('final_price') : t('final_rent')}>
                    <input id={`val-${l.id}`} inputMode="numeric" className="field !w-48 h-9 num" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} />
                  </Field>
                  <div className="flex gap-2"><Button size="sm" type="submit">{t('submit_review')}</Button><Button size="sm" variant="ghost" onClick={() => setClosing(null)}>{t('cancel')}</Button></div>
                </form>
              ) : l.status !== 'closed' && (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(l.id); setPrice(String(l.price)); }}>{t('edit_price')}</Button>
                  {l.status === 'active' && <Button size="sm" variant="secondary" onClick={() => void ops.updateListing(l.id, { status: 'paused' })}>{t('pause')}</Button>}
                  {l.status === 'paused' && <Button size="sm" variant="secondary" onClick={() => void ops.updateListing(l.id, { status: 'active' })}>{t('resume')}</Button>}
                  {l.status !== 'under_review' && <Button size="sm" variant="secondary" onClick={() => { setClosing(l.id); setValue(String(l.price)); }}>{l.deal === 'sale' ? t('report_sold') : t('report_rented')}</Button>}
                  {l.status !== 'under_review' && <Button size="sm" variant="ghost" className="text-bad" onClick={() => void ops.removeListing(l.id)}>{t('remove')}</Button>}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function NewAd({ advertiserId, onDone }: { advertiserId: string; onDone: () => void }) {
  const { s, ops, t, L, lang } = useStore();
  const [code, setCode] = useState('');
  const [looked, setLooked] = useState<string | null>(null);
  const [noCode, setNoCode] = useState(false);
  const [type, setType] = useState<PropertyType>('apartment');
  const [deal, setDeal] = useState<Deal>('sale');
  const [price, setPrice] = useState('');
  const [district, setDistrict] = useState('malqa');
  const [area, setArea] = useState('');
  const [rooms, setRooms] = useState('3');
  const [baths, setBaths] = useState('2');
  const [features, setFeatures] = useState<string[]>([]);
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [result, setResult] = useState<CreateResult | null>(null);

  const samples = useMemo(() => {
    const used = new Set(s.properties.map((p) => p.landCode));
    const free = s.landRegistry.find((r) => !used.has(r.code));
    const dup = s.listings.find((l) => l.advertiserId === advertiserId && (LIVE_STATUSES as readonly string[]).includes(l.status) && s.properties.find((p) => p.id === l.propertyId)?.landCode);
    const join = s.properties.find((p) => p.landCode && p.availability === 'available' && !findDuplicate(s, advertiserId, p.landCode) && s.listings.some((l) => l.propertyId === p.id && l.status === 'active'));
    return [
      free && { code: free.code, label: t('sample_free') },
      join && { code: join.landCode!, label: t('sample_join') },
      dup && { code: s.properties.find((p) => p.id === dup.propertyId)!.landCode!, label: t('sample_dup') },
    ].filter(Boolean) as { code: string; label: string }[];
  }, [s, advertiserId, t]);

  const rec = looked ? lookupLandCode(s, looked) : null;
  const existingProp = rec ? s.properties.find((p) => p.landCode === rec.code) : undefined;
  const dup = rec ? findDuplicate(s, advertiserId, rec.code) : undefined;
  const otherAds = existingProp ? s.listings.filter((l) => l.propertyId === existingProp.id && (LIVE_STATUSES as readonly string[]).includes(l.status)) : [];

  const lookup = (c = code) => { setCode(c); setLooked(c.trim().toUpperCase()); setResult(null); if (c) setNoCode(false); };
  const lockedType = existingProp?.type;
  const effType = lockedType ?? type;
  const residential = !['land', 'office', 'shop'].includes(effType);

  const publish = async () => {
    const r = await ops.createListing(advertiserId, {
      landCode: noCode ? '' : (looked ?? ''), type: effType, deal, price: +price, districtId: rec?.districtId ?? district,
      area: existingProp?.area ?? rec?.area ?? +area, rooms: residential ? +rooms : 0, baths: effType === 'land' ? 0 : +baths, features, descAr, descEn,
    });
    setResult(r);
  };

  const ready = (noCode || (rec && !dup)) && +price > 0 && (rec || +area > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
      <Card className="p-5 grid gap-5 min-w-0">
        <section className="grid gap-2">
          <SectionTitle title={t('step_land')} sub={t('step_land_sub')} />
          <div className="flex gap-2">
            <input id="land-code" className="field num uppercase" placeholder="DEMO-RYD-10001" value={code} disabled={noCode} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }} />
            <Button variant="secondary" disabled={noCode || !code.trim()} onClick={() => lookup()}><Search size={16} />{t('lookup')}</Button>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="text-muted">{t('try_codes')}</span>
            {samples.map((x) => <button key={x.code} type="button" onClick={() => lookup(x.code)} className="press rounded-full border border-line px-2 py-0.5 hover:border-gold"><span className="num font-semibold">{x.code}</span> · {x.label}</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm mt-1"><input id="no-code" type="checkbox" checked={noCode} onChange={(e) => { setNoCode(e.target.checked); setLooked(null); setResult(null); }} />{t('no_code_checkbox')}</label>

          {looked && !noCode && (
            !rec ? <Notice tone="bad" title={t('land_not_found')} body={t('land_not_found_body')} />
            : dup ? (
              <Notice tone="bad" title={t('dup_title')} body={t('dup_body')}>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button size="sm" onClick={onDone}>{t('manage_existing')}</Button>
                  <Button size="sm" variant="ghost" onClick={publish}>{t('try_anyway')}</Button>
                </div>
              </Notice>
            ) : (
              <Notice tone="good" title={`${t('parcel_found')} · ${L(districtById(rec.districtId).name)} · ${num(rec.area, lang)} ${lang === 'ar' ? 'م²' : 'm²'}`}
                body={existingProp ? `${t('join_body')} (${num(otherAds.length, lang)})` : t('new_property_body')} />
            )
          )}
          {noCode && <Notice tone="warn" title={t('no_code_title')} body={t('no_code_body')} />}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label={t('deal')}>
            <select id="n-deal" className="field" value={deal} onChange={(e) => setDeal(e.target.value as Deal)}><option value="sale">{t('for_sale')}</option><option value="rent">{t('for_rent')}</option></select>
          </Field>
          <Field label={t('property_type')} hint={lockedType ? t('type_locked') : undefined}>
            <select id="n-type" className="field" value={effType} disabled={!!lockedType} onChange={(e) => setType(e.target.value as PropertyType)}>
              {(Object.keys(TYPE_LABEL) as PropertyType[]).map((k) => <option key={k} value={k}>{L(TYPE_LABEL[k])}</option>)}
            </select>
          </Field>
          <Field label={deal === 'sale' ? t('asking_price') : t('yearly_rent')}>
            <input id="n-price" inputMode="numeric" className="field num" placeholder={deal === 'sale' ? '1250000' : '65000'} value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
          </Field>
          {noCode && (
            <>
              <Field label={t('district')}>
                <select id="n-district" className="field" value={district} onChange={(e) => setDistrict(e.target.value)}>{DISTRICTS.map((d) => <option key={d.id} value={d.id}>{L(d.name)}</option>)}</select>
              </Field>
              <Field label={t('area')}><input id="n-area" inputMode="numeric" className="field num" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))} /></Field>
            </>
          )}
          {residential && !existingProp && (
            <>
              <Field label={t('rooms')}><input id="n-rooms" inputMode="numeric" className="field num" value={rooms} onChange={(e) => setRooms(e.target.value.replace(/\D/g, ''))} /></Field>
              <Field label={t('baths')}><input id="n-baths" inputMode="numeric" className="field num" value={baths} onChange={(e) => setBaths(e.target.value.replace(/\D/g, ''))} /></Field>
            </>
          )}
        </section>
        {!existingProp && (
          <section>
            <p className="text-sm font-semibold mb-2">{t('features')}</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(FEATURE_LABEL).map((f) => {
                const on = features.includes(f);
                return <button key={f} type="button" onClick={() => setFeatures(on ? features.filter((x) => x !== f) : [...features, f])}
                  className={`press rounded-full px-3 py-1 text-[13px] font-semibold border ${on ? 'bg-primary text-onprimary border-primary' : 'border-line'}`}>{L(FEATURE_LABEL[f])}</button>;
              })}
            </div>
          </section>
        )}
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label={t('desc_ar')}><textarea id="n-desc-ar" dir="rtl" rows={3} className="field" value={descAr} onChange={(e) => setDescAr(e.target.value)} /></Field>
          <Field label={t('desc_en')}><textarea id="n-desc-en" dir="ltr" rows={3} className="field" value={descEn} onChange={(e) => setDescEn(e.target.value)} /></Field>
        </section>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={!ready} onClick={publish}>{t('publish')}</Button>
          <span className="text-xs text-muted">{t('photos_generated')}</span>
        </div>
        {result && (result.ok
          ? <Notice tone="good" title={t('published')} body={result.joinedExisting ? `${t('published_joined')} (${num(result.otherOffers + 1, lang)})` : t('published_new')}>
              <div className="flex gap-2 mt-2"><Button size="sm" onClick={() => go(`property-${result.listing.propertyId}`)}>{t('view_ad')}</Button><Button size="sm" variant="ghost" onClick={onDone}>{t('my_ads')}</Button></div>
            </Notice>
          : <Notice tone="bad" title={t(`err_${result.error}` as never)} body={result.error === 'duplicate' ? t('err_duplicate_body') : ''} />)}
      </Card>

      <Card className="p-5 grid gap-3 text-sm">
        <p className="font-bold">{t('rules_title')}</p>
        <p className="flex gap-2"><CheckCircle2 size={16} className="text-good shrink-0 mt-0.5" />{t('rule_1')}</p>
        <p className="flex gap-2"><CheckCircle2 size={16} className="text-good shrink-0 mt-0.5" />{t('rule_2')}</p>
        <p className="flex gap-2"><CheckCircle2 size={16} className="text-good shrink-0 mt-0.5" />{t('rule_3')}</p>
        <p className="flex gap-2"><CheckCircle2 size={16} className="text-good shrink-0 mt-0.5" />{t('rule_4')}</p>
        <p className="text-xs text-muted border-t border-line pt-3">{t('portal_note')}</p>
      </Card>
    </div>
  );
}

function Notice({ tone, title, body, children }: { tone: 'good' | 'bad' | 'warn'; title: string; body: string; children?: React.ReactNode }) {
  const c = tone === 'good' ? 'border-good/40 bg-good/10' : tone === 'bad' ? 'border-bad/40 bg-bad/10' : 'border-warn/40 bg-warn/10';
  return (
    <div className={`rounded-ctl border p-3 rise ${c}`}>
      <p className="font-semibold text-sm">{title}</p>
      {body && <p className="text-[13px] text-muted mt-0.5">{body}</p>}
      {children}
    </div>
  );
}

function Fees({ type }: { type: 'owner' | 'company' | 'marketer' }) {
  const { t, lang } = useStore();
  const [v, setV] = useState('2000000');
  const c = commission(type, +v || 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Card className="p-5 grid gap-3">
        <p className="font-bold">{t('commission_calc')}</p>
        <Field label={t('transaction_value')}><input id="fee-value" inputMode="numeric" className="field num" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} /></Field>
        <div className="rounded-ctl bg-band/60 p-4">
          <p className="text-xs text-muted">{t('platform_commission')}</p>
          <p className="text-2xl font-bold num">{money(Math.round(c.amount), lang)}</p>
          <p className="text-xs text-muted mt-1">{type === 'company' ? t('rule_company') : t('rule_individual')}</p>
        </div>
        <p className="text-xs text-warn">{t('no_real_payments')}</p>
      </Card>
      <Card className="p-5 grid gap-2 text-sm">
        <p className="font-bold">{t('fee_model')}</p>
        <p>{t('fee_individual')}</p>
        <p>{t('fee_company')} <span className="text-muted">({t('assumption')}: {num(ASSUMED_BROKERAGE * 100, lang)}{lang === 'ar' ? '٪' : '%'})</span></p>
        <p>{t('fee_ads')}</p>
      </Card>
    </div>
  );
}
