// Business rules. Pure functions over State so they can later move to the Express backend unchanged.
// In production the duplicate rule is also a partial UNIQUE index in PostgreSQL:
//   UNIQUE (advertiser_account_id, land_code) WHERE status IN ('active','paused','under_review')
import type { Advertiser, AdvertiserType, Deal, Listing, Property, PropertyType, State, L10n } from '../types';
import { districtById, toArDigits, TYPE_LABEL } from '../data/seed';

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
export const LIVE_STATUSES = ['active', 'paused', 'under_review'] as const;

export const isPublic = (s: State, l: Listing) => {
  const p = s.properties.find((x) => x.id === l.propertyId);
  return l.status === 'active' && p?.availability === 'available';
};

export const lookupLandCode = (s: State, code: string) =>
  s.landRegistry.find((r) => r.code.toUpperCase() === code.trim().toUpperCase()) ?? null;

export type CreateInput = {
  landCode: string; type: PropertyType; deal: Deal; price: number; districtId: string;
  area: number; rooms: number; baths: number; features: string[]; descAr: string; descEn: string;
};
export type CreateResult =
  | { ok: true; listing: Listing; joinedExisting: boolean; otherOffers: number }
  | { ok: false; error: 'not_verified' | 'land_not_found' | 'duplicate' | 'property_closed' | 'invalid'; existingListingId?: string };

/** Duplicate check, run before publishing. Same account + same land code + a live ad = rejected. */
export function findDuplicate(s: State, advertiserId: string, landCode: string) {
  const code = landCode.trim().toUpperCase();
  return s.listings.find((l) => {
    if (l.advertiserId !== advertiserId || !(LIVE_STATUSES as readonly string[]).includes(l.status)) return false;
    const p = s.properties.find((x) => x.id === l.propertyId);
    return p?.landCode?.toUpperCase() === code;
  });
}

export function title(type: PropertyType, rooms: number, districtId: string, deal: Deal, area: number): L10n {
  const d = districtById(districtId), t = TYPE_LABEL[type];
  const dAr = deal === 'sale' ? 'للبيع' : 'للإيجار', dEn = deal === 'sale' ? 'for sale' : 'for rent';
  if (!rooms) return { ar: `${t.ar} ${toArDigits(area)} م² ${dAr} في ${d.name.ar}`, en: `${area} m² ${t.en.toLowerCase()} ${dEn} in ${d.name.en}` };
  return { ar: `${t.ar} ${toArDigits(rooms)} غرف ${dAr} في ${d.name.ar}`, en: `${rooms}-bedroom ${t.en.toLowerCase()} ${dEn} in ${d.name.en}` };
}

export function createListing(s: State, advertiserId: string, inp: CreateInput): CreateResult {
  const adv = s.advertisers.find((a) => a.id === advertiserId);
  if (!adv || adv.verified !== 'verified') return { ok: false, error: 'not_verified' };
  if (!(inp.price > 0) || !(inp.area > 0)) return { ok: false, error: 'invalid' };

  let property: Property | undefined;
  let joinedExisting = false;
  const code = inp.landCode.trim().toUpperCase();

  if (code) {
    const rec = lookupLandCode(s, code);
    if (!rec) return { ok: false, error: 'land_not_found' };
    const dup = findDuplicate(s, advertiserId, code);
    if (dup) {
      s.duplicates.unshift({ id: uid('d'), advertiserId, landCode: code, existingListingId: dup.id, at: now() });
      return { ok: false, error: 'duplicate', existingListingId: dup.id };
    }
    property = s.properties.find((p) => p.landCode?.toUpperCase() === code);
    if (property) {
      if (property.availability !== 'available') return { ok: false, error: 'property_closed' };
      joinedExisting = true;
    } else {
      property = {
        id: uid('p'), landCode: rec.code, identity: 'simulated_verified', type: inp.type, districtId: rec.districtId,
        lat: rec.lat, lng: rec.lng, area: rec.area, rooms: inp.rooms, baths: inp.baths, features: inp.features, availability: 'available',
      };
      s.properties.push(property);
    }
  } else {
    const d = districtById(inp.districtId);
    property = {
      id: uid('p'), landCode: null, identity: 'unidentified', type: inp.type, districtId: d.id,
      lat: d.lat + (Math.random() - 0.5) * 0.015, lng: d.lng + (Math.random() - 0.5) * 0.015,
      area: inp.area, rooms: inp.rooms, baths: inp.baths, features: inp.features, availability: 'available',
    };
    s.properties.push(property);
  }

  const p = property;
  const listing: Listing = {
    id: uid('l'), propertyId: p.id, advertiserId, deal: inp.deal, price: inp.price,
    title: title(p.type, p.rooms, p.districtId, inp.deal, p.area),
    desc: { ar: inp.descAr || inp.descEn || 'تفاصيل عند التواصل.', en: inp.descEn || inp.descAr || 'Details on request.' },
    imageSeed: Math.floor(Math.random() * 100000), status: 'active', featured: false, views: 0,
    adLicense: `DEMO-AD-${Math.floor(800000 + Math.random() * 99999)}`, createdAt: now().slice(0, 10),
  };
  s.listings.unshift(listing);
  const otherOffers = s.listings.filter((l) => l.propertyId === p.id && l.id !== listing.id && (LIVE_STATUSES as readonly string[]).includes(l.status)).length;
  if (joinedExisting) {
    s.listings.filter((l) => l.propertyId === p.id && l.id !== listing.id && l.status !== 'closed').forEach((l) =>
      notify(s, l.advertiserId, { ar: `أُضيف عرض منافس على عقار تعلن عنه (${p.landCode}).`, en: `A competing offer was added to a property you advertise (${p.landCode}).` }));
  }
  return { ok: true, listing, joinedExisting, otherOffers };
}

