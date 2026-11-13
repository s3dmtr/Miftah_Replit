import type {
  Advertiser, District, LandRecord, Listing, Poi, PoiCat, Property, PropertyType, State, User, Deal, L10n,
} from '../types';

// Deterministic PRNG so the demo looks the same every time.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DISTRICTS: District[] = [
  { id: 'malqa', name: { ar: 'الملقا', en: 'Al Malqa' }, lat: 24.812, lng: 46.61 },
  { id: 'hittin', name: { ar: 'حطين', en: 'Hittin' }, lat: 24.765, lng: 46.6 },
  { id: 'yasmin', name: { ar: 'الياسمين', en: 'Al Yasmin' }, lat: 24.825, lng: 46.65 },
  { id: 'narjis', name: { ar: 'النرجس', en: 'Al Narjis' }, lat: 24.86, lng: 46.665 },
  { id: 'arid', name: { ar: 'العارض', en: 'Al Arid' }, lat: 24.885, lng: 46.61 },
  { id: 'sahafa', name: { ar: 'الصحافة', en: 'Al Sahafa' }, lat: 24.8, lng: 46.64 },
  { id: 'aqiq', name: { ar: 'العقيق', en: 'Al Aqiq' }, lat: 24.775, lng: 46.625 },
  { id: 'nada', name: { ar: 'الندى', en: 'An Nada' }, lat: 24.81, lng: 46.68 },
  { id: 'qurtubah', name: { ar: 'قرطبة', en: 'Qurtubah' }, lat: 24.825, lng: 46.745 },
  { id: 'nakheel', name: { ar: 'النخيل', en: 'Al Nakheel' }, lat: 24.745, lng: 46.64 },
  { id: 'muruj', name: { ar: 'المروج', en: 'Al Muruj' }, lat: 24.755, lng: 46.665 },
  { id: 'olaya', name: { ar: 'العليا', en: 'Al Olaya' }, lat: 24.695, lng: 46.685 },
  { id: 'wurud', name: { ar: 'الورود', en: 'Al Wurud' }, lat: 24.725, lng: 46.68 },
  { id: 'sulimaniyah', name: { ar: 'السليمانية', en: 'Al Sulimaniyah' }, lat: 24.705, lng: 46.7 },
  { id: 'rawdah', name: { ar: 'الروضة', en: 'Al Rawdah' }, lat: 24.735, lng: 46.77 },
];
export const districtById = (id: string) => DISTRICTS.find((d) => d.id === id)!;

export const TYPE_LABEL: Record<PropertyType, L10n> = {
  apartment: { ar: 'شقة', en: 'Apartment' },
  villa: { ar: 'فيلا', en: 'Villa' },
  floor: { ar: 'دور', en: 'Floor' },
  land: { ar: 'أرض', en: 'Land' },
  office: { ar: 'مكتب', en: 'Office' },
  shop: { ar: 'محل تجاري', en: 'Shop' },
};
export const COMMERCIAL: PropertyType[] = ['office', 'shop'];

export const FEATURE_LABEL: Record<string, L10n> = {
  parking: { ar: 'موقف سيارات', en: 'Parking' },
  elevator: { ar: 'مصعد', en: 'Elevator' },
  maid_room: { ar: 'غرفة خادمة', en: 'Maid room' },
  driver_room: { ar: 'غرفة سائق', en: 'Driver room' },
  pool: { ar: 'مسبح', en: 'Pool' },
  garden: { ar: 'حديقة', en: 'Garden' },
  ac: { ar: 'مكيفات', en: 'Air conditioning' },
  furnished: { ar: 'مؤثثة', en: 'Furnished' },
  basement: { ar: 'قبو', en: 'Basement' },
  roof: { ar: 'سطح خاص', en: 'Private roof' },
  street_facing: { ar: 'على شارع رئيسي', en: 'Main-street frontage' },
  corner: { ar: 'زاوية', en: 'Corner plot' },
};

export const POI_LABEL: Record<PoiCat, L10n> = {
  masjid: { ar: 'مسجد', en: 'Masjid' },
  school_middle: { ar: 'مدرسة متوسطة', en: 'Middle school' },
  school_high: { ar: 'مدرسة ثانوية', en: 'High school' },
  university: { ar: 'جامعة', en: 'University' },
  hospital: { ar: 'مستشفى', en: 'Hospital' },
  pharmacy: { ar: 'صيدلية', en: 'Pharmacy' },
  gym: { ar: 'نادي رياضي', en: 'Gym' },
  park: { ar: 'حديقة / أنشطة', en: 'Park & activities' },
  mall: { ar: 'مركز تسوق', en: 'Mall' },
};

