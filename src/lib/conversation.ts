// MIFTAH agent, conversational layer. It talks like a property consultant: acknowledges what you said,
// asks one useful question at a time (with context from the real listings), understands "I don't know",
// "show me now", "something cheaper", "tell me about the first one", and only then recommends.
// Everything it says about properties comes from platform data (rank() in agent.ts).
import { COMMERCIAL, DISTRICTS, districtById, FEATURE_LABEL, POI_LABEL, TYPE_LABEL, toArDigits } from '../data/seed';
import type { L10n, PropertyType, State } from '../types';
import { fmt, normAr, parse, rank, type AgentReply, type Match, type Prefs, type Slot } from './agent';
import { nearest } from './geo';
import { isPublic } from './rules';

const T = (ar: string, en: string): L10n => ({ ar, en });
const join = (...parts: (L10n | null | undefined | false)[]): L10n => {
  const p = parts.filter(Boolean) as L10n[];
  const c = (x: string) => x.replace(/\s+/g, ' ').replace(/\s+([،,.؟?])/g, '$1').trim();
  return { ar: c(p.map((x) => x.ar).filter(Boolean).join(' ')), en: c(p.map((x) => x.en).filter(Boolean).join(' ')) };
};
const listAr = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join('، ')} و${xs.at(-1)}`);
const listEn = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

// ---------- intents ----------
const rx = (s: string, re: RegExp) => re.test(s);
function intents(raw: string) {
  const s = normAr(raw.toLowerCase()).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[؟?!.,،]/g, ' ').trim();
  return {
    s,
    greet: rx(s, /(^|\s)(السلام|سلام|مرحبا|هلا|اهلا|صباح|مساء|hi|hello|hey|salam)(\s|$)/),
    thanks: rx(s, /(شكرا|يعطيك العافيه|مشكور|جزاك|thanks|thank you|appreciate)/),
    show: rx(s, /(اعرض|وريني|ورني|عطني|ابي اشوف|النتايج|النتائج|خلاص|يكفي|show|results|go ahead|just show|let me see)/),
    dunno: rx(s, /(ما ادري|مدري|مو مهم|ما يهم|ما تفرق|ما يفرق|ما حددت|مو محدد|مو فارق|not decided|no idea|اي حي|اي شي|اي مكان|اي مكان|حسب المتوفر|any|doesn'?t matter|not sure|no preference|whatever|anything|don'?t know|open to)/),
    more: rx(s, /(غيرها|غيرهم|غيره|خيارات ثانيه|خيارات اخرى|المزيد|بدائل|more|other options|anything else|alternatives)/),
    cheaper: rx(s, /(ارخص|اقل سعر|اوفر|cheaper|lower price|less expensive|budget option)/),
    bigger: rx(s, /(اكبر|اوسع|bigger|larger|more space)/),
    yes: rx(s, /^(اي|ايه|ايوه|نعم|صح|تمام|اكيد|طيب|اوكي|yes|yeah|yep|sure|ok|okay)(\s|$)/),
    no: rx(s, /^(لا|لاء|no|nope)(\s|$)/),
    compare: rx(s, /(قارن|مقارنه|compare)/),
    widen: rx(s, /(وسع|كل الاحياء|widen|all districts|other districts)/),
    raise: rx(s, /(ارفع الميزانيه|زود الميزانيه|raise the budget|increase the budget|higher budget)/),
    financing: rx(s, /(تمويل|قرض|بنك|رهن|mortgage|loan|financ)/),
    ordinal: (() => {
      const m = s.match(/(الاول|الأول|الثاني|الثالث|first|second|third|رقم\s*(\d)|#\s*(\d)|number\s*(\d))/);
      if (!m) return 0;
      const w = m[0];
      if (/الاول|الأول|first/.test(w)) return 1;
      if (/الثاني|second/.test(w)) return 2;
      if (/الثالث|third/.test(w)) return 3;
      return +(m[2] || m[3] || m[4] || 0);
    })(),
    family: (() => {
      const m = s.match(/(\d+)\s*(افراد|اشخاص|نفر|عيال|اطفال|people|persons|kids|children|family members)/);
      return m ? +m[1] : 0;
    })(),
    asksAbout: /(فيه|في|كم|وين|هل|وش|متى|does|is there|how|what|where|has|any)/.test(s) || /[؟?]/.test(raw),
    married: rx(s, /(متزوج|عائله|عايله|اسره|family|married|wife|kids)/),
  };
}

// ---------- slots ----------
const residential = (p: Prefs) => !(p.types?.every((t) => COMMERCIAL.includes(t) || t === 'land') ?? p.category === 'commercial');
function filled(p: Prefs, slot: Slot) {
  switch (slot) {
    case 'deal': return !!p.deal;
    case 'type': return !!(p.types?.length || p.category);
    case 'district': return !!(p.districts?.length || p.anyDistrict);
    case 'budget': return !!(p.budgetMax || p.noBudget);
    case 'rooms': return !residential(p) || !!p.roomsMin || !!p.asked?.includes('rooms');
    case 'priority': return !!(p.amenities?.length || p.features?.length || p.noPriority || p.asked?.includes('priority'));
  }
}
const ORDER: Slot[] = ['deal', 'type', 'district', 'budget', 'rooms', 'priority'];
const nextSlot = (p: Prefs) => ORDER.find((x) => !filled(p, x));

/** Price range and district spread of what is actually available for the current request. */
function market(s: State, p: Prefs) {
  const types = p.types ?? (p.category === 'commercial' ? COMMERCIAL : p.category === 'residential' ? (['apartment', 'villa', 'floor', 'land'] as PropertyType[]) : undefined);
  const ls = s.listings.filter((l) => isPublic(s, l) && (!p.deal || l.deal === p.deal)).filter((l) => {
    const pr = s.properties.find((x) => x.id === l.propertyId)!;
    return (!types || types.includes(pr.type)) && (!p.districts?.length || p.districts.includes(pr.districtId));
  });
  const prices = ls.map((l) => l.price).sort((a, b) => a - b);
  const byDistrict = new Map<string, number>();
  ls.forEach((l) => { const d = s.properties.find((x) => x.id === l.propertyId)!.districtId; byDistrict.set(d, (byDistrict.get(d) ?? 0) + 1); });
  const topDistricts = [...byDistrict.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => districtById(d));
  return { count: new Set(ls.map((l) => l.propertyId)).size, min: prices[0], max: prices.at(-1), median: prices[Math.floor(prices.length / 2)], topDistricts };
}

const typeName = (p: Prefs, l: 'ar' | 'en') => {
  if (p.types?.length) return (l === 'ar' ? listAr : listEn)(p.types.map((t) => (l === 'en' ? TYPE_LABEL[t].en.toLowerCase() : TYPE_LABEL[t].ar)));
  if (p.category === 'commercial') return l === 'ar' ? 'عقار تجاري' : 'commercial property';
  if (p.category === 'residential') return l === 'ar' ? 'عقار سكني' : 'residential property';
  return l === 'ar' ? 'عقار' : 'property';
};

function summary(p: Prefs): L10n {
  const parts: L10n[] = [];
  const tn = typeName(p, 'en');
  parts.push(T(`${typeName(p, 'ar')} ${p.deal === 'rent' ? 'للإيجار' : p.deal === 'sale' ? 'للشراء' : ''}`.trim(), `${tn.charAt(0).toUpperCase() + tn.slice(1)}${p.deal ? ` to ${p.deal === 'rent' ? 'rent' : 'buy'}` : ''}`));
  if (p.districts?.length) {
    const ds = p.districts.map((d) => districtById(d).name);
    parts.push(ds.length > 4 ? T('في شمال الرياض', 'in north Riyadh') : T(`في ${listAr(ds.map((d) => d.ar))}`, `in ${listEn(ds.map((d) => d.en))}`));
  }
  if (p.budgetMax) parts.push(T(`بميزانية حدود ${fmt(p.budgetMax, 'ar')}`, `with a budget around ${fmt(p.budgetMax, 'en')}`));
  if (p.roomsMin) parts.push(T(`${toArDigits(p.roomsMin)} غرف أو أكثر`, `${p.roomsMin}+ bedrooms`));
  if (p.amenities?.length) parts.push(T(`قريب من ${listAr(p.amenities.map((a) => POI_LABEL[a].ar))}`, `near ${listEn(p.amenities.map((a) => POI_LABEL[a].en.toLowerCase()))}`));
  if (p.features?.length) parts.push(T(`فيه ${listAr(p.features.map((f) => FEATURE_LABEL[f].ar))}`, `with ${listEn(p.features.map((f) => FEATURE_LABEL[f].en.toLowerCase()))}`));
  return { ar: parts.map((x) => x.ar).join('، '), en: parts.map((x) => x.en).join(', ') };
}

/** Acknowledge what the newest message added, in a natural way. */
function acknowledge(prev: Prefs, p: Prefs, seed: number): L10n | null {
  const bits: L10n[] = [];
  if (p.deal && p.deal !== prev.deal) bits.push(p.deal === 'rent' ? T('للإيجار', 'to rent') : T('للشراء', 'to buy'));
  if (p.types && JSON.stringify(p.types) !== JSON.stringify(prev.types)) bits.push(T(typeName(p, 'ar'), typeName(p, 'en')));
  if (p.districts && JSON.stringify(p.districts) !== JSON.stringify(prev.districts)) {
    const ds = p.districts.map((d) => districtById(d).name);
    bits.push(ds.length > 4 ? T('في شمال الرياض', 'in north Riyadh') : T(`في ${listAr(ds.map((d) => d.ar))}`, `in ${listEn(ds.map((d) => d.en))}`));
  }
  if (p.budgetMax && p.budgetMax !== prev.budgetMax) bits.push(T(`بحدود ${fmt(p.budgetMax, 'ar')}`, `around ${fmt(p.budgetMax, 'en')}`));
  if (p.roomsMin && p.roomsMin !== prev.roomsMin) bits.push(T(`${toArDigits(p.roomsMin)} غرف على الأقل`, `at least ${p.roomsMin} bedrooms`));
  const newAm = (p.amenities ?? []).filter((a) => !prev.amenities?.includes(a));
  if (newAm.length) bits.push(T(`قريب من ${listAr(newAm.map((a) => POI_LABEL[a].ar))}`, `close to ${listEn(newAm.map((a) => POI_LABEL[a].en.toLowerCase()))}`));
  const newF = (p.features ?? []).filter((f) => !prev.features?.includes(f));
  if (newF.length) bits.push(T(`مع ${listAr(newF.map((f) => FEATURE_LABEL[f].ar))}`, `with ${listEn(newF.map((f) => FEATURE_LABEL[f].en.toLowerCase()))}`));
  if (!bits.length) return null;
  const openers = [T('ممتاز،', 'Great,'), T('تمام،', 'Got it,'), T('حلو،', 'Nice,'), T('واضح،', 'Clear,')];
  const o = openers[seed % openers.length];
  return T(`${o.ar} ${bits.map((b) => b.ar).join('، ')}.`, `${o.en} ${bits.map((b) => b.en).join(', ')}.`);
}

function question(s: State, p: Prefs, slot: Slot): { text: L10n; chips: L10n[] } {
  const m = market(s, p);
  switch (slot) {
    case 'deal':
      return { text: T('تبحث عن عقار للشراء ولا للإيجار؟', 'Are you looking to buy or to rent?'), chips: [T('شراء', 'Buy'), T('إيجار', 'Rent')] };
    case 'type':
      return { text: T('وش نوع العقار اللي في بالك؟ فيلا، شقة، دور، أرض، ولا تجاري مثل مكتب أو محل؟', 'What kind of property do you have in mind? A villa, apartment, floor, land, or something commercial like an office or shop?'),
        chips: [T('فيلا', 'Villa'), T('شقة', 'Apartment'), T('دور', 'Floor'), T('أرض', 'Land'), T('مكتب', 'Office')] };
    case 'district': {
      const ds = m.topDistricts;
      const ctx = ds.length ? T(` حالياً أكثر الخيارات المتاحة لطلبك في ${listAr(ds.map((d) => d.name.ar))}.`, ` Right now most options for this are in ${listEn(ds.map((d) => d.name.en))}.`) : T('', '');
      return { text: join(T('عندك حي معيّن في الرياض تفضّله؟', 'Do you have a preferred district in Riyadh?'), ctx),
        chips: [...ds.map((d) => d.name), T('شمال الرياض', 'North Riyadh'), T('ما يفرق', 'No preference')] };
    }
    case 'budget': {
      const range = !m.min ? T('', '') : m.min === m.max
        ? T(`للعلم، المتاح حالياً لطلبك ${m.count === 1 ? 'عقار واحد' : 'عقارات'} بسعر ${fmt(m.min, 'ar')}.`, `For reference, what is available right now is priced at ${fmt(m.min, 'en')}.`)
        : T(`للعلم، المتاح حالياً يبدأ من ${fmt(m.min, 'ar')} ويصل إلى ${fmt(m.max!, 'ar')}، وأغلبه حول ${fmt(m.median!, 'ar')}.`,
          `For reference, what is available now starts at ${fmt(m.min, 'en')} and goes up to ${fmt(m.max!, 'en')}, mostly around ${fmt(m.median!, 'en')}.`);
      const rent = p.deal === 'rent';
      const rounded = m.median ? [...new Set([m.min!, m.median, m.max!].map((v) => Math.round(v / (v >= 1e6 ? 1e5 : 1e3)) * (v >= 1e6 ? 1e5 : 1e3)))] : [];
      const chips = rounded.map((r) => T(`حدود ${fmt(r, 'ar')}`, `Around ${fmt(r, 'en')}`));
      return { text: join(T(rent ? 'كم ميزانيتك السنوية للإيجار تقريباً؟' : 'كم الميزانية اللي تفكر فيها تقريباً؟', rent ? 'Roughly what yearly rent are you comfortable with?' : 'Roughly what budget are you thinking of?'), range),
        chips: [...chips, T('ما حددت', 'Not decided')] };
    }
    case 'rooms':
      return { text: T('كم غرفة نوم تحتاج؟ أو قل لي كم عدد أفراد الأسرة وأنا أقدّر لك.', 'How many bedrooms do you need? Or tell me how many people will live there and I will estimate.'),
        chips: [T('٣ غرف', '3 bedrooms'), T('٤ غرف', '4 bedrooms'), T('٥ غرف أو أكثر', '5+ bedrooms'), T('عائلة من ٦ أفراد', 'Family of 6')] };
    case 'priority':
      return residential(p)
        ? { text: T('آخر سؤال: وش الأهم لك حول البيت؟ قرب مسجد، مدارس، مستشفى، نادي رياضي، ولا ما يفرق؟', 'Last question: what matters most around the home? Being close to a masjid, schools, a hospital, a gym, or no preference?'),
            chips: [T('قريب من مسجد ومدرسة', 'Near a masjid and a school'), T('قريب من مستشفى', 'Near a hospital'), T('فيه مسبح', 'With a pool'), T('ما يفرق', 'No preference')] }
        : { text: T('آخر سؤال: يهمك يكون على شارع رئيسي أو فيه مواقف؟', 'Last question: does main-street frontage or parking matter to you?'),
            chips: [T('على شارع رئيسي', 'Main-street frontage'), T('فيه مواقف', 'With parking'), T('ما يفرق', 'No preference')] };
  }
}

function reasons(m: Match, l: 'ar' | 'en', max = 3) {
  return m.criteria.filter((c) => c.ok === 'yes' && !/^(النوع|Type)/.test(c.text[l])).slice(0, max).map((c) => c.text[l]);
}

function present(s: State, p: Prefs, opts: { cheaper?: boolean; bigger?: boolean; more?: boolean }, lead?: L10n | null): AgentReply {
  let all = rank(s, p);
  if (opts.cheaper) all = [...all].sort((a, b) => a.listing.price - b.listing.price);
  if (opts.bigger) all = [...all].sort((a, b) => b.property.area - a.property.area);
  const shown = p.shown ?? [];
  const pool = opts.more ? all.filter((m) => !shown.includes(m.property.id)) : all;
  const picks = pool.slice(0, 3);
  const chipsAfter = [T('قارن بينها', 'Compare them'), T('عندك أرخص؟', 'Anything cheaper?'), T('خيارات ثانية', 'Other options'), T('حدثني عن الأول', 'Tell me about the first one')];

  if (!picks.length) {
    // Be honest and suggest the smallest change that would produce results.
    const hints: L10n[] = [];
    if (p.districts?.length && rank(s, { ...p, districts: undefined }).length) hints.push(T('لو وسّعنا البحث لأحياء ثانية بلقى لك خيارات', 'widening to other districts would give you options'));
    if (p.budgetMax) {
      const rel = rank(s, { ...p, budgetMax: undefined });
      if (rel.length) { const cheapest = Math.min(...rel.map((r) => r.listing.price)); hints.push(T(`أقل سعر متاح لنفس الطلب ${fmt(cheapest, 'ar')}`, `the lowest price for the same request is ${fmt(cheapest, 'en')}`)); }
    }
    if (p.roomsMin && rank(s, { ...p, roomsMin: undefined }).length) hints.push(T('أو تقليل عدد الغرف', 'or fewer bedrooms'));
    const text = opts.more ? T('هذا كل اللي عندي حالياً بهذي المواصفات.', 'That is everything I have with these criteria right now.')
      : join(lead, T('للأسف ما لقيت عقاراً متاحاً يطابق كل طلبك في بيانات مفتاح الحالية.', 'Unfortunately nothing available on MIFTAH matches all of that right now.'),
          hints.length ? T(`لكن ${listAr(hints.map((h) => h.ar))}. وش رأيك؟`, `But ${listEn(hints.map((h) => h.en))}. What do you think?`) : T('تبي نعدّل شي في الطلب؟', 'Shall we adjust something?'));
    return { text, matches: [], prefs: p, chips: [T('وسّع الأحياء', 'Widen districts'), T('ارفع الميزانية قليلاً', 'Raise the budget a bit'), T('ابدأ من جديد', 'Start over')] };
  }

  const top = picks[0];
  const nextP: Prefs = { ...p, focus: undefined, shown: [...new Set([...(opts.more ? shown : []), ...picks.map((m) => m.property.id)])] };
  const why = reasons(top, 'ar'), whyEn = reasons(top, 'en');
  const offers = top.offers > 1 ? T(` وعليه ${top.offers === 2 ? 'عرضين' : `${toArDigits(top.offers)} عروض`} من معلنين مختلفين، فتقدر تقارن أسعارهم.`, ` It also has ${top.offers} offers from different advertisers, so you can compare prices.`) : T('', '');
  const intro = opts.more ? T('هذي خيارات إضافية:', 'Here are some more options:')
    : opts.cheaper ? T('رتبتها لك من الأرخص:', 'Sorted from the lowest price:')
    : join(T(`خلني ألخص طلبك: ${summary(p).ar}.`, `Let me sum up: ${summary(p).en}.`));
  const pick = T(`ترشيحي الأول: «${top.listing.title.ar}» بسعر ${fmt(top.listing.price, 'ar')}، لأن ${listAr(why) || 'مواصفاته قريبة من طلبك'}.`,
    `My top pick is “${top.listing.title.en}” at ${fmt(top.listing.price, 'en')}, because ${listEn(whyEn.map((x) => x.charAt(0).toLowerCase() + x.slice(1))) || 'it is close to what you asked for'}.`);
  const alt = picks.length > 1 ? T(`وحطيت لك ${picks.length === 2 ? 'خياراً ثانياً' : 'خيارين ثانيين'} يستاهلون نظرة.`, `I also added ${picks.length - 1} alternative${picks.length > 2 ? 's' : ''} worth a look.`) : T('', '');
  const close = T('وش رأيك؟ أقدر أقارن بينها، أدور لك أرخص، أو أعطيك تفاصيل أي واحد منها.', 'What do you think? I can compare them, look for cheaper ones, or tell you more about any of them.');
  const fin = p.financing && !p.financingNoted ? T('وبخصوص التمويل: مفتاح ما يقدّم تمويلاً عقارياً، لكن تقدر تستخدم هذي الأسعار مع البنك.', 'About financing: MIFTAH does not offer mortgages, but you can take these prices to your bank.') : null;
  return { text: join(lead, intro, pick, offers, alt, fin, close), matches: picks, prefs: nextP, chips: chipsAfter };
}

function aboutResult(s: State, p: Prefs, idx: number, q: string): AgentReply | null {
  const id = p.shown?.[idx - 1];
  if (!id) return null;
  const prop = s.properties.find((x) => x.id === id);
  const ls = s.listings.filter((l) => l.propertyId === id && isPublic(s, l)).sort((a, b) => a.price - b.price);
  if (!prop || !ls.length) return null;
  const l = ls[0];
  const d = districtById(prop.districtId);
  const facts: L10n[] = [];
  const wants = (re: RegExp) => re.test(q);
  if (wants(/(متر|price per|per m)/)) facts.push(T(`سعر المتر تقريباً ${fmt(Math.round(l.price / prop.area), 'ar')}`, `about ${fmt(Math.round(l.price / prop.area), 'en')} per m²`));
  for (const [f, lab] of Object.entries(FEATURE_LABEL)) {
    if (q.includes(normAr(lab.ar)) || q.includes(lab.en.toLowerCase())) facts.push(prop.features.includes(f) ? T(`نعم، فيه ${lab.ar}`, `yes, it has ${lab.en.toLowerCase()}`) : T(`المعلن ما ذكر ${lab.ar}`, `the advertiser does not list ${lab.en.toLowerCase()}`));
  }
  for (const [c, lab] of Object.entries(POI_LABEL)) {
    if (q.includes(normAr(lab.ar)) || q.includes(lab.en.toLowerCase().split(' ')[0])) {
      const n = nearest(prop.lat, prop.lng, c as never);
      if (n) facts.push(T(`أقرب ${lab.ar} على بعد ${toArDigits(n.km.toFixed(1))} كم`, `the nearest ${lab.en.toLowerCase()} is ${n.km.toFixed(1)} km away`));
    }
  }
  if (!facts.length) {
    facts.push(T(`${TYPE_LABEL[prop.type].ar} في ${d.name.ar}، المساحة ${toArDigits(prop.area)} م²${prop.rooms ? ` و${toArDigits(prop.rooms)} غرف` : ''}`, `a ${TYPE_LABEL[prop.type].en.toLowerCase()} in ${d.name.en}, ${prop.area} m²${prop.rooms ? `, ${prop.rooms} bedrooms` : ''}`));
    facts.push(T(`أقل عرض عليه ${fmt(l.price, 'ar')}${ls.length > 1 ? ` من أصل ${toArDigits(ls.length)} عروض` : ''}`, `the lowest offer is ${fmt(l.price, 'en')}${ls.length > 1 ? ` out of ${ls.length} offers` : ''}`));
    if (prop.features.length) facts.push(T(`من مزاياه ${listAr(prop.features.slice(0, 3).map((f) => FEATURE_LABEL[f].ar))}`, `features include ${listEn(prop.features.slice(0, 3).map((f) => FEATURE_LABEL[f].en.toLowerCase()))}`));
  }
  const ord = ['الأول', 'الثاني', 'الثالث'][idx - 1] ?? toArDigits(idx);
  return {
    text: T(`بخصوص الخيار ${ord}: ${listAr(facts.map((f) => f.ar))}. تقدر تفتح صفحته وتراسل المعلن أو تحجز مباشرة.`, `About option ${idx}: ${listEn(facts.map((f) => f.en))}. You can open it to message the advertiser or book directly.`),
    matches: rank(s, p).filter((m) => m.property.id === id).slice(0, 1),
    prefs: { ...p, focus: idx },
    chips: [T('فيه مسبح؟', 'Does it have a pool?'), T('كم سعر المتر؟', 'Price per m²?'), T('وش أقرب مدرسة؟', 'Nearest school?'), T('خيارات ثانية', 'Other options')],
  };
}

/** `hint` = extra preferences understood by an LLM for this message (optional; validated by the caller). */
export function converse(s: State, message: string, prev: Prefs, hint?: Partial<Prefs>): AgentReply {
  const it = intents(message);
  const parsed = parse(message, prev);
  if (hint && !parsed.reset) parsed.prefs = { ...parsed.prefs, ...hint };
  if (parsed.reset) {
    return { text: T('أكيد، نبدأ من جديد. وش تدور عليه هالمرة؟ شراء ولا إيجار؟', 'Sure, let us start fresh. What are you looking for this time, buying or renting?'), matches: [], prefs: {}, chips: [T('شراء', 'Buy'), T('إيجار', 'Rent')] };
  }
  let p: Prefs = { ...parsed.prefs };
  let gotNew = JSON.stringify({ ...p, asked: 0, last: 0, shown: 0 }) !== JSON.stringify({ ...prev, asked: 0, last: 0, shown: 0 });

  // Answers that are not search criteria.
  if (it.family) { p.family = it.family; if (!p.roomsMin) p.roomsMin = Math.max(2, Math.ceil(it.family / 2) + 1); }
  if (it.financing) p.financing = true;
  if (it.dunno && p.last) {
    if (p.last === 'district') p.anyDistrict = true;
    if (p.last === 'budget') p.noBudget = true;
    if (p.last === 'priority') p.noPriority = true;
  }
  if (p.last === 'priority' && it.no) p.noPriority = true;
  const seed = message.length;
  if (it.widen) { p.districts = undefined; p.anyDistrict = true; gotNew = true; }
  if (it.raise && p.budgetMax) { p.budgetMax = Math.round((p.budgetMax * 1.2) / 1000) * 1000; gotNew = true; }
  const salam = it.greet && !prev.asked?.length ? (/(السلام|سلام|salam)/.test(it.s) ? T('وعليكم السلام ورحمة الله!', 'Hello!') : T('أهلاً وسهلاً!', 'Hi there!')) : null;

  // Greeting / thanks with nothing else in the message.
  if (!gotNew && it.greet && !prev.asked?.length && !prev.shown?.length) {
    const q = question(s, p, nextSlot(p) ?? 'deal');
    return { text: T(`وعليكم السلام ورحمة الله، حياك الله! أنا مساعد مفتاح، وبساعدك تلقى العقار المناسب في الرياض خطوة بخطوة. ${q.text.ar}`,
      `Hello and welcome! I am the Miftah assistant and I will help you find the right property in Riyadh, step by step. ${q.text.en}`), matches: [], prefs: { ...p, asked: [...(p.asked ?? []), nextSlot(p) ?? 'deal'], last: nextSlot(p) ?? 'deal' }, chips: q.chips };
  }
  if (!gotNew && it.thanks) {
    return { text: T(prev.shown?.length ? 'العفو، بالخدمة! إذا عجبك عقار افتح صفحته وراسل المعلن أو احجز بالعربون مباشرة. وإذا تبي أدور على شي ثاني أنا موجود.' : 'العفو! متى ما حبيت نكمل البحث أنا موجود.',
      prev.shown?.length ? 'You are welcome! If one catches your eye, open it to message the advertiser or book it with a deposit. I am here if you want to look for something else.' : 'You are welcome! I am here whenever you want to continue.'),
      matches: [], prefs: p, chips: [T('خيارات ثانية', 'Other options'), T('ابدأ من جديد', 'Start over')] };
  }

  // Follow-ups after results.
  if (prev.shown?.length) {
    if (it.ordinal) { const r = aboutResult(s, prev, it.ordinal, it.s); if (r) return r; }
    // A short question right after "tell me about #n" is about that property, not a new search filter.
    if (prev.focus && it.asksAbout && !it.more && !it.cheaper && it.s.split(' ').length <= 6) { const r = aboutResult(s, prev, prev.focus, it.s); if (r) return r; }
    if (it.compare && !gotNew) {
      return { text: T('للمقارنة: افتح أي عقار عليه أكثر من عرض واضغط «قارن العروض»، أو احفظ العقارات اللي عجبتك بالقلب ثم من «المحفوظات» اختر «قارن». تبي أرشح لك أكثر واحد عليه عروض؟',
        'To compare: open a property with several offers and tap “Compare offers”, or save the ones you like with the heart and use “Compare” in Saved. Want me to point out the one with the most offers?'), matches: [], prefs: p, chips: [T('أرخص خيار', 'Cheapest option'), T('خيارات ثانية', 'Other options')] };
    }
    if (it.cheaper && !gotNew) return present(s, p, { cheaper: true }, null);
    if (it.bigger && !gotNew) return present(s, p, { bigger: true }, T('رتبتها لك من الأكبر مساحة:', 'Sorted by the largest area:'));
    if (it.more && !gotNew) return present(s, p, { more: true }, null);
    if (gotNew) return present(s, { ...p, shown: [] }, {}, acknowledge(prev, p, seed) ?? (it.widen ? T('وسّعت البحث لكل الأحياء.', 'I widened the search to all districts.') : it.raise ? T(`رفعت الميزانية إلى ${fmt(p.budgetMax!, 'ar')}.`, `I raised the budget to ${fmt(p.budgetMax!, 'en')}.`) : null));
  }

  const ack = it.family ? null : acknowledge(prev, p, seed);
  if (it.show && (p.deal || p.types || p.category)) return present(s, p, {}, ack);

  const slot = nextSlot(p);
  if (!slot) return present(s, p, {}, ack);

  // Didn't understand anything new and it is not a "don't know": rephrase the pending question kindly.
  if (!gotNew && !it.dunno && !it.family && prev.last && prev.last === slot) {
    const q = question(s, p, slot);
    return { text: T(`ما فهمت عليك تماماً، معليش. ${q.text.ar}`, `Sorry, I did not quite get that. ${q.text.en}`), matches: [], prefs: p, chips: q.chips };
  }
  const q = question(s, p, slot);
  const helpful = it.dunno && prev.last === 'district' ? T('ولا يهمك، بدوّر لك في كل الأحياء.', 'No problem, I will search all districts.')
    : it.dunno && prev.last === 'budget' ? T('عادي، بعرض لك أفضل الخيارات بغض النظر عن السعر.', 'That is fine, I will show the best options at any price.')
    : it.family ? T(`لأسرة من ${toArDigits(it.family)} أفراد أقترح ${toArDigits(p.roomsMin!)} غرف على الأقل.`, `For ${it.family} people I suggest at least ${p.roomsMin} bedrooms.`)
    : it.financing ? T('للعلم: مفتاح ما يقدّم تمويلاً عقارياً، لكن أقدر أساعدك تلقى عقاراً بسعر يناسب التمويل.', 'Note: MIFTAH does not provide mortgages, but I can find a property priced for your financing.')
    : null;
  if (it.financing) p.financingNoted = true;
  const opener = salam ?? (!prev.asked?.length && !ack && !helpful ? T('حياك الله!', 'Welcome!') : null);
  return { text: join(opener, ack, helpful, q.text), matches: [], prefs: { ...p, asked: [...new Set([...(p.asked ?? []), slot])], last: slot }, chips: q.chips };
}

// For consumers that want to know the agent's opening line.
export const AGENT_GREETING = T('حياك الله! أنا مساعد مفتاح. قل لي وش تدور عليه بكلامك العادي، وبسألك كم سؤال بسيط عشان أرشح لك الأنسب.',
  'Welcome! I am the Miftah assistant. Tell me what you are looking for in your own words, and I will ask a few simple questions to recommend the best fit.');
export { DISTRICTS };