export function notify(s: State, to: string, text: L10n) {
  s.notices.unshift({ id: uid('n'), to, text, at: now(), read: false });
}

/** Commission demo. Basis for establishments is an ASSUMPTION pending business confirmation. */
export const ASSUMED_BROKERAGE = 0.025;
export function commission(type: AdvertiserType, value: number) {
  if (type === 'company') {
    return { amount: value * ASSUMED_BROKERAGE * 0.2, rule: '20% × assumed 2.5% brokerage commission' };
  }
  return { amount: value * 0.0125, rule: '1.25% of transaction value' };
}

/** Advertiser reports sold/rented. Only their own ad pauses; the property waits for verification. */
export function requestStatus(s: State, listingId: string, outcome: 'sold' | 'rented', value: number) {
  const l = s.listings.find((x) => x.id === listingId);
  if (!l || l.status === 'closed') return;
  if (s.statusRequests.some((r) => r.listingId === listingId && r.state === 'pending')) return;
  l.status = 'under_review';
  s.statusRequests.unshift({ id: uid('sr'), propertyId: l.propertyId, listingId, advertiserId: l.advertiserId, outcome, value, state: 'pending', at: now() });
}

/** Supervisor/admin verification. Approval closes the property and EVERY ad linked to it. */
export function reviewStatus(s: State, requestId: string, approve: boolean, reviewerId: string) {
  const r = s.statusRequests.find((x) => x.id === requestId);
  if (!r || r.state !== 'pending') return;
  r.state = approve ? 'approved' : 'rejected';
  r.reviewedBy = reviewerId;
  const p = s.properties.find((x) => x.id === r.propertyId)!;
  const own = s.listings.find((x) => x.id === r.listingId)!;
  if (!approve) {
    if (own.status === 'under_review') own.status = 'active';
    notify(s, r.advertiserId, { ar: 'رُفض طلب تغيير الحالة، وأُعيد إعلانك إلى نشط.', en: 'Your status change request was rejected; your ad is active again.' });
    log(s, reviewerId, `Rejected status request ${r.id}`);
    return;
  }
  s.history.unshift({ id: uid('h'), propertyId: p.id, from: p.availability, to: r.outcome, by: reviewerId, at: now(), note: 'Verified (demo)' });
  p.availability = r.outcome;
  const affected = s.listings.filter((l) => l.propertyId === p.id && l.status !== 'closed');
  affected.forEach((l) => {
    l.status = 'closed';
    l.closedReason = r.outcome;
    l.featured = false;
    notify(s, l.advertiserId, {
      ar: `تم توثيق ${r.outcome === 'sold' ? 'بيع' : 'تأجير'} العقار ${p.landCode ?? ''}؛ أُغلق إعلانك تلقائياً.`,
      en: `The property ${p.landCode ?? ''} was verified as ${r.outcome}; your ad was closed automatically.`,
    });
  });
  Object.entries(s.favorites).forEach(([u, ids]) => {
    if (ids.includes(p.id)) notify(s, u, { ar: 'عقار في مفضلتك لم يعد متاحاً.', en: 'A property in your favorites is no longer available.' });
  });
  const adv = s.advertisers.find((a) => a.id === r.advertiserId) as Advertiser;
  const c = commission(adv.type, r.value);
  s.transactions.unshift({ id: uid('t'), propertyId: p.id, listingId: r.listingId, advertiserId: r.advertiserId, value: r.value, commission: c.amount, rule: c.rule, at: now() });
  log(s, reviewerId, `Approved ${r.outcome} for ${p.landCode ?? p.id}; closed ${affected.length} ads`);
}

export function log(s: State, by: string, action: string) {
  s.adminLog.unshift({ id: uid('a'), by, action, at: now() });
}
