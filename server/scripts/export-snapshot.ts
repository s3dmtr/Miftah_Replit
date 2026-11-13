// Read-only export of the live PostgreSQL data into the React app's State shape (src/data/snapshot.json).
// Used by the offline/Artifact build so the prototype shows real database records. Never writes to the DB.
// Skips records created by automated tests (sign-ups on @test.sa / @example.com, messages stamped with a 13-digit run id).
import { writeFileSync } from 'node:fs';
import { pool, q } from '../src/db.js';
import { iso, toAdvertiser, toListing, toProperty, LISTING_COLS } from '../src/mappers.js';

const testUsers = (await q(`SELECT id, advertiser_id FROM users WHERE email ~ '@(test\\.sa|example\\.com)$'`));
const skipUsers = new Set(testUsers.map((u) => u.id));
const skipAdv = new Set(testUsers.map((u) => u.advertiser_id).filter(Boolean));
const users = (await q('SELECT id, name_ar, name_en, role, advertiser_id FROM users ORDER BY created_at, id')).filter((u) => !skipUsers.has(u.id));
const convs = await q('SELECT * FROM conversations ORDER BY created_at DESC');
const msgs = (await q(`SELECT * FROM messages ORDER BY created_at`)).filter((m) => !/\d{13}$/.test(m.body));
const favs = await q('SELECT * FROM favorites');
const favorites: Record<string, string[]> = {};
for (const f of favs) (favorites[f.user_id] ??= []).push(f.property_id);

const state = {
  version: 4, lang: 'ar', currentUserId: 'u-seeker',
  users: users.map((x) => ({ id: x.id, name: { ar: x.name_ar, en: x.name_en }, role: x.role, ...(x.advertiser_id ? { advertiserId: x.advertiser_id } : {}) })),
  advertisers: (await q('SELECT * FROM advertisers')).filter((a) => !skipAdv.has(a.id)).map(toAdvertiser),
  landRegistry: (await q('SELECT * FROM land_records ORDER BY code')).map((r) => ({ code: r.code, districtId: r.district_id, area: r.area, lat: r.lat, lng: r.lng })),
  properties: (await q('SELECT * FROM properties')).map(toProperty),
  listings: (await q(`SELECT ${LISTING_COLS} FROM listings l ORDER BY l.created_at DESC`)).map(toListing),
  conversations: convs.map((c) => ({ id: c.id, listingId: c.listing_id, seekerId: c.seeker_id, advertiserId: c.advertiser_id,
    messages: msgs.filter((m) => m.conversation_id === c.id).map((m) => ({ id: m.id, from: m.sender_id, text: m.body, at: iso(m.created_at) })) })),
  favorites,
  statusRequests: (await q('SELECT * FROM status_requests ORDER BY created_at DESC')).map((r) => ({ id: r.id, propertyId: r.property_id, listingId: r.listing_id, advertiserId: r.advertiser_id, outcome: r.outcome, value: r.value, state: r.state, at: iso(r.created_at), ...(r.reviewed_by ? { reviewedBy: r.reviewed_by } : {}) })),
  history: (await q('SELECT * FROM status_history ORDER BY created_at DESC')).map((x) => ({ id: x.id, propertyId: x.property_id, from: x.from_status, to: x.to_status, by: x.by_user, at: iso(x.created_at), note: x.note })),
  duplicates: (await q('SELECT * FROM duplicate_attempts ORDER BY created_at DESC')).map((d) => ({ id: d.id, advertiserId: d.advertiser_id, landCode: d.land_code, existingListingId: d.existing_listing_id, at: iso(d.created_at) })),
  transactions: (await q('SELECT * FROM transactions ORDER BY created_at DESC')).map((t) => ({ id: t.id, propertyId: t.property_id, listingId: t.listing_id, advertiserId: t.advertiser_id, value: t.value, commission: t.commission, rule: t.rule, at: iso(t.created_at) })),
  notices: (await q('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200')).map((n) => ({ id: n.id, to: n.recipient, text: { ar: n.text_ar, en: n.text_en }, at: iso(n.created_at), read: n.read })),
  reports: (await q('SELECT * FROM reports ORDER BY created_at DESC')).filter((r) => !skipUsers.has(r.by_user)).map((r) => ({ id: r.id, listingId: r.listing_id, by: r.by_user, reason: r.reason, at: iso(r.created_at), open: r.open })),
  adminLog: (await q('SELECT * FROM admin_log ORDER BY created_at DESC LIMIT 100')).map((a) => ({ id: a.id, by: a.by_user, action: a.action, at: iso(a.created_at) })),
  exportedAt: new Date().toISOString(),
};
writeFileSync(new URL('../../src/data/snapshot.json', import.meta.url), JSON.stringify(state));
console.log('snapshot:', { users: state.users.length, properties: state.properties.length, listings: state.listings.length, conversations: state.conversations.length, messages: msgs.length });
await pool.end();
