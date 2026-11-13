// Demo AI agent: a rule-based parser + scorer that stands in for the OpenAI tool-calling agent.
// It only ever recommends listings that exist in the platform data and explains every criterion.
import { COMMERCIAL, DISTRICTS, districtById, POI_LABEL, FEATURE_LABEL, TYPE_LABEL, toArDigits } from '../data/seed';
import type { Deal, L10n, Lang, Listing, PoiCat, Property, PropertyType, State } from '../types';
import { km, nearest } from './geo';
import { isPublic } from './rules';

export interface Prefs {
  deal?: Deal;
  types?: PropertyType[];
  category?: 'residential' | 'commercial';
  budgetMax?: number;
  budgetMin?: number;
  districts?: string[];
  roomsMin?: number;
  areaMin?: number;
  amenities?: PoiCat[];
  features?: string[];
}

export interface Criterion { ok: 'yes' | 'partial' | 'no'; text: L10n }
export interface Match { listing: Listing; property: Property; score: number; criteria: Criterion[]; offers: number }
export interface AgentReply { text: L10n; matches: Match[]; prefs: Prefs; chips: L10n[] }

const AR_IND = '٠١٢٣٤٥٦٧٨٩';
const NORTH = ['malqa', 'yasmin', 'narjis', 'arid', 'sahafa', 'aqiq', 'nada', 'qurtubah', 'hittin'];
const AR_NUM: Record<string, number> = { 'غرفتين': 2, 'غرفتان': 2, 'ثلاث': 3, 'ثلاثة': 3, 'أربع': 4, 'اربع': 4, 'أربعة': 4, 'خمس': 5, 'خمسة': 5, 'ست': 6, 'ستة': 6 };

/** Unify Arabic spelling variants (hamza forms, taa marbuta, alef maqsura, diacritics) so «للايجار» = «للإيجار». */
export const normAr = (x: string) => x.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const AR_WORD = /[\u0600-\u06FF]/;
// Arabic words may carry attached prefixes (و/ف + ب/ل/ك + ال/لل), e.g. «بالنرجس», «وللإيجار»; the word must end there,
// so «جامع» (mosque) does not match «جامعة» (university).
const has = (s: string, words: string[]) => words.some((w) => AR_WORD.test(w)
  ? new RegExp(`(^|[^\\p{L}])(?:و|ف)?(?:ب|ل|ك)?(?:ال|لل)?${normAr(w)}(?=$|[^\\p{L}])`, 'u').test(s)
  : new RegExp(`(^|[^\\p{L}])${w}`, 'iu').test(s));

export function isArabic(s: string) { return /[؀-ۿ]/.test(s); }

/** A message that changes the deal or property type starts a new search: earlier rooms/budget/features no longer apply. */
export function parse(raw: string, prev: Prefs): { prefs: Prefs; reset: boolean } {
  const fresh = parseInto(raw, {});
  if (fresh.reset) return fresh;
  const sameList = (a?: string[], b?: string[]) => !a || !b || (a.length === b.length && a.every((x) => b.includes(x)));
  const newSearch = (fresh.prefs.deal && prev.deal && fresh.prefs.deal !== prev.deal) || !sameList(fresh.prefs.types, prev.types);
  return newSearch ? fresh : parseInto(raw, prev);
}

