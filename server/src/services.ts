// Business rules backed by PostgreSQL. Same behaviour as the prototype's src/lib/rules.ts.
import type { PoolClient } from 'pg';
import { districtById } from '../../src/data/seed.ts';
import { commission, title } from '../../src/lib/rules.ts';
import type { Deal, PropertyType } from '../../src/types.ts';
import { one, pool, q, tx } from './db.js';
import { HttpError, type AuthUser } from './http.js';
import { LISTING_COLS, toListing } from './mappers.js';

export const LIVE = ['active', 'paused', 'under_review'];

export async function notify(c: PoolClient | typeof pool, to: string, ar: string, en: string) {
  await c.query('INSERT INTO notifications (recipient, text_ar, text_en) VALUES ($1,$2,$3)', [to, ar, en]);
}
export async function adminLog(c: PoolClient | typeof pool, by: string, action: string) {
  await c.query('INSERT INTO admin_log (by_user, action) VALUES ($1,$2)', [by, action]);
}

export async function findDuplicate(advertiserId: string, landCode: string, db: PoolClient | typeof pool = pool) {
  return one<{ id: string }>(`SELECT id FROM listings WHERE advertiser_id = $1 AND upper(land_code) = upper($2) AND status = ANY($3)`, [advertiserId, landCode, LIVE], db);
}

export interface CreateListingInput {
  landCode?: string; type: PropertyType; deal: Deal; price: number; districtId?: string; area?: number;
  rooms?: number; baths?: number; features?: string[]; descAr?: string; descEn?: string; images?: string[];
}

