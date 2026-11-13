// Booking deposit / rent payment flow: summary → payer details → method → bank verification (OTP) → processing → receipt.
// SIMULATED: no card network or bank is contacted and no money moves. The full card number never leaves this screen
// (only brand + last 4 digits are kept for the receipt). Amounts are recomputed by the store/API from the listing.
import { BadgeCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, CreditCard, Fingerprint, Lock, MessageCircle, Receipt as ReceiptIcon, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { districtById } from '../../data/seed';
import { useStore } from '../../lib/store';
import { cardBrand, fmtSar, luhn, quote, TEST_CARDS, TEST_OTP, validExpiry, validMobile, validSaudiId } from '../../lib/payments';
import { PropertyArt } from '../../components/PropertyArt';
import { dateFmt, num } from '../../components/ui';
import type { Payment, PayMethod } from '../../types';
import { AppHeader, Empty, PrimaryBtn, SimTag, useToast, useTx } from '../kit';
import { useNav } from '../nav';

const METHOD_LABEL: Record<PayMethod, { ar: string; en: string }> = {
  mada: { ar: 'مدى', en: 'mada' }, visa: { ar: 'فيزا', en: 'Visa' }, mastercard: { ar: 'ماستركارد', en: 'Mastercard' },
  applepay: { ar: 'Apple Pay', en: 'Apple Pay' }, stcpay: { ar: 'STC Pay', en: 'STC Pay' },
};

function MethodMark({ m }: { m: PayMethod | 'card' }) {
  const base = 'h-7 min-w-[46px] px-1.5 rounded-[6px] inline-flex items-center justify-center whitespace-nowrap text-[11px] font-extrabold tracking-tight';
  if (m === 'mada') return <span className={`${base} bg-[#F8F6F1] border border-line`}><span className="text-[#259BD6]">ma</span><span className="text-[#84B740] -ms-[1px]">da</span></span>;
  if (m === 'applepay') return <span className={`${base} bg-black text-white`}>Pay</span>;
  if (m === 'stcpay') return <span className={`${base} bg-[#4F008C] text-white`}>stc pay</span>;
  if (m === 'mastercard') return <span className={`${base} bg-white border border-line`}><span className="h-4 w-4 rounded-full bg-[#EB001B]" /><span className="h-4 w-4 rounded-full bg-[#F79E1B] -ms-2 mix-blend-multiply" /></span>;
  if (m === 'visa') return <span className={`${base} bg-white border border-line text-[#1A1F71] italic`}>VISA</span>;
  return <span className={`${base} bg-band`}><CreditCard size={16} /></span>;
}

export function PaymentScreen({ listingId }: { listingId: string }) {
  const { s, ops, L, lang, me, remote } = useStore();
  const nav = useNav();
  const tx = useTx();
  const l = s.listings.find((x) => x.id === listingId);
  const p = l && s.properties.find((x) => x.id === l.propertyId);
  const [step, setStep] = useState(0);
  const [inst, setInst] = useState(1);
  const [name, setName] = useState(L(me.name).replace(/\s*\(.*\)\s*/, ''));
  const [idNo, setIdNo] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);
  const [method, setMethod] = useState<'card' | 'applepay' | 'stcpay'>('card');
  const [card, setCard] = useState('');
  const [exp, setExp] = useState('');
  const [cvv, setCvv] = useState('');
  const [holder, setHolder] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(59);
  const q = useMemo(() => (l && p ? quote(l, p, inst) : null), [l, p, inst]);
  useEffect(() => { if (step !== 3) return; setTimer(59); const i = window.setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000); return () => window.clearInterval(i); }, [step]);
  if (!l || !p || !q) return <div className="screen"><AppHeader title={tx('الدفع', 'Payment')} /><Empty icon={<CreditCard size={26} />} title={tx('الإعلان غير موجود', 'Ad not found')} /></div>;

  const adv = s.advertisers.find((a) => a.id === l.advertiserId)!;
  const sale = l.deal === 'sale';
  const digits = card.replace(/\D/g, '');
  const brand = cardBrand(digits);
  const cardOk = method !== 'card' || (luhn(digits) && !!brand && validExpiry(exp) && /^\d{3}$/.test(cvv) && holder.trim().length >= 3);
  const detailsOk = name.trim().length >= 3 && validSaudiId(idNo) && validMobile(phone) && agree;
  const payMethod: PayMethod = method === 'card' ? (brand ?? 'visa') : method;
  const Chev = lang === 'ar' ? ChevronLeft : ChevronRight;
  const STEPS = [tx('الملخص', 'Summary'), tx('البيانات', 'Details'), tx('الدفع', 'Payment'), tx('التحقق', 'Verify')];

  const finish = async () => {
    setErr(''); setBusy(true); setStep(4);
    await new Promise((r) => setTimeout(r, 1800));
    try {
      // Offline the code is checked here; with the API the server checks it.
      if (!remote && otp !== TEST_OTP) throw new Error(tx('رمز التحقق غير صحيح', 'Incorrect verification code'));
      const pay = await ops.createPayment({ listingId: l.id, installments: inst, method: payMethod, last4: method === 'card' ? digits.slice(-4) : undefined, payerName: name.trim(), payerIdNo: idNo, payerPhone: phone, otp });
      setBusy(false);
      nav.pop();
      window.setTimeout(() => nav.push('receipt', { id: pay.id, fresh: true }), 280);
    } catch (e) {
      setBusy(false); setStep(3); setErr((e as Error).message);
    }
  };

  return (
    <div className="screen">
      <AppHeader title={sale ? tx('حجز العقار', 'Book this property') : tx('دفع الإيجار', 'Pay rent')} sub={<span className="inline-flex items-center gap-1"><Lock size={11} />{tx('دفع آمن · بيئة تجريبية', 'Secure checkout · test mode')}</span>} />
      {step < 4 && (
        <div className="pad pt-3 shrink-0 narrow">
          <div className="grid grid-cols-4 gap-1.5">{STEPS.map((x, i) => <div key={x} className="grid gap-1"><span className={`h-1.5 rounded-full ${i <= step ? 'bg-gold' : 'bg-line'}`} /><span className={`text-[10.5px] font-semibold ${i === step ? 'text-ink' : 'text-muted'}`}>{x}</span></div>)}</div>
        </div>
      )}

      <div className="scroll pad py-4 pb-28 grid gap-4 content-start narrow">
        {step === 0 && <>
          <div className="flex gap-3 rounded-[20px] bg-surface border border-line p-2.5">
            <PropertyArt type={p.type} seed={l.imageSeed} className="h-[76px] w-[86px] rounded-[14px] shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-[14px] leading-snug line-clamp-2">{L(l.title)}</p>
              <p className="text-[12px] text-muted mt-0.5">{L(districtById(p.districtId).name)} · <span className="num">{p.landCode ?? tx('بدون كود', 'No code')}</span></p>
              <p className="text-[12px] text-muted flex items-center gap-1">{L(adv.name)}{adv.verified === 'verified' && <BadgeCheck size={13} className="text-good" />}</p>
            </div>
          </div>
          {!sale && (
            <div>
              <p className="text-[13px] font-bold mb-2">{tx('طريقة سداد الإيجار', 'Rent payment schedule')}</p>
              <div className="grid grid-cols-3 gap-2">{[1, 2, 4].map((n) => (
                <button key={n} type="button" onClick={() => setInst(n)} className={`tap rounded-[16px] border-2 p-3 text-start ${inst === n ? 'border-gold bg-gold/10' : 'border-line bg-surface'}`}>
                  <p className="font-bold text-[13.5px]">{n === 1 ? tx('دفعة واحدة', 'Yearly') : n === 2 ? tx('دفعتين', '2 payments') : tx('٤ دفعات', '4 payments')}</p>
                  <p className="text-[12px] text-muted num mt-0.5">{fmtSar(l.price / n, lang)}</p>
                </button>
              ))}</div>
            </div>
          )}
          <div className="rounded-[20px] bg-surface border border-line p-4 grid gap-2.5">
            <p className="font-bold">{tx('تفاصيل المبلغ', 'Amount details')}</p>
            {q.items.map((it) => (
              <div key={it.label.en} className="flex justify-between gap-3 text-[13.5px]">
                <div><p>{L(it.label)}</p>{it.note && <p className="text-[11.5px] text-muted">{L(it.note)}</p>}</div>
                <span className="num font-semibold whitespace-nowrap">{it.amount ? fmtSar(it.amount, lang) : tx('مجاناً', 'Free')}</span>
              </div>
            ))}
            {q.vat > 0 && <div className="flex justify-between text-[13.5px]"><span>{tx('ضريبة القيمة المضافة ١٥٪', 'VAT 15%')}</span><span className="num font-semibold">{fmtSar(q.vat, lang)}</span></div>}
            <div className="border-t border-dashed border-line pt-2.5 flex justify-between items-baseline"><span className="font-bold">{tx('الإجمالي المستحق الآن', 'Total due now')}</span><span className="num font-bold text-[20px]">{fmtSar(q.total, lang)}</span></div>
            {q.laterNote && <p className="text-[12px] text-muted bg-band/50 rounded-[12px] p-2.5">{L(q.laterNote)}</p>}
          </div>
          <div className="rounded-[16px] border border-line p-3 text-[12.5px] text-muted flex gap-2"><ShieldCheck size={18} className="text-good shrink-0" />
            {sale ? tx('يُحفظ العربون لدى مفتاح ولا يُحوَّل للمعلن إلا بعد توثيق الصفقة. وإذا لم تكتمل لأسباب من المعلن يُعاد لك كاملاً.', 'The deposit is held by MIFTAH and released to the advertiser only after the deal is verified. If the advertiser does not complete, it is fully refunded.')
              : tx('تُحوَّل الدفعة للمؤجر بعد توثيق العقد في منصة إيجار.', 'The payment is released to the landlord once the contract is documented on Ejar.')}
          </div>
          <div className="flex flex-wrap gap-1.5"><SimTag>{tx('دفع تجريبي: لن يُخصم أي مبلغ', 'Test payment: nothing is charged')}</SimTag><SimTag>{tx('الضمان والإيجار: محاكاة', 'Escrow & Ejar: simulated')}</SimTag></div>
        </>}

        {step === 1 && <>
          <p className="text-[19px] font-bold">{tx('بيانات المشتري', 'Buyer details')}</p>
          <Labeled label={tx('الاسم الكامل كما في الهوية', 'Full name as on ID')}><input id="pay-name" className="field h-12" value={name} onChange={(e) => setName(e.target.value)} /></Labeled>
          <Labeled label={tx('رقم الهوية الوطنية أو الإقامة', 'National ID or Iqama number')} hint={idNo && !validSaudiId(idNo) ? tx('١٠ أرقام تبدأ بـ ١ أو ٢', '10 digits starting with 1 or 2') : undefined}>
            <input id="pay-id" inputMode="numeric" dir="ltr" className="field h-12 num" placeholder="1xxxxxxxxx" value={idNo} onChange={(e) => setIdNo(e.target.value.replace(/\D/g, '').slice(0, 10))} />
          </Labeled>
          <Labeled label={tx('رقم الجوال', 'Mobile number')} hint={phone && !validMobile(phone) ? tx('بالصيغة 05XXXXXXXX', 'Format 05XXXXXXXX') : undefined}>
            <input id="pay-phone" inputMode="tel" dir="ltr" className="field h-12 num" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
          </Labeled>
          <button type="button" onClick={() => setAgree(!agree)} className="tap flex items-start gap-2.5 text-[13px] text-start">
            <span className={`mt-0.5 h-5 w-5 rounded-[6px] border grid place-items-center shrink-0 ${agree ? 'bg-primary border-primary text-onprimary' : 'border-line bg-surface'}`}>{agree && <Check size={13} />}</span>
            <span>{sale ? tx('أوافق على شروط الحجز: العربون يُخصم من قيمة العقار عند الإفراغ، ويُسترد إذا لم يكمل المعلن.', 'I agree to the booking terms: the deposit is deducted at title transfer and refunded if the advertiser does not complete.')
              : tx('أوافق على شروط الإيجار وتوثيق العقد في منصة إيجار.', 'I agree to the rental terms and Ejar contract documentation.')}</span>
          </button>
          <p className="text-[11.5px] text-muted flex items-center gap-1"><Lock size={11} />{tx('نحفظ آخر ٤ أرقام من الهوية فقط على الإيصال.', 'Only the last 4 digits of your ID are kept on the receipt.')}</p>
        </>}

        {step === 2 && <>
          <p className="text-[19px] font-bold">{tx('طريقة الدفع', 'Payment method')}</p>
          <div className="grid gap-2">
            {([['card', tx('بطاقة مدى أو ائتمانية', 'mada or credit card'), <span key="c" className="flex gap-1"><MethodMark m="mada" /><MethodMark m="visa" /><MethodMark m="mastercard" /></span>],
              ['applepay', 'Apple Pay', <MethodMark key="a" m="applepay" />], ['stcpay', 'STC Pay', <MethodMark key="s" m="stcpay" />]] as const).map(([k, label, mark]) => (
              <button key={k} type="button" onClick={() => setMethod(k)} className={`tap flex items-center gap-3 rounded-[16px] border-2 p-3.5 text-start ${method === k ? 'border-gold bg-gold/10' : 'border-line bg-surface'}`}>
                <span className={`h-5 w-5 rounded-full border-2 grid place-items-center ${method === k ? 'border-primary' : 'border-line'}`}>{method === k && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span>
                <span className="flex-1 font-semibold text-[14px]">{label}</span>{mark}
              </button>
            ))}
          </div>
          {method === 'card' && <>
            <div dir="ltr" className="relative h-[178px] rounded-[20px] p-5 text-[#F8F6F1] overflow-hidden shadow-[0_14px_30px_rgba(23,43,69,.3)]" style={{ background: 'linear-gradient(135deg,#172B45 0%,#2B4A72 60%,#B69B72 140%)' }}>
              <div className="flex justify-between items-start"><span className="h-8 w-11 rounded-[6px] bg-gradient-to-br from-[#E8DDC9] to-[#B69B72]" /><MethodMark m={brand ?? 'card'} /></div>
              <p className="num text-[20px] tracking-[0.12em] mt-7">{(digits.padEnd(16, '•').match(/.{1,4}/g) ?? []).join(' ')}</p>
              <div className="flex justify-between mt-3 text-[12px] uppercase"><span className="truncate max-w-[70%]">{holder || 'CARD HOLDER'}</span><span className="num">{exp || 'MM/YY'}</span></div>
            </div>
            <Labeled label={tx('رقم البطاقة', 'Card number')} hint={digits.length >= 13 && !luhn(digits) ? tx('رقم البطاقة غير صحيح', 'Card number is not valid') : undefined}>
              <input id="pay-card" inputMode="numeric" dir="ltr" autoComplete="off" className="field h-12 num tracking-wider" placeholder="0000 0000 0000 0000" value={(digits.match(/.{1,4}/g) ?? []).join(' ')} onChange={(e) => setCard(e.target.value.replace(/\D/g, '').slice(0, 16))} />
            </Labeled>
            <div className="flex flex-wrap gap-1.5 -mt-1.5">
              <span className="text-[11.5px] text-muted self-center">{tx('بطاقات اختبار:', 'Test cards:')}</span>
              {(Object.entries(TEST_CARDS) as [PayMethod, string][]).map(([b, n]) => (
                <button key={b} type="button" onClick={() => { setCard(n.replace(/\s/g, '')); setExp('12/29'); setCvv('123'); if (!holder) setHolder(name.toUpperCase()); }} className="tap rounded-full border border-dashed border-line px-2 py-1 text-[11px] font-semibold">{METHOD_LABEL[b][lang]}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Labeled label={tx('تاريخ الانتهاء', 'Expiry')} hint={exp.length === 5 && !validExpiry(exp) ? tx('منتهية أو غير صحيحة', 'Expired or invalid') : undefined}>
                <input id="pay-exp" inputMode="numeric" dir="ltr" className="field h-12 num" placeholder="MM/YY" value={exp} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setExp(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v); }} />
              </Labeled>
              <Labeled label="CVV"><input id="pay-cvv" inputMode="numeric" dir="ltr" type="password" autoComplete="off" className="field h-12 num" placeholder="•••" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))} /></Labeled>
            </div>
            <Labeled label={tx('اسم حامل البطاقة', 'Name on card')}><input id="pay-holder" dir="ltr" className="field h-12 uppercase" value={holder} onChange={(e) => setHolder(e.target.value)} /></Labeled>
          </>}
          {method === 'applepay' && <div className="rounded-[20px] bg-black text-white p-5 grid justify-items-center gap-2 text-center"><Fingerprint size={40} /><p className="font-semibold">{tx('سيُطلب منك التأكيد بـ Face ID في الخطوة التالية', 'You will confirm with Face ID next')}</p><p className="text-[12px] text-white/60">{tx('محاكاة', 'Simulated')}</p></div>}
          {method === 'stcpay' && <div className="rounded-[20px] bg-[#4F008C] text-white p-5 grid justify-items-center gap-2 text-center"><Smartphone size={36} /><p className="font-semibold">{tx(`سيصلك طلب الدفع على ${phone || 'جوالك'}`, `A payment request will be sent to ${phone || 'your phone'}`)}</p><p className="text-[12px] text-white/60">{tx('محاكاة', 'Simulated')}</p></div>}
          <p className="text-[11.5px] text-muted flex items-center gap-1"><Lock size={11} />{tx('لا يُحفظ رقم البطاقة. نحتفظ بآخر ٤ أرقام فقط على الإيصال.', 'The card number is never stored; only the last 4 digits appear on the receipt.')}</p>
        </>}

        {step === 3 && (
          <div className="grid gap-4">
            <div className="rounded-[20px] bg-surface border border-line p-5 grid gap-3 text-center justify-items-center">
              {method === 'applepay' ? <Fingerprint size={40} className="text-ink" /> : <ShieldCheck size={40} className="text-good" />}
              <p className="text-[18px] font-bold">{method === 'applepay' ? tx('أكّد الدفع', 'Confirm payment') : tx('التحقق من الدفع', 'Payment verification')}</p>
              <p className="text-[13px] text-muted max-w-[34ch]">{method === 'card' ? tx(`أرسل مصرفك رمز تحقق إلى الجوال المسجل لبطاقة ${METHOD_LABEL[payMethod][lang]} المنتهية بـ ${digits.slice(-4)}.`, `Your bank sent a code to the phone registered to your ${METHOD_LABEL[payMethod][lang]} ending ${digits.slice(-4)}.`)
                : method === 'stcpay' ? tx(`أدخل الرمز المرسل إلى ${phone}.`, `Enter the code sent to ${phone}.`) : tx('أدخل رمز التأكيد لإتمام الدفع عبر Apple Pay.', 'Enter the confirmation code to complete Apple Pay.')}</p>
              <p className="num text-[24px] font-bold">{fmtSar(q.total, lang)}</p>
              <input id="pay-otp" inputMode="numeric" dir="ltr" autoFocus className="field h-14 w-[220px] text-center num text-[24px] tracking-[0.5em] font-bold" placeholder="••••••" value={otp} onChange={(e) => { setErr(''); setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); }} />
              <p className="text-[12px] text-muted">{timer > 0 ? tx(`إعادة الإرسال بعد ${num(timer, lang)} ث`, `Resend in ${timer}s`) : <button type="button" className="tap text-goldink font-semibold" onClick={() => setTimer(59)}>{tx('إعادة إرسال الرمز', 'Resend code')}</button>}</p>
              <SimTag>{tx(`رمز الاختبار: ${TEST_OTP}`, `Test code: ${TEST_OTP}`)}</SimTag>
              {err && <p className="text-[13px] text-bad font-semibold">{err}</p>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid justify-items-center text-center gap-4 pt-16">
            <span className="h-16 w-16 rounded-full border-4 border-line border-t-gold animate-spin" />
            <p className="text-[18px] font-bold">{tx('جارٍ معالجة الدفع…', 'Processing payment…')}</p>
            <p className="text-[13px] text-muted">{tx('لا تغلق الصفحة', 'Please do not close this screen')}</p>
          </div>
        )}
      </div>

      {step < 4 && (
        <div className="absolute bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line safe-bottom">
          <div className="pad py-3 flex gap-2 narrow">
            {step > 0 && <PrimaryBtn tone="ghost" onClick={() => { setErr(''); setStep(step - 1); }}>{tx('السابق', 'Back')}</PrimaryBtn>}
            {step === 0 && <PrimaryBtn className="flex-1" tone="gold" onClick={() => setStep(1)}>{sale ? tx('متابعة الحجز', 'Continue to booking') : tx('متابعة الدفع', 'Continue')}<Chev size={18} /></PrimaryBtn>}
            {step === 1 && <PrimaryBtn className="flex-1" disabled={!detailsOk} onClick={() => setStep(2)}>{tx('التالي', 'Next')}</PrimaryBtn>}
            {step === 2 && <PrimaryBtn className="flex-1" disabled={!cardOk} onClick={() => { setOtp(''); setStep(3); }}><Lock size={16} />{tx(`ادفع ${fmtSar(q.total, lang)}`, `Pay ${fmtSar(q.total, lang)}`)}</PrimaryBtn>}
            {step === 3 && <PrimaryBtn className="flex-1" tone="good" disabled={otp.length !== 6 || busy} onClick={() => void finish()}>{tx('تأكيد الدفع', 'Confirm payment')}</PrimaryBtn>}
          </div>
        </div>
      )}
    </div>
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className="text-[13px] font-bold">{label}</span>{children}{hint && <span className="text-[12px] text-bad">{hint}</span>}</label>;
}