function parseInto(raw: string, prev: Prefs): { prefs: Prefs; reset: boolean } {
  const s = normAr(raw.replace(/[٠-٩]/g, (d) => String(AR_IND.indexOf(d))).replace(/(\d),(\d)/g, '$1$2').replace(/٬/g, '').replace(/٫/g, '.'));
  if (has(s, ['start over', 'reset', 'من جديد', 'ابدأ', 'إعادة'])) return { prefs: {}, reset: true };
  const p: Prefs = { ...prev };

  if (has(s, ['rent', 'renting', 'lease', 'إيجار', 'ايجار', 'للإيجار', 'استئجار', 'أستأجر', 'استأجر', 'تأجير', 'اجار', 'ايجاري', 'سنوي'])) p.deal = 'rent';
  else if (has(s, ['buy', 'purchase', 'for sale', 'own', 'شراء', 'اشتري', 'أشتري', 'للبيع', 'بيع', 'تملك', 'أتملك', 'تمليك', 'اشتريها', 'شراءها'])) p.deal = 'sale';

  const types: PropertyType[] = [];
  if (has(s, ['villa', 'duplex', 'فيلا', 'فله', 'فيلة', 'فلل', 'دوبلكس', 'دبلكس'])) types.push('villa');
  if (has(s, ['apartment', 'flat', 'شقة', 'شقه', 'شقق'])) types.push('apartment');
  if (has(s, ['floor']) || /(^|[^\p{L}])(?:ال)?دور(?=$|[^\p{L}])/u.test(s)) types.push('floor');
  if (has(s, ['land', 'plot', 'أرض', 'ارض', 'اراضي', 'قطعة'])) types.push('land');
  if (has(s, ['office', 'مكتب', 'مكاتب'])) types.push('office');
  if (has(s, ['shop', 'store', 'retail', 'محل', 'محلات', 'معرض'])) types.push('shop');
  if (types.length) { p.types = types; p.category = undefined; }
  if (has(s, ['commercial', 'تجاري'])) { p.category = 'commercial'; if (!types.length) p.types = undefined; }
  if (has(s, ['residential', 'سكني', 'للسكن'])) { p.category = 'residential'; if (!types.length) p.types = undefined; }

  // money
  const money: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(million|mil|m\b|مليون|ملايين|k\b|thousand|ألف|الف|آلاف)/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const n = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    money.push(/^(million|mil|m|مليون|ملايين)$/.test(u) ? n * 1_000_000 : n * 1000);
  }
  // Spoken amounts: «مليون ونص» = 1.5M, «٣ مليون ونص» = 3.5M, «نص مليون» = 500K, «مليونين» = 2M.
  if (/(\d+(?:\.\d+)?)\s*(?:مليون|ملايين)\s*و\s*(?:نص|نصف)/.test(s)) {
    const n = parseFloat(s.match(/(\d+(?:\.\d+)?)\s*(?:مليون|ملايين)\s*و\s*(?:نص|نصف)/)![1]);
    money.length = 0; money.push((n + 0.5) * 1_000_000);
  } else if (/(?:^|[^\d\s]\s*|\s)ب?مليون\s*و\s*(?:نص|نصف)/.test(s)) { money.length = 0; money.push(1_500_000); }
  if (/(?:نص|نصف)\s*مليون/.test(s)) { money.length = 0; money.push(500_000); }
  if (/مليونين/.test(s)) money.push(2_000_000);
  if (/(^|[^\p{L}])(?:ب)?مليون(?=$|[^\p{L}])/u.test(s) && !money.length) money.push(1_000_000);
  if (!money.length) {
    for (const mm of s.matchAll(/(\d{5,})/g)) money.push(parseInt(mm[1], 10));
  }
  if (money.length >= 2 && has(s, ['between', 'from', 'بين', 'من'])) {
    p.budgetMin = Math.min(...money); p.budgetMax = Math.max(...money);
  } else if (money.length) {
    p.budgetMax = Math.max(...money); p.budgetMin = undefined;
  }

  const rooms = s.match(/(\d+)\s*-?\s*(bed|beds|bedroom|bedrooms|rooms?|br|غرف|غرفة|غرفه)/i);
  if (rooms) p.roomsMin = parseInt(rooms[1], 10);
  else {
    for (const [w, n] of Object.entries(AR_NUM)) { const nw = normAr(w); if (s.includes(`${nw} غرف`) || (nw.startsWith('غرفت') && s.includes(nw))) p.roomsMin = n; }
  }
  const area = s.match(/(\d+)\s*(m2|m²|sqm|square|متر|م²|م2)/i);
  if (area) p.areaMin = parseInt(area[1], 10);

  const ds: string[] = [];
  const lower = s.toLowerCase();
  for (const d of DISTRICTS) {
    const en = d.name.en.toLowerCase(), enShort = en.replace(/^(al|an|as) /, '');
    const ar = normAr(d.name.ar), arShort = ar.replace(/^ال/, '');
    if (lower.includes(en) || new RegExp(`\\b${enShort}\\b`, 'i').test(lower) || s.includes(ar) || (arShort.length > 3 && new RegExp(`(^|[^\\p{L}])(?:و|ف)?(?:ب|ل)?(?:ال)?${arShort}(?=$|[^\\p{L}])`, 'u').test(s))) ds.push(d.id);
  }
  if (has(s, ['north riyadh', 'north of riyadh', 'شمال الرياض', 'الشمال'])) ds.push(...NORTH);
  if (ds.length) p.districts = [...new Set(ds)];

  const am = new Set<PoiCat>(p.amenities ?? []);
  if (has(s, ['masjid', 'mosque', 'مسجد', 'جامع'])) am.add('masjid');
  if (has(s, ['middle school', 'متوسطة', 'متوسط', 'المتوسطه'])) am.add('school_middle');
  if (has(s, ['high school', 'ثانوية', 'ثانوي'])) am.add('school_high');
  if (has(s, ['school', 'schools', 'مدرسة', 'مدارس']) && !am.has('school_middle') && !am.has('school_high')) { am.add('school_middle'); am.add('school_high'); }
  if (has(s, ['university', 'college', 'جامعة', 'كلية'])) am.add('university');
  if (has(s, ['hospital', 'مستشفى', 'مستشفي'])) am.add('hospital');
  if (has(s, ['pharmacy', 'صيدلية', 'صيدليه'])) am.add('pharmacy');
  if (has(s, ['gym', 'fitness', 'نادي', 'جيم'])) am.add('gym');
  if (has(s, ['park', 'activities', 'حديقة', 'أنشطة', 'ممشى'])) am.add('park');
  if (has(s, ['mall', 'shopping', 'مول', 'تسوق'])) am.add('mall');
  if (am.size) p.amenities = [...am];

  const ft = new Set(p.features ?? []);
  if (has(s, ['pool', 'مسبح'])) ft.add('pool');
  if (has(s, ['elevator', 'lift', 'مصعد'])) ft.add('elevator');
  if (has(s, ['furnished', 'مفروش', 'مؤثث'])) ft.add('furnished');
  if (has(s, ['parking', 'موقف'])) ft.add('parking');
  if (has(s, ['maid', 'خادمة'])) ft.add('maid_room');
  if (has(s, ['driver', 'سائق'])) ft.add('driver_room');
  if (has(s, ['garden', 'حوش'])) ft.add('garden');
  if (ft.size) p.features = [...ft];

  return { prefs: p, reset: false };
}