const ADVERTISERS: Advertiser[] = [
  { id: 'c1', type: 'company', name: { ar: 'دار السنام العقارية', en: 'Dar Al Sanam Real Estate' }, license: 'DEMO-FAL-1100231', verified: 'verified', joined: '2026-02-11' },
  { id: 'c2', type: 'company', name: { ar: 'مكتب الأفق الذهبي', en: 'Golden Horizon Office' }, license: 'DEMO-FAL-1100877', verified: 'verified', joined: '2026-03-02' },
  { id: 'c3', type: 'company', name: { ar: 'شركة نخلة البيوت', en: 'Nakhla Homes Co.' }, license: 'DEMO-FAL-1101409', verified: 'verified', joined: '2026-04-19' },
  { id: 'm1', type: 'marketer', name: { ar: 'ريم أ. (مسوّقة)', en: 'Reem A. (marketer)' }, license: 'DEMO-FAL-2200516', verified: 'verified', joined: '2026-05-08' },
  { id: 'm2', type: 'marketer', name: { ar: 'عمر س. (مسوّق)', en: 'Omar S. (marketer)' }, license: 'DEMO-FAL-2200944', verified: 'verified', joined: '2026-06-21' },
  { id: 'o1', type: 'owner', name: { ar: 'عبدالله م. (مالك)', en: 'Abdullah M. (owner)' }, license: null, verified: 'verified', joined: '2026-07-14' },
  { id: 'o2', type: 'owner', name: { ar: 'هدى ك. (مالكة)', en: 'Huda K. (owner)' }, license: null, verified: 'verified', joined: '2026-08-03' },
  { id: 'm3', type: 'marketer', name: { ar: 'خالد ن. (مسوّق)', en: 'Khaled N. (marketer)' }, license: 'DEMO-FAL-2201320', verified: 'pending', joined: '2026-11-09' },
  { id: 'c4', type: 'company', name: { ar: 'مكتب رواسي للعقار', en: 'Rawasi Property Office' }, license: 'DEMO-FAL-1102055', verified: 'pending', joined: '2026-11-10' },
];

const USERS: User[] = [
  { id: 'u-seeker', name: { ar: 'لمى (باحثة عن عقار)', en: 'Lama (property seeker)' }, role: 'seeker' },
  { id: 'u-owner', name: { ar: 'عبدالله م.', en: 'Abdullah M.' }, role: 'owner', advertiserId: 'o1' },
  { id: 'u-company', name: { ar: 'دار السنام العقارية', en: 'Dar Al Sanam Real Estate' }, role: 'company', advertiserId: 'c1' },
  { id: 'u-marketer', name: { ar: 'ريم أ.', en: 'Reem A.' }, role: 'marketer', advertiserId: 'm1' },
  { id: 'u-admin', name: { ar: 'مدير المنصة', en: 'Platform admin' }, role: 'admin' },
  { id: 'u-super', name: { ar: 'مشرف المنصة', en: 'Platform supervisor' }, role: 'supervisor' },
];

const FEATS: Record<PropertyType, string[]> = {
  villa: ['parking', 'maid_room', 'driver_room', 'pool', 'garden', 'ac', 'basement', 'corner', 'elevator'],
  apartment: ['parking', 'elevator', 'ac', 'furnished', 'roof', 'maid_room'],
  floor: ['parking', 'ac', 'roof', 'maid_room', 'street_facing'],
  land: ['corner', 'street_facing'],
  office: ['parking', 'elevator', 'ac', 'furnished', 'street_facing'],
  shop: ['parking', 'street_facing', 'corner', 'ac'],
};

const round = (n: number, step: number) => Math.round(n / step) * step;
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const toArDigits = (s: string | number) => String(s).replace(/\d/g, (d) => AR_DIGITS[+d]);

function makeTitle(type: PropertyType, rooms: number, d: District, deal: Deal, area: number): L10n {
  const t = TYPE_LABEL[type];
  const dealAr = deal === 'sale' ? 'للبيع' : 'للإيجار';
  const dealEn = deal === 'sale' ? 'for sale' : 'for rent';
  if (type === 'land' || type === 'office' || type === 'shop') {
    return { ar: `${t.ar} ${toArDigits(area)} م² ${dealAr} في ${d.name.ar}`, en: `${area} m² ${t.en.toLowerCase()} ${dealEn} in ${d.name.en}` };
  }
  return { ar: `${t.ar} ${toArDigits(rooms)} غرف ${dealAr} في ${d.name.ar}`, en: `${rooms}-bedroom ${t.en.toLowerCase()} ${dealEn} in ${d.name.en}` };
}

