// Row -> frontend type mappers. Output shapes match src/types.ts exactly so the React app can use them unchanged.
import type { Advertiser, Listing, Property } from '../../src/types.ts';

export const LISTING_COLS = `l.id, l.property_id, l.advertiser_id, l.deal, l.price, l.title_ar, l.title_en, l.desc_ar, l.desc_en,
  l.image_seed, l.status, l.closed_reason, l.featured, l.views, l.ad_license, l.created_at,
  COALESCE((SELECT json_agg(url ORDER BY sort) FROM listing_images i WHERE i.listing_id = l.id), '[]') AS images`;

export const toListing = (r: any): Listing & { images: string[] } => ({
  id: r.id, propertyId: r.property_id, advertiserId: r.advertiser_id, deal: r.deal, price: r.price,
  title: { ar: r.title_ar, en: r.title_en }, desc: { ar: r.desc_ar, en: r.desc_en }, imageSeed: r.image_seed,
  status: r.status, featured: r.featured, views: r.views, adLicense: r.ad_license,
  createdAt: new Date(r.created_at).toISOString().slice(0, 10), ...(r.closed_reason ? { closedReason: r.closed_reason } : {}),
  images: r.images ?? [],
});

export const toProperty = (r: any): Property => ({
  id: r.id, landCode: r.land_code, identity: r.identity, type: r.type, districtId: r.district_id, lat: r.lat, lng: r.lng,
  area: r.area, rooms: r.rooms, baths: r.baths, features: r.features, availability: r.availability,
});

export const toAdvertiser = (r: any): Advertiser => ({
  id: r.id, type: r.type, name: { ar: r.name_ar, en: r.name_en }, license: r.license, verified: r.verified,
  joined: new Date(r.joined).toISOString().slice(0, 10),
});

export const iso = (d: Date | string) => new Date(d).toISOString();