export const fmt = (n: number, lang: Lang) => {
  const out = n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}${lang === 'ar' ? ' مليون' : 'M'}`
    : n >= 1000 ? `${Math.round(n / 1000)}${lang === 'ar' ? ' ألف' : 'K'}` : String(n);
  return lang === 'ar' ? toArDigits(out) : out;
};
const kmTxt = (d: number) => ({ ar: `${toArDigits(d.toFixed(1))} كم`, en: `${d.toFixed(1)} km` });

export function rank(s: State, p: Prefs): Match[] {
  const types = p.types ?? (p.category === 'commercial' ? COMMERCIAL : p.category === 'residential' ? (['apartment', 'villa', 'floor', 'land'] as PropertyType[]) : undefined);
  const byProperty = new Map<string, Listing[]>();
  s.listings.filter((l) => isPublic(s, l)).forEach((l) => {
    const arr = byProperty.get(l.propertyId) ?? [];
    arr.push(l);
    byProperty.set(l.propertyId, arr);
  });
  const out: Match[] = [];
  for (const [pid, ls] of byProperty) {
    const prop = s.properties.find((x) => x.id === pid)!;
    if (types && !types.includes(prop.type)) continue;
    const candidates = ls.filter((l) => !p.deal || l.deal === p.deal);
    if (!candidates.length) continue;
    const l = candidates.reduce((a, b) => (b.price < a.price ? b : a));
    if (p.budgetMax && l.price > p.budgetMax * 1.1) continue;
    if (p.budgetMin && l.price < p.budgetMin * 0.85) continue;

    let score = 0, max = 0;
    const c: Criterion[] = [];
    const d = districtById(prop.districtId);
    if (p.budgetMax) {
      max += 30;
      if (l.price <= p.budgetMax) { score += 30; c.push({ ok: 'yes', text: { ar: `السعر ${fmt(l.price, 'ar')} ريال ضمن ميزانيتك`, en: `Price SAR ${fmt(l.price, 'en')} is within your budget` } }); }
      else { score += 12; c.push({ ok: 'partial', text: { ar: `السعر أعلى من ميزانيتك بنسبة ${toArDigits(Math.round((l.price / p.budgetMax - 1) * 100))}٪`, en: `Price is ${Math.round((l.price / p.budgetMax - 1) * 100)}% above your budget` } }); }
    }
    if (p.districts?.length) {
      max += 25;
      if (p.districts.includes(prop.districtId)) { score += 25; c.push({ ok: 'yes', text: { ar: `في حي ${d.name.ar} الذي طلبته`, en: `In ${d.name.en}, a district you asked for` } }); }
      else {
        const near = Math.min(...p.districts.map((id) => { const x = districtById(id); return km(prop.lat, prop.lng, x.lat, x.lng); }));
        if (near <= 3.5) { score += 14; c.push({ ok: 'partial', text: { ar: `في ${d.name.ar}، على بعد ${kmTxt(near).ar} من الحي المطلوب`, en: `In ${d.name.en}, ${kmTxt(near).en} from your preferred district` } }); }
        else { c.push({ ok: 'no', text: { ar: `في ${d.name.ar}، خارج الأحياء المطلوبة`, en: `In ${d.name.en}, outside your preferred districts` } }); }
      }
    }
    if (types) { max += 15; score += 15; c.push({ ok: 'yes', text: { ar: `النوع: ${TYPE_LABEL[prop.type].ar}`, en: `Type: ${TYPE_LABEL[prop.type].en}` } }); }
    if (p.roomsMin) {
      max += 10;
      if (prop.rooms >= p.roomsMin) { score += 10; c.push({ ok: 'yes', text: { ar: `${toArDigits(prop.rooms)} غرف (طلبت ${toArDigits(p.roomsMin)}+)`, en: `${prop.rooms} bedrooms (you asked ${p.roomsMin}+)` } }); }
      else if (prop.rooms === p.roomsMin - 1) { score += 4; c.push({ ok: 'partial', text: { ar: `${toArDigits(prop.rooms)} غرف، أقل بغرفة واحدة`, en: `${prop.rooms} bedrooms, one fewer than asked` } }); }
      else { c.push({ ok: 'no', text: { ar: `${toArDigits(prop.rooms)} غرف فقط`, en: `Only ${prop.rooms} bedrooms` } }); }
    }
    if (p.areaMin) {
      max += 10;
      if (prop.area >= p.areaMin) { score += 10; c.push({ ok: 'yes', text: { ar: `المساحة ${toArDigits(prop.area)} م²`, en: `Area ${prop.area} m²` } }); }
      else if (prop.area >= p.areaMin * 0.9) { score += 5; c.push({ ok: 'partial', text: { ar: `المساحة ${toArDigits(prop.area)} م²، أقل قليلاً`, en: `Area ${prop.area} m², slightly smaller` } }); }
      else c.push({ ok: 'no', text: { ar: `المساحة ${toArDigits(prop.area)} م² فقط`, en: `Area only ${prop.area} m²` } });
    }
    for (const a of p.amenities ?? []) {
      max += 8;
      const n = nearest(prop.lat, prop.lng, a);
      if (!n) continue;
      const lab = POI_LABEL[a];
      if (n.km <= 1.2) { score += 8; c.push({ ok: 'yes', text: { ar: `${lab.ar} على بعد ${kmTxt(n.km).ar} (${n.poi.name.ar})`, en: `${lab.en} ${kmTxt(n.km).en} away (${n.poi.name.en})` } }); }
      else if (n.km <= 3) { score += 4; c.push({ ok: 'partial', text: { ar: `أقرب ${lab.ar} على بعد ${kmTxt(n.km).ar}`, en: `Nearest ${lab.en.toLowerCase()} is ${kmTxt(n.km).en} away` } }); }
      else c.push({ ok: 'no', text: { ar: `أقرب ${lab.ar} على بعد ${kmTxt(n.km).ar}`, en: `Nearest ${lab.en.toLowerCase()} is ${kmTxt(n.km).en} away` } });
    }
    for (const f of p.features ?? []) {
      max += 6;
      const lab = FEATURE_LABEL[f];
      if (prop.features.includes(f)) { score += 6; c.push({ ok: 'yes', text: { ar: `يتضمن ${lab.ar}`, en: `Has ${lab.en.toLowerCase()}` } }); }
      else c.push({ ok: 'no', text: { ar: `لم يذكر المعلن: ${lab.ar}`, en: `Advertiser does not list: ${lab.en.toLowerCase()}` } });
    }
    out.push({ listing: l, property: prop, score: max ? score / max : 0.5, criteria: c, offers: ls.length });
  }
  return out.sort((a, b) => b.score - a.score || a.listing.price - b.listing.price);
}

const T = (ar: string, en: string): L10n => ({ ar, en });

export function respond(s: State, message: string, prev: Prefs): AgentReply {
  const { prefs, reset } = parse(message, prev);
  if (reset) return { text: T('تمام، لنبدأ من جديد. هل تبحث عن شراء أم إيجار؟', 'Sure, starting over. Are you looking to buy or to rent?'), matches: [], prefs: {}, chips: [T('أريد الشراء', 'I want to buy'), T('أريد الإيجار', 'I want to rent')] };

  if (!prefs.deal) return { text: T('أهلاً! هل تبحث عن عقار للشراء أم للإيجار؟', 'Hi! Are you looking to buy or to rent?'), matches: [], prefs, chips: [T('شراء', 'Buy'), T('إيجار', 'Rent')] };
  if (!prefs.types && !prefs.category) return { text: T('ما نوع العقار الذي تبحث عنه؟', 'What type of property are you looking for?'), matches: [], prefs, chips: [T('فيلا', 'Villa'), T('شقة', 'Apartment'), T('دور', 'Floor'), T('أرض', 'Land'), T('مكتب تجاري', 'Office'), T('محل', 'Shop')] };
  if (!prefs.budgetMax) {
    const rent = prefs.deal === 'rent';
    return {
      text: T(rent ? 'ما ميزانيتك السنوية للإيجار تقريباً؟' : 'ما الميزانية القصوى للشراء تقريباً؟', rent ? 'Roughly what is your yearly rent budget?' : 'Roughly what is your maximum purchase budget?'),
      matches: [], prefs,
      chips: rent ? [T('حتى ٦٠ ألف', 'Up to 60K'), T('حتى ١٢٠ ألف', 'Up to 120K'), T('حتى ٢٥٠ ألف', 'Up to 250K')] : [T('حتى مليون', 'Up to 1M'), T('حتى ٣ مليون', 'Up to 3M'), T('حتى ٥ مليون', 'Up to 5M')],
    };
  }

  const matches = rank(s, prefs).slice(0, 4);
  const chips: L10n[] = [];
  if (!prefs.districts) chips.push(T('في شمال الرياض', 'In north Riyadh'), T('في الملقا', 'In Al Malqa'));
  if (!prefs.amenities) chips.push(T('قريب من مسجد ومدرسة', 'Near a masjid and a school'), T('قريب من مستشفى وصيدلية', 'Near a hospital and pharmacy'));
  if (!prefs.roomsMin && prefs.types?.some((t) => ['villa', 'apartment', 'floor'].includes(t))) chips.push(T('٤ غرف على الأقل', 'At least 4 bedrooms'));
  chips.push(T('ابدأ من جديد', 'Start over'));

  if (!matches.length) {
    return { text: T('لم أجد عقاراً متاحاً يطابق هذه المتطلبات في البيانات الحالية. جرّب رفع الميزانية أو توسيع الأحياء.', 'I found no available property in the current data that fits these requirements. Try a higher budget or more districts.'), matches, prefs, chips };
  }
  const n = matches.length;
  return {
    text: T(`وجدت ${n === 1 ? 'عقاراً واحداً مناسباً' : n === 2 ? 'عقارين مناسبين' : `${toArDigits(n)} عقارات مناسبة`}، مرتبة حسب درجة التطابق. هذه نتائج من بيانات المنصة فقط، وتأكد من التفاصيل مع المعلن.`,
      `I found ${n} ${n === 1 ? 'property' : 'properties'}, ranked by how well they match. These come only from platform data; confirm details with the advertiser.`),
    matches, prefs, chips,
  };
}
