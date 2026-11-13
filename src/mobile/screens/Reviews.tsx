import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useStore } from '../../lib/store';
import { dateFmt, money, num } from '../../components/ui';
import { AppHeader, Empty, PrimaryBtn, SimTag, useToast, useTx } from '../kit';
import { useNav } from '../nav';

/** Supervisor/admin: verify sold/rented claims (status sync), advertiser licences and reports. */
export function ReviewsScreen() {
  const { s, ops, L, lang, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const toast = useToast();
  const name = (id: string) => { const a = s.advertisers.find((x) => x.id === id); return a ? L(a.name) : id; };
  const pending = s.statusRequests.filter((r) => r.state === 'pending');
  const verify = s.advertisers.filter((a) => a.verified === 'pending');
  const reports = s.reports.filter((r) => r.open);
  return (
    <div className="screen">
      <AppHeader back={false} title={tx('المراجعات', 'Reviews')} sub={me.role === 'admin' ? tx('مدير المنصة', 'Administrator') : tx('مشرف', 'Supervisor')} />
      <div className="scroll pad py-4 grid gap-6 content-start narrow">
        <section className="grid gap-3">
          <p className="font-bold text-[16px]">{tx('توثيق البيع والتأجير', 'Sale & rental verification')} <span className="text-muted num">({num(pending.length, lang)})</span></p>
          <p className="text-[12.5px] text-muted -mt-1.5">{tx('ادعاء المعلن ليس صفقة رسمية. الموافقة تغلق العقار وكل إعلاناته معاً.', 'A claim is not an official transaction. Approval closes the property and all its ads together.')}</p>
          {pending.length === 0 && <Empty icon={<CheckCircle2 size={26} />} title={tx('لا شيء بانتظار المراجعة', 'Nothing waiting')} />}
          {pending.map((r) => {
            const p = s.properties.find((x) => x.id === r.propertyId)!;
            const l = s.listings.find((x) => x.id === r.listingId)!;
            const affected = s.listings.filter((x) => x.propertyId === p.id && x.status !== 'closed');
            return (
              <div key={r.id} className="rounded-[20px] bg-surface border border-line p-4 grid gap-3">
                <button type="button" onClick={() => nav.push('property', { id: p.id })} className="tap text-start">
                  <p className="font-bold text-[14.5px]">{L(l.title)}</p>
                  <p className="text-[12px] text-muted num mt-0.5">{p.landCode ?? tx('بدون كود', 'No code')} · {name(r.advertiserId)} · {dateFmt(r.at, lang)}</p>
                </button>
                <div className="flex items-center justify-between rounded-[14px] bg-band/60 px-3 py-2 text-[13px]">
                  <span className="font-semibold">{r.outcome === 'sold' ? tx('ادعاء بيع', 'Claimed sold') : tx('ادعاء تأجير', 'Claimed rented')}</span>
                  <span className="num font-bold">{money(r.value, lang)}</span>
                </div>
                <p className="text-[12.5px]">{tx(`الموافقة ستغلق ${num(affected.length, lang)} إعلانات:`, `Approving closes ${affected.length} ads:`)} <span className="text-muted">{affected.map((a) => name(a.advertiserId)).join('، ')}</span></p>
                <div className="flex gap-2">
                  <PrimaryBtn tone="good" className="flex-1 !h-11" onClick={() => { void ops.reviewStatus(r.id, true); toast(tx('تم التوثيق وإغلاق كل الإعلانات', 'Verified; all ads closed')); }}>{tx('توثيق وإغلاق', 'Verify & close')}</PrimaryBtn>
                  <PrimaryBtn tone="ghost" className="!h-11" onClick={() => { void ops.reviewStatus(r.id, false); toast(tx('تم الرفض', 'Rejected')); }}>{tx('رفض', 'Reject')}</PrimaryBtn>
                </div>
              </div>
            );
          })}
        </section>
        {me.role === 'admin' && (
          <section className="grid gap-3">
            <p className="font-bold text-[16px]">{tx('توثيق المعلنين', 'Advertiser verification')} <span className="text-muted num">({num(verify.length, lang)})</span></p>
            <SimTag>{tx('التحقق من رخص فال وواثق: محاكاة', 'FAL / Wathq checks: simulated')}</SimTag>
            {verify.map((a) => (
              <div key={a.id} className="rounded-[20px] bg-surface border border-line p-4 flex items-center gap-3">
                <ShieldCheck size={22} className="text-goldink shrink-0" />
                <div className="min-w-0 flex-1"><p className="font-bold truncate">{L(a.name)}</p><p className="text-[12px] text-muted num">{a.license ?? '—'}</p></div>
                <PrimaryBtn tone="good" className="!h-10 !px-3 text-[13px]" onClick={() => { void ops.verifyAdvertiser(a.id, true); toast(tx('تم التوثيق', 'Verified')); }}>{tx('توثيق', 'Verify')}</PrimaryBtn>
                <PrimaryBtn tone="ghost" className="!h-10 !px-3 text-[13px]" onClick={() => void ops.verifyAdvertiser(a.id, false)}>{tx('رفض', 'Reject')}</PrimaryBtn>
              </div>
            ))}
          </section>
        )}
        <section className="grid gap-3">
          <p className="font-bold text-[16px]">{tx('البلاغات', 'Reports')} <span className="text-muted num">({num(reports.length, lang)})</span></p>
          {reports.map((r) => {
            const l = s.listings.find((x) => x.id === r.listingId)!;
            return (
              <div key={r.id} className="rounded-[20px] bg-surface border border-line p-4 grid gap-2">
                <p className="font-semibold text-[14px]">{L(l.title)}</p>
                <p className="text-[12.5px] text-muted">“{r.reason}”</p>
                <div className="flex gap-2">
                  <PrimaryBtn tone="ghost" className="flex-1 !h-10 text-[13px]" onClick={() => void ops.resolveReport(r.id, true)}>{tx('إيقاف الإعلان', 'Pause ad')}</PrimaryBtn>
                  <PrimaryBtn tone="ghost" className="!h-10 text-[13px]" onClick={() => void ops.resolveReport(r.id, false)}>{tx('تجاهل', 'Dismiss')}</PrimaryBtn>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