const DESC_OPENERS: L10n[] = [
  { ar: 'عرض مميز بموقع هادئ وقريب من الخدمات.', en: 'A well-kept property on a quiet street close to daily services.' },
  { ar: 'تشطيب حديث ومساحات واسعة مع إضاءة طبيعية.', en: 'Modern finishing, generous spaces and plenty of natural light.' },
  { ar: 'فرصة مناسبة للسكن أو الاستثمار.', en: 'A sound choice to live in or to hold as an investment.' },
  { ar: 'جاهز للاستلام الفوري بعد المعاينة.', en: 'Ready to hand over right after a viewing.' },
];

function makeDesc(rng: () => number, features: string[]): L10n {
  const o = DESC_OPENERS[Math.floor(rng() * DESC_OPENERS.length)];
  const f = features.slice(0, 3);
  return {
    ar: `${o.ar} يتضمن: ${f.map((x) => FEATURE_LABEL[x].ar).join('، ') || 'تفاصيل عند التواصل'}.`,
    en: `${o.en} Includes: ${f.map((x) => FEATURE_LABEL[x].en.toLowerCase()).join(', ') || 'details on request'}.`,
  };
}

interface Spec { type: PropertyType; deal: Deal; district: string; offers: string[]; land: boolean; availability?: 'sold' | 'rented' }

// The catalogue. `offers` = advertiser accounts with an ad for the property (grouped by land code).
const SPECS: Spec[] = [
  { type: 'villa', deal: 'sale', district: 'malqa', offers: ['c1', 'c2', 'm1'], land: true },
  { type: 'villa', deal: 'sale', district: 'hittin', offers: ['c2', 'm2'], land: true },
  { type: 'apartment', deal: 'sale', district: 'yasmin', offers: ['c2', 'm2', 'c3'], land: true },
  { type: 'apartment', deal: 'rent', district: 'narjis', offers: ['o1'], land: true },
  { type: 'floor', deal: 'sale', district: 'sahafa', offers: ['c3', 'm1'], land: true },
  { type: 'land', deal: 'sale', district: 'arid', offers: ['c1', 'c3'], land: true },
  { type: 'villa', deal: 'rent', district: 'nakheel', offers: ['o2'], land: true },
  { type: 'office', deal: 'rent', district: 'olaya', offers: ['c1', 'c2'], land: true },
  { type: 'shop', deal: 'rent', district: 'wurud', offers: ['m2'], land: true },
  { type: 'apartment', deal: 'rent', district: 'aqiq', offers: ['c3'], land: true },
  { type: 'villa', deal: 'sale', district: 'qurtubah', offers: ['c1'], land: true },
  { type: 'apartment', deal: 'sale', district: 'nada', offers: ['m1'], land: false },
  { type: 'floor', deal: 'rent', district: 'rawdah', offers: ['o1'], land: false },
  { type: 'villa', deal: 'sale', district: 'yasmin', offers: ['c3', 'm1'], land: true },
  { type: 'apartment', deal: 'rent', district: 'malqa', offers: ['c2'], land: true },
  { type: 'land', deal: 'sale', district: 'narjis', offers: ['m2'], land: true },
  { type: 'office', deal: 'rent', district: 'sulimaniyah', offers: ['c3'], land: true },
  { type: 'apartment', deal: 'sale', district: 'muruj', offers: ['c1', 'o2'], land: true },
  { type: 'villa', deal: 'rent', district: 'hittin', offers: ['c1'], land: true },
  { type: 'shop', deal: 'rent', district: 'olaya', offers: ['c2'], land: false },
  { type: 'apartment', deal: 'rent', district: 'sahafa', offers: ['m1'], land: true },
  { type: 'villa', deal: 'sale', district: 'arid', offers: ['c2'], land: true },
  { type: 'floor', deal: 'sale', district: 'aqiq', offers: ['c1'], land: true },
  { type: 'apartment', deal: 'sale', district: 'qurtubah', offers: ['m2', 'c3'], land: true },
  // already closed (history)
  { type: 'villa', deal: 'sale', district: 'nada', offers: ['c2', 'm1'], land: true, availability: 'sold' },
  { type: 'apartment', deal: 'rent', district: 'yasmin', offers: ['o2'], land: true, availability: 'rented' },
];

