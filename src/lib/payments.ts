// Simulated payment rules shared by the app and the API. No real charges happen anywhere in MIFTAH's prototype.
import type { Listing, PayItem, PayMethod, Property } from '../types';
import { COMMERCIAL } from '../data/seed';

export const VAT_RATE = 0.15;
export const EJAR_FEE = 250;               // simulated contract documentation fee (rent)
export const DEPOSIT_RATE = 0.01;          // booking deposit for a sale (1%, min 10,000 SAR)
export const DEPOSIT_MIN = 10_000;
export const RETT_RATE = 0.05;             // real estate transaction tax, paid at title transfer (shown for information only)

export interface Quote { kind: 'sale_deposit' | 'rent_payment'; items: PayItem[]; vat: number; total: number; installments?: number; laterNote?: { ar: string; en: string } }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function quote(listing: Listing, property: Property, installments = 1): Quote {
  if (listing.deal === 'sale') {
    const deposit = Math.max(DEPOSIT_MIN, Math.round((listing.price * DEPOSIT_RATE) / 100) * 100);
    return {
      kind: 'sale_deposit',
      items: [
        { label: { ar: 'عربون حجز العقار (١٪)', en: 'Booking deposit (1%)' }, amount: deposit, note: { ar: 'يُخصم من قيمة العقار عند الإفراغ', en: 'Deducted from the price at title transfer' } },
        { label: { ar: 'رسوم المنصة', en: 'Platform fee' }, amount: 0, note: { ar: 'مجاناً للباحثين عن عقار', en: 'Free for property seekers' } },
      ],
      vat: 0,
      total: deposit,
      laterNote: {
        ar: `المتبقي ${fmtSar(listing.price - deposit, 'ar')} يُدفع عند الإفراغ، مع ضريبة التصرفات العقارية ٥٪ (${fmtSar(listing.price * RETT_RATE, 'ar')}).`,
        en: `The remaining ${fmtSar(listing.price - deposit, 'en')} is paid at title transfer, plus 5% real estate transaction tax (${fmtSar(listing.price * RETT_RATE, 'en')}).`,
      },
    };
  }
  const n = [1, 2, 4].includes(installments) ? installments : 1;
  const rent = r2(listing.price / n);
  const commercial = COMMERCIAL.includes(property.type);
  const items: PayItem[] = [
    { label: { ar: n === 1 ? 'إيجار سنة كاملة' : `الدفعة الأولى من ${n === 2 ? 'دفعتين' : '٤ دفعات'}`, en: n === 1 ? 'Full year rent' : `First of ${n} installments` }, amount: rent,
      note: commercial ? { ar: 'إيجار تجاري: خاضع لضريبة القيمة المضافة', en: 'Commercial rent: subject to VAT' } : { ar: 'إيجار سكني: معفى من ضريبة القيمة المضافة', en: 'Residential rent: VAT exempt' } },
    { label: { ar: 'رسوم توثيق العقد (إيجار)', en: 'Contract documentation fee (Ejar)' }, amount: EJAR_FEE, note: { ar: 'محاكاة', en: 'Simulated' } },
  ];
  const vat = r2((commercial ? rent : 0) * VAT_RATE + EJAR_FEE * VAT_RATE);
  return {
    kind: 'rent_payment', installments: n, items, vat, total: r2(rent + EJAR_FEE + vat),
    laterNote: n > 1 ? { ar: `الدفعات المتبقية: ${n - 1} × ${fmtSar(rent, 'ar')} حسب جدول العقد.`, en: `Remaining: ${n - 1} × ${fmtSar(rent, 'en')} per the contract schedule.` } : undefined,
  };
}

export function fmtSar(n: number, lang: 'ar' | 'en') {
  const s = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 }).format(n);
  return lang === 'ar' ? `${s} ريال` : `SAR ${s}`;
}

export function luhn(num: string) {
  const d = num.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let x = +d[d.length - 1 - i];
    if (i % 2) { x *= 2; if (x > 9) x -= 9; }
    sum += x;
  }
  return sum % 10 === 0;
}

const MADA_BINS = ['446404', '440647', '440795', '457865', '968208', '588845', '636120', '417633', '468540', '468541', '468542', '468543', '968201', '968205', '504300', '539931'];
export function cardBrand(num: string): PayMethod | null {
  const d = num.replace(/\D/g, '');
  if (MADA_BINS.some((b) => d.startsWith(b))) return 'mada';
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
  return null;
}
export const validExpiry = (mmYY: string, now = new Date()) => {
  const m = mmYY.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return false;
  const mm = +m[1], yy = 2000 + +m[2];
  return mm >= 1 && mm <= 12 && (yy > now.getFullYear() || (yy === now.getFullYear() && mm >= now.getMonth() + 1));
};
export const validSaudiId = (id: string) => /^[12]\d{9}$/.test(id);
export const validMobile = (p: string) => /^05\d{8}$/.test(p);

export const TEST_CARDS = { mada: '4464 0400 0000 0007', visa: '4111 1111 1111 1111', mastercard: '5105 1051 0510 5100' };
export const TEST_OTP = '123456';

export function receiptNo(seed = Date.now()) {
  return `MFT-${new Date(seed).getFullYear()}-${String(seed % 1_000_000).padStart(6, '0')}`;
}
