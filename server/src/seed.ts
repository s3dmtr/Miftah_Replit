// Seeds the database from the SAME fictional catalogue the frontend prototype uses (src/data/seed.ts).
import bcrypt from 'bcryptjs';
import { initialState } from '../../src/data/seed.ts';
import { pool, tx } from './db.js';
import { migrate } from './migrate.js';

const EMAIL: Record<string, string> = {
  'u-seeker': 'seeker@miftah.demo', 'u-owner': 'owner@miftah.demo', 'u-company': 'company@miftah.demo',
  'u-marketer': 'marketer@miftah.demo', 'u-admin': 'admin@miftah.demo', 'u-super': 'supervisor@miftah.demo',
};

export async function seed() {
  await migrate();
  const s = initialState();
  const hash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'miftah123', 10);

  await tx(async (c) => {
    await c.query(`TRUNCATE admin_log, reports, notifications, transactions, duplicate_attempts, status_history, status_requests,
      favorites, messages, conversations, listing_images, listings, properties, land_records, users, advertisers CASCADE`);

    for (const a of s.advertisers) {
      await c.query('INSERT INTO advertisers (id,type,name_ar,name_en,license,verified,joined) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [a.id, a.type, a.name.ar, a.name.en, a.license, a.verified, a.joined]);
    }
    for (const u of s.users) {
      await c.query('INSERT INTO users (id,email,password_hash,name_ar,name_en,role,advertiser_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [u.id, EMAIL[u.id], hash, u.name.ar, u.name.en, u.role, u.advertiserId ?? null]);
    }
    // Every other advertiser account also gets a login: <advertiserId>@miftah.demo
    for (const a of s.advertisers.filter((x) => !s.users.some((u) => u.advertiserId === x.id))) {
      await c.query('INSERT INTO users (id,email,password_hash,name_ar,name_en,role,advertiser_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [`u-${a.id}`, `${a.id}@miftah.demo`, hash, a.name.ar, a.name.en, a.type, a.id]);
    }
    for (const r of s.landRegistry) {
      await c.query('INSERT INTO land_records (code,district_id,area,lat,lng) VALUES ($1,$2,$3,$4,$5)', [r.code, r.districtId, r.area, r.lat, r.lng]);
    }
    for (const p of s.properties) {
      await c.query('INSERT INTO properties (id,land_code,identity,type,district_id,lat,lng,area,rooms,baths,features,availability) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [p.id, p.landCode, p.identity, p.type, p.districtId, p.lat, p.lng, p.area, p.rooms, p.baths, p.features, p.availability]);
    }
    for (const l of s.listings) {
      await c.query(`INSERT INTO listings (id,property_id,advertiser_id,deal,price,title_ar,title_en,desc_ar,desc_en,image_seed,status,closed_reason,featured,views,ad_license,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [l.id, l.propertyId, l.advertiserId, l.deal, l.price, l.title.ar, l.title.en, l.desc.ar, l.desc.en, l.imageSeed, l.status, l.closedReason ?? null, l.featured, l.views, l.adLicense, l.createdAt]);
    }
    for (const cv of s.conversations) {
      await c.query('INSERT INTO conversations (id,listing_id,seeker_id,advertiser_id) VALUES ($1,$2,$3,$4)', [cv.id, cv.listingId, cv.seekerId, cv.advertiserId]);
      for (const m of cv.messages) await c.query('INSERT INTO messages (id,conversation_id,sender_id,body,created_at) VALUES ($1,$2,$3,$4,$5)', [m.id, cv.id, m.from, m.text, m.at]);
    }
    for (const [u, ids] of Object.entries(s.favorites)) for (const pid of ids) await c.query('INSERT INTO favorites (user_id,property_id) VALUES ($1,$2)', [u, pid]);
    for (const r of s.statusRequests) {
      await c.query('INSERT INTO status_requests (id,property_id,listing_id,advertiser_id,outcome,value,state,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [r.id, r.propertyId, r.listingId, r.advertiserId, r.outcome, r.value, r.state, r.at]);
    }
    for (const h of s.history) {
      await c.query('INSERT INTO status_history (id,property_id,from_status,to_status,by_user,note,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [h.id, h.propertyId, h.from, h.to, h.by, h.note, h.at]);
    }
    for (const r of s.reports) {
      await c.query('INSERT INTO reports (id,listing_id,by_user,reason,open,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [r.id, r.listingId, r.by, r.reason, r.open, r.at]);
    }
  });
  const counts = (await pool.query(`SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM properties) properties,
    (SELECT count(*) FROM listings) listings, (SELECT count(*) FROM land_records) land_records`)).rows[0];
  console.log('seeded', counts);
}

seed().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