function basePrice(rng: () => number, type: PropertyType, deal: Deal, area: number) {
  if (deal === 'sale') {
    switch (type) {
      case 'villa': return round(2_100_000 + rng() * 3_200_000, 10_000);
      case 'apartment': return round(720_000 + rng() * 900_000, 5_000);
      case 'floor': return round(1_050_000 + rng() * 850_000, 10_000);
      case 'land': return round(area * (2600 + rng() * 2400), 10_000);
      default: return round(1_500_000 + rng() * 2_000_000, 10_000);
    }
  }
  switch (type) {
    case 'villa': return round(120_000 + rng() * 140_000, 1_000);
    case 'apartment': return round(42_000 + rng() * 55_000, 1_000);
    case 'floor': return round(60_000 + rng() * 45_000, 1_000);
    case 'office': return round(area * (750 + rng() * 650), 1_000);
    case 'shop': return round(area * (900 + rng() * 900), 1_000);
    default: return round(60_000 + rng() * 60_000, 1_000);
  }
}

function buildCatalogue() {
  const rng = mulberry32(20261113);
  const properties: Property[] = [];
  const listings: Listing[] = [];
  const registry: LandRecord[] = [];
  let codeN = 10001;
  let lid = 1;

  SPECS.forEach((s, i) => {
    const d = districtById(s.district);
    const lat = d.lat + (rng() - 0.5) * 0.018;
    const lng = d.lng + (rng() - 0.5) * 0.018;
    const area =
      s.type === 'villa' ? round(300 + rng() * 350, 5)
      : s.type === 'apartment' ? round(110 + rng() * 120, 5)
      : s.type === 'floor' ? round(180 + rng() * 140, 5)
      : s.type === 'land' ? round(400 + rng() * 500, 5)
      : round(60 + rng() * 180, 5);
    const rooms = s.type === 'villa' ? 4 + Math.floor(rng() * 4) : s.type === 'apartment' ? 2 + Math.floor(rng() * 3) : s.type === 'floor' ? 3 + Math.floor(rng() * 3) : 0;
    const baths = rooms ? Math.max(1, rooms - 1 + Math.floor(rng() * 2)) : s.type === 'land' ? 0 : 1;
    const pool = FEATS[s.type];
    const features = pool.filter(() => rng() > 0.45);
    const code = s.land ? `DEMO-RYD-${codeN++}` : null;
    if (code) registry.push({ code, districtId: d.id, area, lat, lng });
    const pid = `p${i + 1}`;
    properties.push({
      id: pid, landCode: code, identity: code ? 'simulated_verified' : 'unidentified', type: s.type,
      districtId: d.id, lat, lng, area, rooms, baths, features, availability: s.availability ?? 'available',
    });
    const base = basePrice(rng, s.type, s.deal, area);
    s.offers.forEach((adv, k) => {
      const delta = k === 0 ? 0 : (rng() - 0.35) * 0.09;
      const price = round(base * (1 + delta), s.deal === 'sale' ? 5_000 : 500);
      const month = 6 + Math.floor(rng() * 5);
      const day = 1 + Math.floor(rng() * 27);
      listings.push({
        id: `l${lid++}`, propertyId: pid, advertiserId: adv, deal: s.deal, price,
        title: makeTitle(s.type, rooms, d, s.deal, area), desc: makeDesc(rng, features),
        imageSeed: Math.floor(rng() * 100000), status: s.availability ? 'closed' : 'active',
        closedReason: s.availability, featured: !s.availability && (i % 4 === 0) && k === 0,
        views: 40 + Math.floor(rng() * 900), adLicense: `DEMO-AD-${710000 + lid * 37}`,
        createdAt: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      });
    });
  });

  // Parcels in the simulated portal that nobody has advertised yet (for the "new ad" flow).
  ['malqa', 'yasmin', 'narjis', 'hittin', 'qurtubah', 'aqiq', 'olaya', 'sahafa'].forEach((dId) => {
    const d = districtById(dId);
    registry.push({
      code: `DEMO-RYD-${codeN++}`, districtId: d.id, area: round(250 + rng() * 400, 5),
      lat: d.lat + (rng() - 0.5) * 0.018, lng: d.lng + (rng() - 0.5) * 0.018,
    });
  });
  return { properties, listings, registry };
}

