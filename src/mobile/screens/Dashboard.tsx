import { AlertTriangle, BadgeCheck, Eye, Layers, MessageCircle, Plus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../lib/store';
import { LIVE_STATUSES } from '../../lib/rules';
import { PropertyArt } from '../../components/PropertyArt';
import { money, num } from '../../components/ui';
import type { Listing } from '../../types';
import { AppHeader, Chip, Empty, PriceTag, PrimaryBtn, Sheet, useToast, useTx } from '../kit';
import { useNav } from '../nav';

export function StatusPill({ l }: { l: Listing }) {
  const tx = useTx();
  const [t, c] = l.status === 'active' ? [tx('نشط', 'Active'), 'bg-good/15 text-good'] : l.status === 'paused' ? [tx('متوقف', 'Paused'), 'bg-band text-ink']
    : l.status === 'under_review' ? [tx('قيد التوثيق', 'Under review'), 'bg-warn/15 text-warn']
    : [l.closedReason === 'sold' ? tx('مُباع', 'Sold') : l.closedReason === 'rented' ? tx('مؤجَّر', 'Rented') : tx('محذوف', 'Removed'), 'bg-bad/15 text-bad'];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${c}`}>{t}</span>;
}

export function DashboardScreen() {
  const { s, L, lang, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const [filter, setFilter] = useState<'live' | 'review' | 'closed'>('live');
  const [manage, setManage] = useState<string | null>(null);
  const adv = s.advertisers.find((a) => a.id === me.advertiserId);
  if (!adv) return <div className="screen"><AppHeader back={false} title={tx('لوحة المعلن', 'Dashboard')} /><Empty icon={<Layers size={26} />} title={tx('للمعلنين فقط', 'For advertisers only')} /></div>;
  const mine = s.listings.filter((l) => l.advertiserId === adv.id);
  const live = mine.filter((l) => (LIVE_STATUSES as readonly string[]).includes(l.status));
  const inquiries = s.conversations.filter((c) => c.advertiserId === adv.id).length;
  const competing = live.filter((l) => s.listings.some((o) => o.propertyId === l.propertyId && o.advertiserId !== adv.id && o.status === 'active')).length;
  const shown = mine.filter((l) => filter === 'live' ? l.status === 'active' || l.status === 'paused' : filter === 'review' ? l.status === 'under_review' : l.status === 'closed');

  return (
    <div className="scroll">
      <section className="bg-[#172B45] text-[#F8F6F1] rounded-b-[32px] safe-top pb-6">
        <div className="pad pt-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] text-[#E8DDC9]/75">{tx('لوحة المعلن', 'Advertiser dashboard')}</p>
            <p className="font-bold text-[18px] truncate flex items-center gap-1.5">{L(adv.name)}{adv.verified === 'verified' && <BadgeCheck size={17} className="text-[#9FE0BF]" />}</p>
          </div>
          <button type="button" onClick={() => nav.push('add')} className="tap h-11 px-4 rounded-[14px] bg-[#B69B72] text-[#172B45] font-bold inline-flex items-center gap-1.5"><Plus size={18} />{tx('إعلان', 'New ad')}</button>
        </div>
        <div className="pad mt-5 grid grid-cols-2 gap-2">
          {[[<TrendingUp size={16} key="1" />, live.length, tx('إعلانات حية', 'Live ads')], [<Eye size={16} key="2" />, mine.reduce((a, l) => a + l.views, 0), tx('زيارات', 'Visits')],
            [<MessageCircle size={16} key="3" />, inquiries, tx('استفسارات', 'Inquiries')], [<Layers size={16} key="4" />, competing, tx('عليها عروض منافسة', 'With competition')]].map(([i, n, k]) => (
            <div key={k as string} className="rounded-[18px] bg-white/[0.07] border border-white/10 p-3.5">
              <p className="text-[12px] text-[#E8DDC9]/75 flex items-center gap-1.5">{i}{k}</p>
              <p className="text-[24px] font-bold num mt-1">{num(n as number, lang)}</p>
            </div>
          ))}
        </div>
      </section>
      {adv.verified !== 'verified' && (
        <div className="pad mt-4"><div className="rounded-[16px] bg-warn/10 border border-warn/40 p-3 text-[13px] flex gap-2"><AlertTriangle size={18} className="text-warn shrink-0" />{tx('حسابك بانتظار التوثيق من الإدارة قبل النشر.', 'Your account is waiting for admin verification before publishing.')}</div></div>
      )}
      <div className="hscroll gap-2 px-[18px] pt-5 pb-3">
        <Chip active={filter === 'live'} onClick={() => setFilter('live')}>{tx('الحية', 'Live')} · {num(mine.filter((l) => l.status === 'active' || l.status === 'paused').length, lang)}</Chip>
        <Chip active={filter === 'review'} onClick={() => setFilter('review')}>{tx('قيد التوثيق', 'In review')} · {num(mine.filter((l) => l.status === 'under_review').length, lang)}</Chip>
        <Chip active={filter === 'closed'} onClick={() => setFilter('closed')}>{tx('المغلقة', 'Closed')} · {num(mine.filter((l) => l.status === 'closed').length, lang)}</Chip>
      </div>
      <div className="pad grid gap-3 pb-6 list-grid">
        {shown.length === 0 ? <Empty icon={<Layers size={26} />} title={tx('لا توجد إعلانات هنا', 'No ads here')} action={filter === 'live' ? <PrimaryBtn onClick={() => nav.push('add')}><Plus size={18} />{tx('أضف عقاراً', 'Add a property')}</PrimaryBtn> : undefined} />
          : shown.map((l) => {
            const p = s.properties.find((x) => x.id === l.propertyId)!;
            const others = s.listings.filter((o) => o.propertyId === p.id && o.id !== l.id && o.status === 'active');
            const lowOther = others.length ? Math.min(...others.map((o) => o.price)) : null;
            return (
              <button key={l.id} type="button" onClick={() => setManage(l.id)} className="tap flex gap-3 rounded-[20px] bg-surface border border-line p-2.5 text-start">
                <PropertyArt type={p.type} seed={l.imageSeed} className="h-[92px] w-[96px] rounded-[14px] shrink-0" />
                <div className="min-w-0 flex-1 grid gap-1 content-start">
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold text-[13.5px] leading-snug line-clamp-2">{L(l.title)}</p><StatusPill l={l} /></div>
                  <PriceTag n={l.price} deal={l.deal} className="text-[14px]" />
                  <div className="flex flex-wrap gap-x-3 text-[11.5px] text-muted num">
                    <span className="inline-flex items-center gap-1"><Eye size={12} />{num(l.views, lang)}</span>
                    {others.length > 0 && <span className={`inline-flex items-center gap-1 font-semibold ${lowOther! < l.price ? 'text-warn' : 'text-good'}`}><Layers size={12} />{num(others.length, lang)} {tx('منافس', 'rivals')} · {tx('الأقل', 'low')} {money(lowOther!, lang)}</span>}
                  </div>
                </div>
              </button>
            );
          })}
      </div>
      <ManageSheet id={manage} onClose={() => setManage(null)} />
    </div>
  );
}

function ManageSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { s, ops, L, lang } = useStore();
  const nav = useNav();
  const tx = useTx();
  const toast = useToast();
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState<'menu' | 'price' | 'close'>('menu');
  const l = s.listings.find((x) => x.id === id);
  if (!l) return null;
  const p = s.properties.find((x) => x.id === l.propertyId)!;
  const done = (msg: string) => { toast(msg); setMode('menu'); onClose(); };
  const close = () => { setMode('menu'); onClose(); };
  return (
    <Sheet open={!!id} onClose={close} title={L(l.title)}>
      <div className="grid gap-3">
        <div className="flex items-center justify-between rounded-[16px] bg-surface border border-line p-3">
          <div><PriceTag n={l.price} deal={l.deal} className="text-[16px]" /><p className="text-[11.5px] text-muted num mt-0.5">{p.landCode ?? tx('بدون كود أرض', 'No land code')}</p></div>
          <StatusPill l={l} />
        </div>
        {l.status === 'under_review' && <p className="text-[12.5px] text-warn">{tx('بانتظار توثيق المشرف. العروض الأخرى لنفس العقار لا تتغير حتى التوثيق.', 'Waiting for supervisor verification. Other offers stay unchanged until then.')}</p>}
        {mode === 'price' && (
          <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); if (+price > 0) { void ops.updateListing(l.id, { price: +price }); done(tx('تم تحديث السعر', 'Price updated')); } }}>
            <input id="m-edit-price" autoFocus inputMode="numeric" className="field h-12 num text-[16px]" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
            <PrimaryBtn type="submit" disabled={!(+price > 0)}>{tx('حفظ السعر', 'Save price')}</PrimaryBtn>
          </form>
        )}
        {mode === 'close' && (
          <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void ops.requestStatus(l.id, l.deal === 'sale' ? 'sold' : 'rented', +price || l.price); done(tx('أُرسل للتوثيق', 'Sent for verification')); }}>
            <p className="text-[12.5px] text-muted">{tx('سيتوقف إعلانك فقط. بعد توثيق المشرف تُغلق كل إعلانات هذا العقار تلقائياً.', 'Only your ad pauses. After supervisor verification, every ad for this property closes automatically.')}</p>
            <label className="text-[13px] font-semibold">{l.deal === 'sale' ? tx('سعر البيع النهائي', 'Final sale price') : tx('الإيجار السنوي المتفق عليه', 'Agreed yearly rent')}</label>
            <input id="m-final" inputMode="numeric" className="field h-12 num" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
            <PrimaryBtn type="submit">{tx('إرسال للتوثيق', 'Submit for verification')}</PrimaryBtn>
          </form>
        )}
        {mode === 'menu' && (
          <div className="grid gap-2">
            <PrimaryBtn tone="ghost" onClick={() => { close(); nav.push('property', { id: p.id, offer: l.id }); }}>{tx('عرض الإعلان', 'View ad')}</PrimaryBtn>
            {l.status !== 'closed' && l.status !== 'under_review' && <>
              <PrimaryBtn tone="ghost" onClick={() => { setPrice(String(l.price)); setMode('price'); }}>{tx('تعديل السعر', 'Edit price')} · <span className="num">{money(l.price, lang)}</span></PrimaryBtn>
              {l.status === 'active' ? <PrimaryBtn tone="ghost" onClick={() => { void ops.updateListing(l.id, { status: 'paused' }); done(tx('تم إيقاف الإعلان', 'Ad paused')); }}>{tx('إيقاف مؤقت', 'Pause')}</PrimaryBtn>
                : <PrimaryBtn tone="ghost" onClick={() => { void ops.updateListing(l.id, { status: 'active' }); done(tx('تم تفعيل الإعلان', 'Ad active again')); }}>{tx('تفعيل', 'Resume')}</PrimaryBtn>}
              <PrimaryBtn tone="navy" onClick={() => { setPrice(String(l.price)); setMode('close'); }}>{l.deal === 'sale' ? tx('تم البيع', 'Mark as sold') : tx('تم التأجير', 'Mark as rented')}</PrimaryBtn>
              <PrimaryBtn tone="ghost" className="!text-bad" onClick={() => { void ops.removeListing(l.id); done(tx('تم حذف الإعلان', 'Ad removed')); }}>{tx('حذف الإعلان', 'Remove ad')}</PrimaryBtn>
            </>}
          </div>
        )}
      </div>
    </Sheet>
  );
}