/** Deterministic decorative verification pattern (not a ZATCA QR code). */
function VerifyPattern({ seed }: { seed: string }) {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cells: boolean[] = [];
  for (let i = 0; i < 121; i++) { h = (h * 1103515245 + 12345) >>> 0; cells.push(((h >>> 16) & 1) === 1); }
  const finder = (x: number, y: number) => (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
  return (
    <svg viewBox="0 0 11 11" className="h-[92px] w-[92px]" shapeRendering="crispEdges" aria-label="verification pattern">
      <rect width="11" height="11" fill="#fff" />
      {cells.map((on, i) => { const x = i % 11, y = Math.floor(i / 11); return (finder(x, y) ? !(x === 1 && y === 1) && !(x === 9 && y === 1) && !(x === 1 && y === 9) : on) ? <rect key={i} x={x} y={y} width="1" height="1" fill="#172B45" /> : null; })}
    </svg>
  );
}

export function ReceiptScreen({ id, fresh }: { id: string; fresh?: boolean }) {
  const { s, ops, L, lang, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const toast = useToast();
  const pay = s.payments?.find((x) => x.id === id);
  if (!pay) return <div className="screen"><AppHeader title={tx('الإيصال', 'Receipt')} /><Empty icon={<ReceiptIcon size={26} />} title={tx('الإيصال غير موجود', 'Receipt not found')} /></div>;
  const l = s.listings.find((x) => x.id === pay.listingId)!;
  const p = s.properties.find((x) => x.id === pay.propertyId)!;
  const adv = s.advertisers.find((a) => a.id === pay.advertiserId)!;
  const when = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(pay.at));
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-3 text-[13px]"><span className="text-muted">{k}</span><span className="font-semibold text-end num">{v}</span></div>;
  return (
    <div className="screen">
      <AppHeader title={tx('إيصال الدفع', 'Payment receipt')} sub={<span className="num">{pay.receiptNo}</span>} />
      <div className="scroll pad py-5 pb-28 grid gap-4 content-start narrow">
        {fresh && (
          <div className="grid justify-items-center text-center gap-2 tab-in">
            <span className="grid place-items-center h-16 w-16 rounded-full bg-good/15 text-good"><CheckCircle2 size={38} /></span>
            <p className="text-[20px] font-bold">{tx('تم الدفع بنجاح', 'Payment successful')}</p>
            <p className="text-[13px] text-muted">{pay.kind === 'sale_deposit' ? tx('تم حجز العقار باسمك، وأُبلغ المعلن.', 'The property is reserved in your name and the advertiser has been notified.') : tx('تم استلام دفعة الإيجار، وأُبلغ المؤجر.', 'Your rent payment was received and the landlord notified.')}</p>
          </div>
        )}
        <div className="rounded-[22px] bg-surface border border-line overflow-hidden">
          <div className="bg-[#172B45] text-[#F8F6F1] p-4 flex items-center justify-between">
            <div><p className="font-bold text-[16px]">{tx('مفتاح', 'MIFTAH')}</p><p className="text-[11px] text-[#E8DDC9]/70">{tx('إيصال دفع إلكتروني', 'Electronic payment receipt')}</p></div>
            <span className="rounded-full bg-[#9FE0BF]/20 text-[#9FE0BF] px-2.5 py-1 text-[11.5px] font-bold">{tx('مدفوع', 'PAID')}</span>
          </div>
          <div className="p-4 grid gap-2.5">
            <Row k={tx('رقم الإيصال', 'Receipt no.')} v={pay.receiptNo} />
            <Row k={tx('التاريخ', 'Date')} v={when} />
            <Row k={tx('نوع الدفعة', 'Type')} v={pay.kind === 'sale_deposit' ? tx('عربون حجز عقار', 'Property booking deposit') : tx(`إيجار${pay.installments && pay.installments > 1 ? ` · الدفعة ١ من ${num(pay.installments, lang)}` : ' · سنة كاملة'}`, `Rent${pay.installments && pay.installments > 1 ? ` · payment 1 of ${pay.installments}` : ' · full year'}`)} />
            <div className="border-t border-dashed border-line my-1" />
            <Row k={tx('العقار', 'Property')} v={L(l.title)} />
            <Row k={tx('الحي', 'District')} v={L(districtById(p.districtId).name)} />
            <Row k={tx('رقم كود الأرض', 'Land code')} v={p.landCode ?? '—'} />
            <Row k={tx('المعلن', 'Advertiser')} v={L(adv.name)} />
            <Row k={tx('ترخيص الإعلان', 'Ad licence')} v={l.adLicense} />
            <div className="border-t border-dashed border-line my-1" />
            <Row k={tx('الدافع', 'Paid by')} v={pay.payerName} />
            <Row k={tx('الهوية', 'ID')} v={`••••••${pay.payerIdLast4}`} />
            <Row k={tx('الجوال', 'Mobile')} v={`${pay.payerPhone.slice(0, 3)}•••${pay.payerPhone.slice(-4)}`} />
            <Row k={tx('طريقة الدفع', 'Method')} v={<span className="inline-flex items-center gap-1.5">{METHOD_LABEL[pay.method][lang]}{pay.last4 && <span>•••• {pay.last4}</span>}</span>} />
            <div className="border-t border-dashed border-line my-1" />
            {pay.items.map((it) => <Row key={it.label.en} k={L(it.label)} v={it.amount ? fmtSar(it.amount, lang) : tx('مجاناً', 'Free')} />)}
            {pay.vat > 0 && <Row k={tx('ضريبة القيمة المضافة ١٥٪', 'VAT 15%')} v={fmtSar(pay.vat, lang)} />}
            <div className="flex justify-between items-baseline border-t border-line pt-2.5"><span className="font-bold">{tx('الإجمالي المدفوع', 'Total paid')}</span><span className="num font-bold text-[20px]">{fmtSar(pay.total, lang)}</span></div>
          </div>
          <div className="border-t border-dashed border-line p-4 flex items-center gap-4">
            <VerifyPattern seed={pay.receiptNo} />
            <div className="text-[11.5px] text-muted grid gap-1">
              <p>{pay.kind === 'sale_deposit' ? tx('العربون محفوظ لدى مفتاح حتى توثيق الصفقة، ويُخصم من قيمة العقار عند الإفراغ.', 'The deposit is held by MIFTAH until the deal is verified and deducted at title transfer.') : tx('تُحوَّل الدفعة للمؤجر بعد توثيق العقد في إيجار.', 'Released to the landlord after Ejar documentation.')}</p>
              <SimTag>{tx('إيصال تجريبي: لم يُخصم أي مبلغ فعلي', 'Test receipt: no real money was charged')}</SimTag>
            </div>
          </div>
        </div>
        <p className="text-[11.5px] text-muted text-center">{tx('صادر في', 'Issued on')} {dateFmt(pay.at, lang)} · {L(me.name)}</p>
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line safe-bottom">
        <div className="pad py-3 flex gap-2 narrow">
          <PrimaryBtn tone="ghost" onClick={() => { try { void navigator.clipboard.writeText(pay.receiptNo); } catch { /* ignore */ } toast(tx('تم نسخ رقم الإيصال', 'Receipt number copied')); }}><Copy size={17} /></PrimaryBtn>
          <PrimaryBtn tone="ghost" className="flex-1" onClick={() => nav.push('property', { id: p.id, offer: l.id })}>{tx('العقار', 'Property')}</PrimaryBtn>
          <PrimaryBtn className="flex-1" onClick={async () => { const c = await ops.startConversation(l.id, l.advertiserId); nav.push('chat', { id: c }); }}><MessageCircle size={17} />{tx('المعلن', 'Advertiser')}</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

export function PaymentsScreen() {
  const { s, L, lang, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const mine = (s.payments ?? []).filter((x) => x.payerId === me.id || x.advertiserId === me.advertiserId);
  return (
    <div className="screen">
      <AppHeader title={tx('المدفوعات', 'Payments')} sub={tx('إيصالات الحجز والإيجار', 'Booking and rent receipts')} />
      <div className="scroll pad py-4 grid gap-2.5 content-start narrow">
        {mine.length === 0 ? <Empty icon={<ReceiptIcon size={26} />} title={tx('لا توجد مدفوعات بعد', 'No payments yet')} sub={tx('احجز عقاراً بالعربون أو ادفع إيجاراً من صفحة العقار.', 'Book a property with a deposit or pay rent from a property page.')} />
          : mine.map((x: Payment) => {
            const l = s.listings.find((y) => y.id === x.listingId)!;
            const received = x.advertiserId === me.advertiserId && x.payerId !== me.id;
            return (
              <button key={x.id} type="button" onClick={() => nav.push('receipt', { id: x.id })} className="tap flex items-center gap-3 rounded-[18px] bg-surface border border-line p-3 text-start">
                <span className={`grid place-items-center h-11 w-11 rounded-[14px] ${received ? 'bg-good/15 text-good' : 'bg-band text-ink'}`}><ReceiptIcon size={19} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[13.5px] truncate">{L(l.title)}</p>
                  <p className="text-[11.5px] text-muted num">{x.receiptNo} · {dateFmt(x.at, lang)}</p>
                </div>
                <div className="text-end"><p className="num font-bold text-[14px]">{fmtSar(x.total, lang)}</p><p className={`text-[11px] font-semibold ${received ? 'text-good' : 'text-muted'}`}>{received ? tx('مستلمة', 'Received') : tx('مدفوعة', 'Paid')}</p></div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