const POI_NAMES: Record<PoiCat, L10n[]> = {
  masjid: [{ ar: 'جامع الهدى', en: 'Al Huda Mosque' }, { ar: 'مسجد النور', en: 'An Noor Masjid' }, { ar: 'جامع التقوى', en: 'At Taqwa Mosque' }, { ar: 'مسجد الإحسان', en: 'Al Ihsan Masjid' }],
  school_middle: [{ ar: 'متوسطة الرواد', en: 'Al Rowad Middle School' }, { ar: 'متوسطة المعرفة', en: 'Al Maarifa Middle School' }],
  school_high: [{ ar: 'ثانوية الأوائل', en: 'Al Awael High School' }, { ar: 'ثانوية الفيصل', en: 'Al Faisal High School' }],
  university: [{ ar: 'جامعة الرياض للعلوم (تجريبي)', en: 'Riyadh Science University (demo)' }, { ar: 'كلية المستقبل', en: 'Future College' }, { ar: 'جامعة الشمال التقنية', en: 'North Tech University' }, { ar: 'أكاديمية الإدارة', en: 'Management Academy' }],
  hospital: [{ ar: 'مستشفى الشفاء', en: 'Ash Shifa Hospital' }, { ar: 'مستشفى الرعاية', en: 'Care Hospital' }, { ar: 'المركز الطبي الحديث', en: 'Modern Medical Center' }],
  pharmacy: [{ ar: 'صيدلية الدواء', en: 'Al Dawaa Pharmacy' }, { ar: 'صيدلية العافية', en: 'Afiya Pharmacy' }],
  gym: [{ ar: 'نادي القوة', en: 'Power Gym' }, { ar: 'نادي اللياقة', en: 'Fitness Club' }],
  park: [{ ar: 'حديقة الحي', en: 'Neighborhood Park' }, { ar: 'ممشى الواحة', en: 'Oasis Walkway' }],
  mall: [{ ar: 'مركز الرياض بلازا', en: 'Riyadh Plaza Mall' }, { ar: 'مجمع الواحة', en: 'Oasis Center' }],
};

function buildPois(): Poi[] {
  const rng = mulberry32(777);
  const out: Poi[] = [];
  let n = 1;
  const add = (cat: PoiCat, lat: number, lng: number) => {
    const names = POI_NAMES[cat];
    out.push({ id: `poi${n++}`, cat, name: names[Math.floor(rng() * names.length)], lat, lng });
  };
  const perDistrict: [PoiCat, number][] = [['masjid', 3], ['pharmacy', 2], ['school_middle', 1], ['school_high', 1], ['gym', 1], ['park', 1]];
  DISTRICTS.forEach((d) => perDistrict.forEach(([cat, count]) => {
    for (let i = 0; i < count; i++) add(cat, d.lat + (rng() - 0.5) * 0.022, d.lng + (rng() - 0.5) * 0.022);
  }));
  const city: [PoiCat, number][] = [['hospital', 7], ['university', 4], ['mall', 5]];
  city.forEach(([cat, count]) => {
    for (let i = 0; i < count; i++) add(cat, 24.69 + rng() * 0.2, 46.59 + rng() * 0.19);
  });
  return out;
}

export const POIS = buildPois();

export function initialState(): State {
  const { properties, listings, registry } = buildCatalogue();
  const pendingListing = listings.find((l) => l.propertyId === 'p8' && l.advertiserId === 'c2')!;
  pendingListing.status = 'under_review';
  return {
    version: 3,
    lang: 'ar',
    currentUserId: 'u-seeker',
    users: USERS,
    advertisers: ADVERTISERS,
    landRegistry: registry,
    properties,
    listings,
    conversations: [
      {
        id: 'cv1', listingId: 'l1', seekerId: 'u-seeker', advertiserId: 'c1',
        messages: [
          { id: 'm1', from: 'u-seeker', text: 'السلام عليكم، هل الفيلا متاحة للمعاينة هذا الأسبوع؟', at: '2026-11-11T18:20:00' },
          { id: 'm2', from: 'c1', text: 'وعليكم السلام، نعم متاحة يوم الخميس بعد العصر.', at: '2026-11-11T18:42:00' },
        ],
      },
    ],
    favorites: { 'u-seeker': ['p1', 'p3'] },
    statusRequests: [
      { id: 'sr1', propertyId: 'p8', listingId: pendingListing.id, advertiserId: 'c2', outcome: 'rented', value: pendingListing.price, state: 'pending', at: '2026-11-12T10:05:00' },
    ],
    history: [
      { id: 'h1', propertyId: 'p25', from: 'available', to: 'sold', by: 'u-super', at: '2026-10-28T12:00:00', note: 'Verified by supervisor (demo)' },
      { id: 'h2', propertyId: 'p26', from: 'available', to: 'rented', by: 'u-admin', at: '2026-11-02T09:30:00', note: 'Verified by admin (demo)' },
    ],
    duplicates: [],
    transactions: [],
    notices: [],
    reports: [{ id: 'r1', listingId: listings.find((l) => l.propertyId === 'p20')!.id, by: 'u-seeker', reason: 'Photos do not match the description', at: '2026-11-12T16:40:00', open: true }],
    adminLog: [],
  };
}