/** Publish an ad. Duplicate rule: one live ad per advertiser per land code (also enforced by a unique index). */
export async function createListing(advertiserId: string, inp: CreateListingInput) {
  const adv = await one('SELECT verified FROM advertisers WHERE id = $1', [advertiserId]);
  if (!adv || adv.verified !== 'verified') throw new HttpError(403, 'not_verified', 'Your advertiser account must be verified before publishing');
  const code = inp.landCode?.trim().toUpperCase() || '';

  if (code) {
    const dup = await findDuplicate(advertiserId, code);
    if (dup) {
      await pool.query('INSERT INTO duplicate_attempts (advertiser_id, land_code, existing_listing_id) VALUES ($1,$2,$3)', [advertiserId, code, dup.id]);
      throw new HttpError(409, 'duplicate', 'You already have a live ad for this land code', { existingListingId: dup.id });
    }
  }

  try {
    return await tx(async (c) => {
      let propertyId: string;
      let joinedExisting = false;
      if (code) {
        const rec = await one('SELECT * FROM land_records WHERE upper(code) = $1', [code], c);
        if (!rec) throw new HttpError(404, 'land_not_found', 'Land code not found in the (simulated) spatial portal');
        await c.query(`INSERT INTO properties (land_code, identity, type, district_id, lat, lng, area, rooms, baths, features)
          VALUES ($1,'simulated_verified',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (land_code) DO NOTHING`,
          [rec.code, inp.type, rec.district_id, rec.lat, rec.lng, rec.area, inp.rooms ?? 0, inp.baths ?? 0, inp.features ?? []]);
        const p = await one('SELECT id, availability FROM properties WHERE land_code = $1 FOR UPDATE', [rec.code], c);
        if (p.availability !== 'available') throw new HttpError(409, 'property_closed', 'This property is already sold or rented');
        propertyId = p.id;
        joinedExisting = (await one('SELECT count(*)::int AS n FROM listings WHERE property_id = $1', [p.id], c))!.n > 0;
      } else {
        if (!inp.districtId || !inp.area) throw new HttpError(400, 'validation_error', 'districtId and area are required without a land code');
        const d = districtById(inp.districtId);
        if (!d) throw new HttpError(400, 'validation_error', 'Unknown district (Riyadh only)');
        const p = await one(`INSERT INTO properties (land_code, identity, type, district_id, lat, lng, area, rooms, baths, features)
          VALUES (NULL,'unidentified',$1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [inp.type, d.id, d.lat + (Math.random() - 0.5) * 0.015, d.lng + (Math.random() - 0.5) * 0.015, inp.area, inp.rooms ?? 0, inp.baths ?? 0, inp.features ?? []], c);
        propertyId = p.id;
      }
      const prop = await one('SELECT * FROM properties WHERE id = $1', [propertyId], c);
      const t = title(prop.type, prop.rooms, prop.district_id, inp.deal, prop.area);
      const l = await one(`INSERT INTO listings (property_id, advertiser_id, deal, price, title_ar, title_en, desc_ar, desc_en, image_seed, ad_license)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [propertyId, advertiserId, inp.deal, inp.price, t.ar, t.en, inp.descAr || inp.descEn || 'تفاصيل عند التواصل.', inp.descEn || inp.descAr || 'Details on request.',
          Math.floor(Math.random() * 100000), `DEMO-AD-${Math.floor(800000 + Math.random() * 99999)}`], c);
      for (const [i, url] of (inp.images ?? []).entries()) await c.query('INSERT INTO listing_images (listing_id, url, sort) VALUES ($1,$2,$3)', [l.id, url, i]);
      const others = await q('SELECT DISTINCT advertiser_id FROM listings WHERE property_id = $1 AND id <> $2 AND status = ANY($3)', [propertyId, l.id, LIVE], c);
      if (joinedExisting) for (const o of others) await notify(c, o.advertiser_id, `أُضيف عرض منافس على عقار تعلن عنه (${prop.land_code}).`, `A competing offer was added to a property you advertise (${prop.land_code}).`);
      const listing = toListing(await one(`SELECT ${LISTING_COLS} FROM listings l WHERE l.id = $1`, [l.id], c));
      return { ok: true as const, listing, joinedExisting, otherOffers: others.length };
    });
  } catch (e: any) {
    // Race: two requests passed the pre-check at once. The partial unique index decides.
    if (e?.code === '23505' && e?.constraint === 'listings_one_live_ad_per_land_code') {
      const dup = await findDuplicate(advertiserId, code);
      if (dup) await pool.query('INSERT INTO duplicate_attempts (advertiser_id, land_code, existing_listing_id) VALUES ($1,$2,$3)', [advertiserId, code, dup.id]);
      throw new HttpError(409, 'duplicate', 'You already have a live ad for this land code', { existingListingId: dup?.id });
    }
    throw e;
  }
}

/** Load a listing and check the caller may manage it (its advertiser, or staff). */
export async function ownedListing(user: AuthUser, id: string) {
  const l = await one('SELECT * FROM listings WHERE id = $1', [id]);
  if (!l) throw new HttpError(404, 'not_found', 'Listing not found');
  const staff = user.role === 'admin' || user.role === 'supervisor';
  if (!staff && l.advertiser_id !== user.advertiserId) throw new HttpError(403, 'forbidden', 'Not your listing');
  return l;
}

/** Advertiser claims sold/rented: only their own ad pauses; the property waits for verification. */
export async function requestStatus(user: AuthUser, listingId: string, value?: number) {
  const l = await ownedListing(user, listingId);
  if (l.status === 'closed') throw new HttpError(409, 'listing_closed', 'Listing is already closed');
  return tx(async (c) => {
    const r = await one(`INSERT INTO status_requests (property_id, listing_id, advertiser_id, outcome, value) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [l.property_id, l.id, l.advertiser_id, l.deal === 'sale' ? 'sold' : 'rented', value ?? l.price], c);
    await c.query(`UPDATE listings SET status = 'under_review' WHERE id = $1`, [l.id]);
    return r;
  });
}

/** Supervisor/admin verification. Approval closes the property and EVERY ad linked to it, atomically. */
export async function reviewStatus(reviewer: AuthUser, requestId: string, approve: boolean) {
  return tx(async (c) => {
    const r = await one('SELECT * FROM status_requests WHERE id = $1 FOR UPDATE', [requestId], c);
    if (!r) throw new HttpError(404, 'not_found', 'Status request not found');
    if (r.state !== 'pending') throw new HttpError(409, 'already_reviewed', 'This request was already reviewed');
    await c.query('UPDATE status_requests SET state = $2, reviewed_by = $3 WHERE id = $1', [r.id, approve ? 'approved' : 'rejected', reviewer.id]);
    if (!approve) {
      await c.query(`UPDATE listings SET status = 'active' WHERE id = $1 AND status = 'under_review'`, [r.listing_id]);
      await notify(c, r.advertiser_id, 'رُفض طلب تغيير الحالة، وأُعيد إعلانك إلى نشط.', 'Your status change request was rejected; your ad is active again.');
      await adminLog(c, reviewer.id, `Rejected status request ${r.id}`);
      return { approved: false, closedListings: 0 };
    }
    const p = await one('SELECT * FROM properties WHERE id = $1 FOR UPDATE', [r.property_id], c);
    await c.query('INSERT INTO status_history (property_id, from_status, to_status, by_user, note) VALUES ($1,$2,$3,$4,$5)', [p.id, p.availability, r.outcome, reviewer.id, 'Verified']);
    await c.query('UPDATE properties SET availability = $2 WHERE id = $1', [p.id, r.outcome]);
    const closed = await q(`UPDATE listings SET status = 'closed', closed_reason = $2, featured = false WHERE property_id = $1 AND status <> 'closed' RETURNING advertiser_id`, [p.id, r.outcome], c);
    for (const a of new Set(closed.map((x) => x.advertiser_id))) {
      await notify(c, a, `تم توثيق ${r.outcome === 'sold' ? 'بيع' : 'تأجير'} العقار ${p.land_code ?? ''}؛ أُغلق إعلانك تلقائياً.`, `The property ${p.land_code ?? ''} was verified as ${r.outcome}; your ad was closed automatically.`);
    }
    for (const f of await q('SELECT user_id FROM favorites WHERE property_id = $1', [p.id], c)) {
      await notify(c, f.user_id, 'عقار في مفضلتك لم يعد متاحاً.', 'A property in your favorites is no longer available.');
    }
    // Any other pending claims on the same property are now moot.
    await c.query(`UPDATE status_requests SET state = 'rejected', reviewed_by = $2 WHERE property_id = $1 AND state = 'pending'`, [p.id, reviewer.id]);
    const adv = await one('SELECT type FROM advertisers WHERE id = $1', [r.advertiser_id], c);
    const cm = commission(adv.type, r.value);
    await c.query('INSERT INTO transactions (property_id, listing_id, advertiser_id, value, commission, rule) VALUES ($1,$2,$3,$4,$5,$6)', [p.id, r.listing_id, r.advertiser_id, r.value, cm.amount, cm.rule]);
    await adminLog(c, reviewer.id, `Approved ${r.outcome} for ${p.land_code ?? p.id}; closed ${closed.length} ads`);
    return { approved: true, closedListings: closed.length, commission: cm };
  });
}
