// Offline demo only: a context-aware advertiser who answers from the real listing data and remembers the chat
// (negotiation, viewing appointment). With the live API, replies come from the real advertiser account instead.
// Also provides suggested replies for both sides of a conversation.
import { districtById, FEATURE_LABEL, POI_LABEL, toArDigits } from '../data/seed';
import type { Conversation, L10n, Lang, PoiCat, State } from '../types';
import { normAr } from './agent';
import { nearest } from './geo';
import { hasBad } from './moderation';
import { DEPOSIT_RATE, DEPOSIT_MIN } from './payments';

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ar = (s: string) => /[؀-ۿ]/.test(s);
const money = (n: number, l: Lang) => {
  const v = n >= 1e6 ? (l === 'ar' ? `${+(n / 1e6).toFixed(2)} مليون` : `${+(n / 1e6).toFixed(2)}M`) : (l === 'ar' ? `${Math.round(n / 1000)} ألف` : `${Math.round(n / 1000)}K`);
  return l === 'ar' ? `${toArDigits(v)} ريال` : `SAR ${v}`;
};
const roundTo = (n: number) => (n >= 1e6 ? Math.round(n / 10_000) * 10_000 : Math.round(n / 500) * 500);

function parseAmount(s: string): number | null {
  const t = normAr(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬]/g, '').replace(/٫/g, '.').toLowerCase());
  const mil = t.match(/(\d+(?:\.\d+)?)?\s*(مليون|million|\dm\b)/);
  const th = t.match(/(\d+(?:\.\d+)?)\s*(الف|k\b|thousand)/);
  let v = 0;
  if (mil) v += (mil[1] ? parseFloat(mil[1]) : 1) * 1e6;
  if (/مليون\s*و\s*(نص|نصف)/.test(t)) v += 5e5;
  if (th) v += parseFloat(th[1]) * 1e3;
  if (!v) { const n = t.match(/(\d{5,})/); if (n) v = +n[1]; }
  return v >= 10_000 ? v : null;
}

/** Two upcoming viewing slots (skips Friday), deterministic for a given day. */
function slots(now = new Date()) {
  const out: { day: number; label: L10n }[] = [];
  for (let i = 1; out.length < 2 && i < 6; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    if (d.getDay() === 5) continue;
    const time = out.length === 0 ? { ar: 'العصر الساعة ٤:٣٠', en: '4:30 pm' } : { ar: 'المغرب الساعة ٧', en: '7:00 pm' };
    const when = i === 1 ? { ar: `بكرة ${DAYS_AR[d.getDay()]}`, en: `tomorrow (${DAYS_EN[d.getDay()]})` } : { ar: `يوم ${DAYS_AR[d.getDay()]}`, en: DAYS_EN[d.getDay()] };
    out.push({ day: d.getDay(), label: { ar: `${when.ar} ${time.ar}`, en: `${when.en} at ${time.en}` } });
  }
  return out;
}

