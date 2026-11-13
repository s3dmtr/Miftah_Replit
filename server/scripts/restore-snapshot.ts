// Rebuild a MIFTAH database from the sanitized snapshot committed in src/data/snapshot.json
// (exported from the live PostgreSQL DB by export-snapshot.ts; it holds no emails or password hashes).
// Demo logins get SEED_PASSWORD. Refuses to touch a database that already has listings unless --force.
//   DATABASE_URL=postgres://... npx tsx scripts/restore-snapshot.ts [--force]
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { pool, tx } from '../src/db.js';
import { migrate } from '../src/migrate.js';

const snap = JSON.parse(readFileSync(new URL('../../src/data/snapshot.json', import.meta.url), 'utf8'));
const EMAIL: Record<string, string> = {
  'u-seeker': 'seeker@miftah.demo', 'u-owner': 'owner@miftah.demo', 'u-company': 'company@miftah.demo',
  'u-marketer': 'marketer@miftah.demo', 'u-admin': 'admin@miftah.demo', 'u-super': 'supervisor@miftah.demo',
};
const emailFor = (u: any) => EMAIL[u.id] ?? (u.advertiserId ? `${u.advertiserId}@miftah.demo` : `${u.id}@miftah.demo`);

await migrate();
const existing = (await pool.query('SELECT count(*)::int AS n FROM listings')).rows[0].n;
if (existing > 0 && !process.argv.includes('--force')) {
  console.error(`Refusing: target database already has ${existing} listings. Use --force to replace its contents.`);
  process.exit(1);
}
const hash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'miftah123', 10);
await tx(async (c) => {
  await c.query(`TRUNCATE admin_log, reports, notifications, transactions, duplicate_attempts, status_history, status_requests,
    favorites, messages, conversations, listing_images, listings, properties, land_records, users, advertisers CASCADE`);
  for (const a of snap.advertisers) await c.query('INSERT INTO advertisers (id,type,name_ar,name_en,license,verified,joined) VALUES ($1,$2,$3,$4,$5,$6,$7)', [a.id, a.type, a.name.ar, a.name.en, a.license, a.verified, a.joined]);
  for (const u of snap.users) await c.query('INSERT INTO users (id,email,password_hash,name_ar,name_en,role,advertiser_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [u.id, emailFor(u), hash, u.name.ar, u.name.en, u.role, u.advertiserId ?? null]);
  for (const r of snap.landRegistry) await c.query('INSERT INTO land_records (code,district_id,area,lat,lng) VALUES ($1,$2,$3,$4,$5)', [r.code, r.districtId, r.area, r.lat, r.lng]);
  for (const p of snap.properties) await c.query('INSERT INTO properties (id,land_code,identity,type,district_id,lat,lng,area,rooms,baths,features,availability) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [p.id, p.landCode, p.identity, p.type, p.districtId, p.lat, p.lng, p.area, p.rooms, p.baths, p.features, p.availability]);
  for (const l of snap.listings) {
    await c.query(`INSERT INTO listings (id,property_id,advertiser_id,deal,price,title_ar,title_en,desc_ar,desc_en,image_seed,status,closed_reason,featured,views,ad_license,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [l.id, l.propertyId, l.advertiserId, l.deal, l.price, l.title.ar, l.title.en, l.desc.ar, l.desc.en, l.imageSeed, l.status, l.closedReason ?? null, l.featured, l.views, l.adLicense, l.createdAt]);
    for (const [i, url] of (l.images ?? []).entries()) await c.query('INSERT INTO listing_images (listing_id,url,sort) VALUES ($1,$2,$3)', [l.id, url, i]);
  }
  for (const cv of snap.conversations) {
    await c.query('INSERT INTO conversations (id,listing_id,seeker_id,advertiser_id) VALUES ($1,$2,$3,$4)', [cv.id, cv.listingId, cv.seekerId, cv.advertiserId]);
    for (const m of cv.messages) await c.query('INSERT INTO messages (id,conversation_id,sender_id,body,created_at) VALUES ($1,$2,$3,$4,$5)', [m.id, cv.id, m.from, m.text, m.at]);
  }
  for (const [u, ids] of Object.entries(snap.favorites as Record<string, string[]>)) {
    if (!snap.users.some((x: any) => x.id === u)) continue;
    for (const pid of ids) await c.query('INSERT INTO favorites (user_id,property_id) VALUES ($1,$2)', [u, pid]);
  }
  for (const r of snap.statusRequests) await c.query('INSERT INTO status_requests (id,property_id,listing_id,advertiser_id,outcome,value,state,reviewed_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [r.id, r.propertyId, r.listingId, r.advertiserId, r.outcome, r.value, r.state, r.reviewedBy ?? null, r.at]);
  for (const h of snap.history) await c.query('INSERT INTO status_history (id,property_id,from_status,to_status,by_user,note,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [h.id, h.propertyId, h.from, h.to, h.by, h.note, h.at]);
  for (const d of snap.duplicates) await c.query('INSERT INTO duplicate_attempts (id,advertiser_id,land_code,existing_listing_id,created_at) VALUES ($1,$2,$3,$4,$5)', [d.id, d.advertiserId, d.landCode, d.existingListingId, d.at]);
  for (const t of snap.transactions) await c.query('INSERT INTO transactions (id,property_id,listing_id,advertiser_id,value,commission,rule,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [t.id, t.propertyId, t.listingId, t.advertiserId, t.value, t.commission, t.rule, t.at]);
  for (const n of snap.notices) await c.query('INSERT INTO notifications (id,recipient,text_ar,text_en,read,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [n.id, n.to, n.text.ar, n.text.en, n.read, n.at]);
  for (const r of snap.reports) await c.query('INSERT INTO reports (id,listing_id,by_user,reason,open,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [r.id, r.listingId, r.by, r.reason, r.open, r.at]);
  for (const a of snap.adminLog) await c.query('INSERT INTO admin_log (id,by_user,action,created_at) VALUES ($1,$2,$3,$4)', [a.id, a.by, a.action, a.at]);
});
const n = (await pool.query(`SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM properties) properties, (SELECT count(*) FROM listings) listings, (SELECT count(*) FROM messages) messages`)).rows[0];
console.log(`restored snapshot exported ${snap.exportedAt}:`, n);
await pool.end();