export function advertiserReply(s: State, conv: Conversation, text: string): string {
  const L: Lang = ar(text) ? 'ar' : 'en';
  const t = normAr(text.toLowerCase());
  const l = s.listings.find((x) => x.id === conv.listingId)!;
  const p = s.properties.find((x) => x.id === l.propertyId)!;
  const a = s.advertisers.find((x) => x.id === conv.advertiserId)!;
  const d = districtById(p.districtId);
  const mine = conv.messages.filter((m) => m.from === conv.advertiserId);
  const lastMine = mine.at(-1)?.text ?? '';
  const first = mine.length === 0;
  const formal = a.type === 'company';
  const name = a.name[L].replace(/\s*\(.*\)\s*/, '').replace(/\.$/, '');
  const out: string[] = [];
  const say = (arT: string, enT: string) => out.push(L === 'ar' ? arT : enT);

  if (hasBad(text)) {
    say('نحترم الجميع ونحب نخدمك بأفضل شكل، خلنا نحافظ على أسلوب طيب. وش اللي تحب تعرفه عن العقار؟', 'We respect everyone and want to help you properly, so let us keep it courteous. What would you like to know about the property?');
    return out.join(' ');
  }
  if (first) {
    if (/السلام/.test(t)) say('وعليكم السلام ورحمة الله وبركاته،', 'Wa alaikum assalam,');
    say(formal ? `حياك الله، معك فريق ${name}.` : `هلا والله، معك ${name}.`, formal ? `Welcome, this is the ${name} team.` : `Hi, this is ${name}.`);
  } else if (/^(السلام|هلا|مرحبا|hi|hello)/.test(t)) say('هلا فيك مرة ثانية.', 'Hello again.');

  const asks = {
    price: /(سعر|اخر|نهايي|نهائي|تفاوض|خصم|ينزل|قابل|كم تبي|كم السوم|سوم|price|negotiab|discount|best|final|lower)/.test(t),
    viewing: /(معاينه|اعاين|اشوف|اشوفه|اشوفها|زياره|اجي|ازوركم|visit|viewing|see it|tour|inspect)/.test(t),
    time: /(السبت|الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|بكره|بكرا|اليوم|الصبح|العصر|المغرب|العشاء|مساء|الساعه|tomorrow|today|morning|evening|afternoon|\d\s*(ص|م|am|pm)|اول موعد|الموعد الاول|الاول|first slot|second slot|الثاني|يناسبني|suits me|works for me)/.test(t),
    available: /(متاح|موجود|باقي|ما انباع|ما تاجر|available|still)/.test(t),
    location: /(موقع|وين|لوكيشن|عنوان|location|where|address)/.test(t),
    docs: /(صك|رخصه|اوراق|مستندات|ترخيص|deed|document|title|licen)/.test(t),
    pay: /(دفع|دفعات|اقساط|تقسيط|عربون|حجز|احجز|installment|deposit|book|reserve|payment)/.test(t),
    size: /(مساحه|كم غرفه|غرف|حمامات|دورات|area|rooms|size|bath)/.test(t),
    age: /(عمر|جديد|كم سنه|متى بني|age|how old|new build)/.test(t),
    thanks: /(شكرا|يعطيك العافيه|مشكور|thanks|thank you)/.test(t),
  };
  const amount = parseAmount(text);

  // Negotiation: owners are a bit more flexible than companies.
  const flex = a.type === 'owner' ? 0.05 : a.type === 'marketer' ? 0.04 : 0.03;
  const floor = roundTo(l.price * (1 - flex));
  if (amount && amount < l.price && (asks.price || /(اعطيك|ادفع|عرضي|offer|i can pay|how about|ايش رايك|وش رايك)/.test(t) || !Object.values(asks).some(Boolean))) {
    if (amount >= floor) say(`عرض ${money(amount, 'ar')} قريب جداً. خلني أرجع للمالك وأأكد لك اليوم، ومبدئياً أشوفه ماشي. إذا اتفقنا تقدر تحجز بالعربون من صفحة الإعلان عشان نوقفه لك.`,
      `${money(amount, 'en')} is very close. Let me confirm with the owner today, but in principle it works. If we agree, you can book it with a deposit from the ad page so we hold it for you.`);
    else if (amount >= l.price * 0.9) { const c = roundTo((amount + l.price) / 2); say(`أقدّر عرضك، بس ${money(amount, 'ar')} أقل من المتوقع لهذا العقار. أقدر أنزل لـ ${money(c, 'ar')} وتكون صفقة ممتازة لك. وش رأيك؟`,
      `I appreciate the offer, but ${money(amount, 'en')} is below what this property can go for. I can come down to ${money(c, 'en')}, which is a very good deal. What do you think?`); }
    else say(`للأسف ${money(amount, 'ar')} بعيد عن سعر السوق للعقار. أقل شي ممكن نوصل له تقريباً ${money(floor, 'ar')}.`, `Unfortunately ${money(amount, 'en')} is far from market value. The lowest we could realistically go is about ${money(floor, 'en')}.`);
  } else if (asks.price) {
    say(l.deal === 'sale'
      ? `السعر المعلن ${money(l.price, 'ar')}، وفيه مجال بسيط للتفاوض للجادين بعد المعاينة.`
      : `الإيجار ${money(l.price, 'ar')} سنوياً، ونقدر نتفاهم على طريقة الدفع.`,
      l.deal === 'sale' ? `The asking price is ${money(l.price, 'en')}, with a little room to negotiate for serious buyers after a viewing.` : `The rent is ${money(l.price, 'en')} a year, and we are flexible on the payment schedule.`);
  }

  if (asks.available) say(p.availability === 'available' ? 'نعم العقار متاح حالياً.' : 'للأسف العقار لم يعد متاحاً.', p.availability === 'available' ? 'Yes, it is still available.' : 'Sorry, it is no longer available.');

  const offeredSlots = /(بكره|يوم|tomorrow|at \d)/.test(normAr(lastMine)) && /(يناسبك|suit|works for you)/.test(normAr(lastMine).toLowerCase());
  if (asks.time && offeredSlots) {
    const sl = slots();
    const pick = /(الثاني|second|المغرب|7|٧)/.test(t) ? sl[1] : sl[0];
    say(`تم، ثبتنا الموعد ${pick.label.ar}. الموقع في حي ${d.name.ar}، وبرسل لك اللوكيشن قبل الموعد بساعة. إذا صار عندك أي تغيير بلغني.`,
      `Done, we are booked for ${pick.label.en}. It is in ${d.name.en}; I will send the location an hour before. Let me know if anything changes.`);
  } else if (asks.viewing || (asks.time && !offeredSlots)) {
    const sl = slots();
    say(`أكيد، يسعدنا نرتب معاينة. عندي ${sl[0].label.ar} أو ${sl[1].label.ar}، أي وقت يناسبك؟`, `Of course, happy to arrange a viewing. I have ${sl[0].label.en} or ${sl[1].label.en}. Which works for you?`);
  }

  if (asks.location) {
    const near = (['masjid', 'school_high', 'hospital'] as PoiCat[]).map((c) => ({ c, n: nearest(p.lat, p.lng, c)! }));
    say(`العقار في حي ${d.name.ar} بالرياض، وقريب منه ${near.map(({ c, n }) => `${POI_LABEL[c].ar} (${toArDigits(n.km.toFixed(1))} كم)`).join('، ')}. اللوكيشن الدقيق أرسله لك عند تأكيد المعاينة.`,
      `It is in ${d.name.en}. Nearby: ${near.map(({ c, n }) => `${POI_LABEL[c].en.toLowerCase()} (${n.km.toFixed(1)} km)`).join(', ')}. I will share the exact pin once the viewing is confirmed.`);
  }
  for (const [f, lab] of Object.entries(FEATURE_LABEL)) {
    if (t.includes(normAr(lab.ar)) || t.includes(lab.en.toLowerCase())) say(p.features.includes(f) ? `نعم، فيه ${lab.ar}.` : `لا، ما فيه ${lab.ar} للأسف.`, p.features.includes(f) ? `Yes, it has ${lab.en.toLowerCase()}.` : `No, it does not have ${lab.en.toLowerCase()}, unfortunately.`);
  }
  if (asks.size) say(`المساحة ${toArDigits(p.area)} م²${p.rooms ? `، فيها ${toArDigits(p.rooms)} غرف نوم و${toArDigits(p.baths)} دورات مياه` : ''}.`, `The area is ${p.area} m²${p.rooms ? `, with ${p.rooms} bedrooms and ${p.baths} bathrooms` : ''}.`);
  if (asks.docs) say(`أوراق العقار مكتملة، ورقم ترخيص الإعلان ${l.adLicense}. تقدر تطّلع على الصك وقت المعاينة.`, `The paperwork is complete and the ad licence number is ${l.adLicense}. You can review the title deed at the viewing.`);
  if (asks.age) say('ما عندي عمر البناء بالضبط الحين، بتأكد لك وأرد عليك اليوم.', 'I do not have the exact build year to hand; I will check and get back to you today.');
  if (asks.pay) {
    const dep = Math.max(DEPOSIT_MIN, Math.round((l.price * DEPOSIT_RATE) / 100) * 100);
    say(l.deal === 'sale'
      ? `الحجز يكون بعربون ${money(dep, 'ar')} عن طريق زر «احجز الآن» في صفحة الإعلان، ويُخصم من السعر عند الإفراغ. والباقي يكون عند الإفراغ.`
      : 'نقبل الدفع سنوياً أو على دفعتين أو أربع دفعات، والعقد يُوثّق في منصة إيجار. تقدر تدفع الدفعة الأولى من زر «ادفع الإيجار» في صفحة الإعلان.',
      l.deal === 'sale'
        ? `You can reserve it with a ${money(dep, 'en')} deposit through “Book now” on the ad page; it is deducted from the price at title transfer, and the rest is paid at transfer.`
        : 'We accept yearly, 2 or 4 payments, and the contract is documented on Ejar. You can pay the first installment with “Pay rent” on the ad page.');
  }
  if (asks.thanks && out.length <= (first ? 1 : 0)) say('العفو، بالخدمة في أي وقت.', 'You are welcome, anytime.');

  const answered = out.length > (first ? 1 : 0);
  if (!answered) {
    say(first ? `بخصوص ${l.title.ar}، وش حاب تعرف؟ أقدر أفيدك بالسعر، المعاينة، المساحة، أو تفاصيل الموقع.` : 'أكيد، وش اللي تحب أوضحه أكثر؟ السعر، المعاينة، ولا تفاصيل العقار؟',
      first ? `About the ${l.title.en}: what would you like to know? I can help with the price, a viewing, the size or the location.` : 'Sure, what would you like me to clarify: the price, a viewing, or the property details?');
  }
  return out.join(' ');
}

/** Suggested replies: what a seeker might ask next, or what an advertiser might answer. */
export function suggestions(s: State, conv: Conversation, asAdvertiser: boolean, lang: Lang): string[] {
  const l = s.listings.find((x) => x.id === conv.listingId)!;
  const last = normAr((conv.messages.at(-1)?.text ?? '').toLowerCase());
  const T = (a: string, e: string) => (lang === 'ar' ? a : e);
  if (asAdvertiser) {
    const sl = slots();
    const out = [T('حياك الله، العقار متاح حالياً.', 'Hello, the property is still available.')];
    if (/(سعر|تفاوض|خصم|price|negotia)/.test(last)) out.unshift(T(`السعر قابل للتفاوض بشكل بسيط بعد المعاينة.`, 'There is a little room on price after a viewing.'));
    if (/(معاينه|اشوف|visit|viewing)/.test(last)) out.unshift(T(`يناسبك ${sl[0].label.ar}؟`, `Does ${sl[0].label.en} suit you?`));
    out.push(T('أرسل لك اللوكيشن الآن.', 'Sending you the location now.'), T('تقدر تحجز بالعربون من صفحة الإعلان.', 'You can book with a deposit from the ad page.'));
    return out.slice(0, 4);
  }
  const base = l.deal === 'sale'
    ? [T('السعر قابل للتفاوض؟', 'Is the price negotiable?'), T('متى أقدر أعاين العقار؟', 'When can I view it?'), T('وين موقعه بالضبط؟', 'Where exactly is it?'), T('كيف أحجزه؟', 'How do I book it?')]
    : [T('هل الإيجار قابل للتفاوض؟', 'Is the rent negotiable?'), T('متى أقدر أعاين؟', 'When can I view it?'), T('كم دفعة الإيجار؟', 'How are rent payments split?'), T('وش أقرب مدرسة؟', 'Nearest school?')];
  if (/(يناسبك|suit)/.test(last)) return [T('الموعد الأول يناسبني', 'The first slot works for me'), T('الموعد الثاني أفضل', 'The second slot is better'), ...base.slice(0, 2)];
  if (/(انزل|نزل|come down|can go)/.test(last)) return [T('تمام، موافق على السعر', 'OK, I agree to that price'), T('أبي أعاين قبل', 'I want to view it first'), T('كيف أحجزه؟', 'How do I book it?')];
  return base;
}
