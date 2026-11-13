import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { COMMERCIAL, DISTRICTS } from '../../src/data/seed.ts';
import { nearest, POI_ORDER } from '../../src/lib/geo.ts';
import { moderate } from '../../src/lib/moderation.ts';
import type { State } from '../../src/types.ts';
import { one, pool, q, tx } from './db.js';
import { ADVERTISER_ROLES, HttpError, STAFF_ROLES, authenticate, errorHandler, h, parse, requireAuth, requireRole, sign, type AuthUser } from './http.js';
import { LISTING_COLS, iso, toAdvertiser, toListing, toProperty } from './mappers.js';
import { agentStatus, chat } from './agent.js';
import { LIVE, adminLog, createListing, findDuplicate, notify, ownedListing, requestStatus, reviewStatus } from './services.js';

export const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()).concat('null') }));
app.use(express.json({ limit: '1mb' }));
app.use(authenticate);

const R = express.Router();
app.use('/api', R);

const isStaff = (u?: AuthUser) => !!u && STAFF_ROLES.includes(u.role);
const publicUser = (u: any) => ({ id: u.id, email: u.email, role: u.role, advertiserId: u.advertiserId ?? u.advertiser_id ?? null, name: { ar: u.nameAr ?? u.name_ar, en: u.nameEn ?? u.name_en } });
const districtIds = DISTRICTS.map((d) => d.id) as [string, ...string[]];
const PROPERTY_TYPES = ['apartment', 'villa', 'floor', 'land', 'office', 'shop'] as const;

// ---------- health ----------
R.get('/health', h(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({
    ok: true, db: 'up',
    integrations: {
      openai: process.env.OPENAI_API_KEY ? 'configured (not used yet)' : 'simulated',
      googleMaps: process.env.GOOGLE_MAPS_API_KEY ? 'configured (not used yet)' : 'simulated',
      riyadhSpatialPortal: 'simulated', regaLicensing: 'simulated', payments: 'disabled',
    },
  });
}));

// ---------- auth ----------
const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  phone: z.string().regex(/^05\d{8}$/, 'Saudi mobile format 05XXXXXXXX').optional(),
  role: z.enum(['seeker', 'owner', 'company', 'marketer']),
  license: z.string().trim().min(3).max(60).optional(),
  crNumber: z.string().regex(/^\d{10}$/, 'Commercial registration is 10 digits').optional(),
}).superRefine((v, ctx) => {
  if ((v.role === 'company' || v.role === 'marketer') && !v.license) ctx.addIssue({ code: 'custom', path: ['license'], message: 'FAL licence is required for companies and marketers' });
  if (v.role === 'company' && !v.crNumber) ctx.addIssue({ code: 'custom', path: ['crNumber'], message: 'Commercial registration is required for companies' });
});

R.post('/auth/register', h(async (req, res) => {
  const b = parse(registerSchema, req.body);
  if (await one('SELECT 1 FROM users WHERE email = $1', [b.email])) throw new HttpError(409, 'email_taken', 'An account with this email already exists');
  const hash = await bcrypt.hash(b.password, 10);
  const user = await tx(async (c) => {
    let advertiserId: string | null = null;
    if (b.role !== 'seeker') {
      // Owners are verified instantly (demo assumption); licensed roles wait for admin review (simulated REGA/Wathq check).
      const a = await one(`INSERT INTO advertisers (type, name_ar, name_en, license, cr_number, verified) VALUES ($1,$2,$2,$3,$4,$5) RETURNING id`,
        [b.role, b.name, b.license?.toUpperCase() ?? null, b.crNumber ?? null, b.role === 'owner' ? 'verified' : 'pending'], c);
      advertiserId = a.id;
    }
    return one(`INSERT INTO users (email, password_hash, phone, name_ar, name_en, role, advertiser_id) VALUES ($1,$2,$3,$4,$4,$5,$6) RETURNING *`,
      [b.email, hash, b.phone ?? null, b.name, b.role, advertiserId], c);
  });
  res.status(201).json({ token: sign(user.id), user: publicUser(user) });
}));

R.post('/auth/login', h(async (req, res) => {
  const b = parse(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }), req.body);
  const u = await one('SELECT * FROM users WHERE email = $1', [b.email]);
  if (!u || !(await bcrypt.compare(b.password, u.password_hash))) throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect');
  res.json({ token: sign(u.id), user: publicUser(u) });
}));

// Demo only: lets the prototype's role switcher sign in as a seeded account. Disable with ALLOW_DEMO_LOGIN=false.
R.post('/auth/demo-login', h(async (req, res) => {
  if (process.env.ALLOW_DEMO_LOGIN !== 'true') throw new HttpError(403, 'disabled', 'Demo login is disabled');
  const b = parse(z.object({ userId: z.string().min(1) }), req.body);
  const u = await one(`SELECT * FROM users WHERE id = $1 AND email LIKE '%@miftah.demo'`, [b.userId]);
  if (!u) throw new HttpError(404, 'not_found', 'Demo user not found');
  res.json({ token: sign(u.id), user: publicUser(u) });
}));

R.get('/auth/me', requireAuth, h(async (req, res) => {
  const adv = req.user!.advertiserId ? toAdvertiser(await one('SELECT * FROM advertisers WHERE id = $1', [req.user!.advertiserId])) : null;
  res.json({ user: publicUser(req.user), advertiser: adv });
}));

// ---------- search & property details ----------
const searchSchema = z.object({
  deal: z.enum(['sale', 'rent']).optional(),
  category: z.enum(['residential', 'commercial']).optional(),
  type: z.enum(PROPERTY_TYPES).optional(),
  district: z.enum(districtIds).optional(),
  city: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minArea: z.coerce.number().nonnegative().optional(),
  minRooms: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(['new', 'price_asc', 'price_desc', 'offers']).default('new'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

R.get('/properties', h(async (req, res) => {
  const f = parse(searchSchema, req.query);
  if (f.city && !/riyadh|الرياض/i.test(f.city)) return res.json({ total: 0, page: f.page, results: [], note: 'MIFTAH covers Riyadh only' });
  const where = [`l.status = 'active'`, `p.availability = 'available'`];
  const args: unknown[] = [];
  const add = (sql: string, v: unknown) => { args.push(v); where.push(sql.replace('?', `$${args.length}`)); };
  if (f.deal) add('l.deal = ?', f.deal);
  if (f.type) add('p.type = ?', f.type);
  if (f.category) add(f.category === 'commercial' ? 'p.type = ANY(?)' : 'NOT (p.type = ANY(?))', COMMERCIAL);
  if (f.district) add('p.district_id = ?', f.district);
  if (f.minArea) add('p.area >= ?', f.minArea);
  if (f.minRooms) add('p.rooms >= ?', f.minRooms);
  const rows = await q(`SELECT ${LISTING_COLS}, row_to_json(p) AS prop FROM listings l JOIN properties p ON p.id = l.property_id WHERE ${where.join(' AND ')} ORDER BY l.price`, args);

  // Group ads by underlying property (cheapest first), then apply price filters to the best offer.
  const groups = new Map<string, { property: ReturnType<typeof toProperty>; listings: ReturnType<typeof toListing>[] }>();
  for (const r of rows) {
    const g = groups.get(r.property_id) ?? { property: toProperty(r.prop), listings: [] };
    g.listings.push(toListing(r));
    groups.set(r.property_id, g);
  }
  let out = [...groups.values()].map((g) => ({ ...g, best: g.listings[0], offers: g.listings.length }))
    .filter((g) => (!f.minPrice || g.best.price >= f.minPrice) && (!f.maxPrice || g.best.price <= f.maxPrice));
  const sorters = {
    new: (a: typeof out[0], b: typeof out[0]) => b.best.createdAt.localeCompare(a.best.createdAt),
    price_asc: (a: typeof out[0], b: typeof out[0]) => a.best.price - b.best.price,
    price_desc: (a: typeof out[0], b: typeof out[0]) => b.best.price - a.best.price,
    offers: (a: typeof out[0], b: typeof out[0]) => b.offers - a.offers,
  };
  out = out.sort(sorters[f.sort]);
  res.json({ total: out.length, page: f.page, pageSize: f.pageSize, results: out.slice((f.page - 1) * f.pageSize, f.page * f.pageSize) });
}));

R.get('/properties/:id', h(async (req, res) => {
  const p = await one('SELECT * FROM properties WHERE id = $1', [req.params.id]);
  if (!p) throw new HttpError(404, 'not_found', 'Property not found');
  const ls = (await q(`SELECT ${LISTING_COLS} FROM listings l WHERE l.property_id = $1 ORDER BY l.price`, [p.id])).map(toListing);
  const visible = p.availability === 'available' ? ls.filter((l) => l.status === 'active') : ls;
  const advIds = [...new Set(visible.map((l) => l.advertiserId))];
  const advertisers = (await q('SELECT * FROM advertisers WHERE id = ANY($1)', [advIds])).map(toAdvertiser);
  const lowest = visible.length ? Math.min(...visible.map((l) => l.price)) : 0;
  const nearby = POI_ORDER.map((cat) => { const n = nearest(p.lat, p.lng, cat); return n && { category: cat, name: n.poi.name, km: +n.km.toFixed(2) }; }).filter(Boolean);
  res.json({
    property: toProperty(p),
    offers: visible.map((l) => ({ ...l, pricePerM2: Math.round(l.price / p.area), diffFromLowest: l.price - lowest, advertiser: advertisers.find((a) => a.id === l.advertiserId) })),
    nearby, nearbySource: 'simulated',
  });
}));

R.post('/listings/:id/view', h(async (req, res) => {
  const r = await one(`UPDATE listings SET views = views + 1 WHERE id = $1 RETURNING views`, [req.params.id]);
  if (!r) throw new HttpError(404, 'not_found', 'Listing not found');
  res.json(r);
}));

// ---------- land codes (simulated Riyadh spatial portal) ----------
R.get('/land-codes/:code', h(async (req, res) => {
  const rec = await one('SELECT * FROM land_records WHERE upper(code) = upper($1)', [req.params.code]);
  if (!rec) throw new HttpError(404, 'land_not_found', 'Land code not found in the simulated spatial portal');
  const prop = await one('SELECT * FROM properties WHERE land_code = $1', [rec.code]);
  const liveAds = prop ? (await one('SELECT count(*)::int AS n FROM listings WHERE property_id = $1 AND status = ANY($2)', [prop.id, LIVE]))!.n : 0;
  const dup = req.user?.advertiserId ? await findDuplicate(req.user.advertiserId, rec.code) : undefined;
  res.json({ record: { code: rec.code, districtId: rec.district_id, area: rec.area, lat: rec.lat, lng: rec.lng, source: rec.source }, property: prop ? toProperty(prop) : null, liveAds, yourExistingListingId: dup?.id ?? null });
}));

// ---------- listings (advertisers) ----------
const createSchema = z.object({
  landCode: z.string().trim().max(40).optional().default(''),
  type: z.enum(PROPERTY_TYPES),
  deal: z.enum(['sale', 'rent']),
  price: z.coerce.number().positive().max(1e10),
  districtId: z.enum(districtIds).optional(),
  area: z.coerce.number().positive().max(1e7).optional(),
  rooms: z.coerce.number().int().min(0).max(50).optional(),
  baths: z.coerce.number().int().min(0).max(50).optional(),
  features: z.array(z.string().max(40)).max(30).optional(),
  descAr: z.string().max(4000).optional(),
  descEn: z.string().max(4000).optional(),
  images: z.array(z.string().url().max(2000)).max(20).optional(),
});

R.post('/listings', requireRole(...ADVERTISER_ROLES), h(async (req, res) => {
  const b = parse(createSchema, req.body);
  res.status(201).json(await createListing(req.user!.advertiserId!, b));
}));

R.get('/listings/:id', h(async (req, res) => {
  const r = await one(`SELECT ${LISTING_COLS} FROM listings l WHERE l.id = $1`, [req.params.id]);
  if (!r) throw new HttpError(404, 'not_found', 'Listing not found');
  res.json(toListing(r));
}));

const patchSchema = z.object({
  price: z.coerce.number().positive().max(1e10).optional(),
  descAr: z.string().max(4000).optional(),
  descEn: z.string().max(4000).optional(),
  status: z.enum(['active', 'paused']).optional(),
  featured: z.boolean().optional(),
}).strict();

R.patch('/listings/:id', requireAuth, h(async (req, res) => {
  const b = parse(patchSchema, req.body);
  const l = await ownedListing(req.user!, req.params.id);
  if (l.status === 'closed') throw new HttpError(409, 'listing_closed', 'Closed listings cannot be edited');
  if (b.status && l.status === 'under_review') throw new HttpError(409, 'under_review', 'Listing is waiting for status verification');
  if (b.status === 'active') {
    const p = await one('SELECT availability FROM properties WHERE id = $1', [l.property_id]);
    if (p.availability !== 'available') throw new HttpError(409, 'property_closed', 'Property is no longer available');
  }
  if (b.featured !== undefined && !isStaff(req.user)) throw new HttpError(403, 'forbidden', 'Only staff can feature ads');
  const r = await one(`UPDATE listings SET price = COALESCE($2, price), desc_ar = COALESCE($3, desc_ar), desc_en = COALESCE($4, desc_en),
    status = COALESCE($5, status), featured = COALESCE($6, featured) WHERE id = $1 RETURNING id`, [l.id, b.price ?? null, b.descAr ?? null, b.descEn ?? null, b.status ?? null, b.featured ?? null]);
  if (isStaff(req.user) && b.status) await adminLog(pool, req.user!.id, `${b.status === 'paused' ? 'Paused' : 'Restored'} ad ${r.id}`);
  res.json(toListing(await one(`SELECT ${LISTING_COLS} FROM listings l WHERE l.id = $1`, [r.id])));
}));

// Soft delete: the ad is closed (history kept), never hard-deleted.
R.delete('/listings/:id', requireAuth, h(async (req, res) => {
  const l = await ownedListing(req.user!, req.params.id);
  if (l.status === 'under_review') throw new HttpError(409, 'under_review', 'Listing is waiting for status verification');
  await pool.query(`UPDATE listings SET status = 'closed', closed_reason = NULL, featured = false WHERE id = $1`, [l.id]);
  res.status(204).end();
}));

R.post('/listings/:id/images', requireAuth, h(async (req, res) => {
  const b = parse(z.object({ urls: z.array(z.string().url().max(2000)).min(1).max(20) }), req.body);
  const l = await ownedListing(req.user!, req.params.id);
  const base = (await one('SELECT COALESCE(max(sort), -1)::int AS m FROM listing_images WHERE listing_id = $1', [l.id]))!.m + 1;
  for (const [i, url] of b.urls.entries()) await pool.query('INSERT INTO listing_images (listing_id, url, sort) VALUES ($1,$2,$3)', [l.id, url, base + i]);
  res.status(201).json({ images: (await q('SELECT url FROM listing_images WHERE listing_id = $1 ORDER BY sort', [l.id])).map((x) => x.url) });
}));

R.post('/listings/:id/status-requests', requireRole(...ADVERTISER_ROLES), h(async (req, res) => {
  const b = parse(z.object({ value: z.coerce.number().positive().max(1e10).optional() }), req.body ?? {});
  res.status(201).json(await requestStatus(req.user!, req.params.id, b.value));
}));

R.post('/listings/:id/reports', requireAuth, h(async (req, res) => {
  const b = parse(z.object({ reason: z.string().trim().min(3).max(500) }), req.body);
  if (!(await one('SELECT 1 FROM listings WHERE id = $1', [req.params.id]))) throw new HttpError(404, 'not_found', 'Listing not found');
  res.status(201).json(await one('INSERT INTO reports (listing_id, by_user, reason) VALUES ($1,$2,$3) RETURNING *', [req.params.id, req.user!.id, b.reason]));
}));

// ---------- advertiser dashboard ----------
R.get('/dashboard', requireRole(...ADVERTISER_ROLES), h(async (req, res) => {
  const a = req.user!.advertiserId!;
  const listings = (await q(`SELECT ${LISTING_COLS},
      (SELECT count(*)::int FROM listings o WHERE o.property_id = l.property_id AND o.id <> l.id AND o.status = 'active') AS competing,
      (SELECT min(price) FROM listings o WHERE o.property_id = l.property_id AND o.id <> l.id AND o.status = 'active') AS lowest_other,
      (SELECT land_code FROM properties p WHERE p.id = l.property_id) AS land_code
    FROM listings l WHERE l.advertiser_id = $1 ORDER BY l.created_at DESC`, [a]))
    .map((r) => ({ ...toListing(r), landCode: r.land_code, competingOffers: r.competing, lowestOtherPrice: r.lowest_other }));
  const inquiries = (await one('SELECT count(*)::int AS n FROM conversations WHERE advertiser_id = $1', [a]))!.n;
  const live = listings.filter((l) => LIVE.includes(l.status));
  res.json({
    advertiser: toAdvertiser(await one('SELECT * FROM advertisers WHERE id = $1', [a])),
    stats: { liveAds: live.length, totalViews: listings.reduce((s, l) => s + l.views, 0), inquiries, adsWithCompetition: live.filter((l) => l.competingOffers > 0).length },
    listings,
    pendingStatusRequests: await q(`SELECT * FROM status_requests WHERE advertiser_id = $1 AND state = 'pending'`, [a]),
  });
}));

// ---------- inquiries / messaging ----------
R.post('/listings/:id/inquiries', requireAuth, h(async (req, res) => {
  const b = parse(z.object({ message: z.string().trim().min(1).max(2000).optional() }), req.body ?? {});
  if (isStaff(req.user)) throw new HttpError(403, 'forbidden', 'Staff accounts cannot open inquiries');
  const l = await one(`SELECT l.*, p.availability FROM listings l JOIN properties p ON p.id = l.property_id WHERE l.id = $1`, [req.params.id]);
  if (!l) throw new HttpError(404, 'not_found', 'Listing not found');
  if (l.advertiser_id === req.user!.advertiserId) throw new HttpError(400, 'own_listing', 'You cannot send an inquiry to your own ad');
  if (l.status !== 'active' || l.availability !== 'available') throw new HttpError(409, 'not_available', 'This ad is not accepting inquiries');
  const conv = await tx(async (c) => {
    await c.query(`INSERT INTO conversations (listing_id, seeker_id, advertiser_id) VALUES ($1,$2,$3) ON CONFLICT (listing_id, seeker_id) DO NOTHING`, [l.id, req.user!.id, l.advertiser_id]);
    const cv = await one('SELECT * FROM conversations WHERE listing_id = $1 AND seeker_id = $2', [l.id, req.user!.id], c);
    if (b.message) {
      await c.query('INSERT INTO messages (conversation_id, sender_id, body, flagged) VALUES ($1,$2,$3,$4)', [cv.id, req.user!.id, b.message, moderate(b.message).some((x) => x.bad)]);
      await notify(c, l.advertiser_id, 'استفسار جديد على إعلانك.', 'New inquiry on your ad.');
    }
    return cv;
  });
  res.status(201).json(await conversationOut(conv.id));
}));

async function conversationFor(user: AuthUser, id: string) {
  const c = await one('SELECT * FROM conversations WHERE id = $1', [id]);
  if (!c || (c.seeker_id !== user.id && c.advertiser_id !== user.advertiserId)) throw new HttpError(404, 'not_found', 'Conversation not found');
  return c;
}
async function conversationOut(id: string) {
  const c = await one('SELECT * FROM conversations WHERE id = $1', [id]);
  const msgs = await q('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at', [id]);
  return {
    id: c.id, listingId: c.listing_id, seekerId: c.seeker_id, advertiserId: c.advertiser_id,
    // Bad words are flagged per token so the client can blur them (Arabic + English filter).
    messages: msgs.map((m) => ({ id: m.id, from: m.sender_id, text: m.body, at: iso(m.created_at), flagged: m.flagged, parts: moderate(m.body) })),
  };
}

R.get('/conversations', requireAuth, h(async (req, res) => {
  const rows = await q('SELECT id FROM conversations WHERE seeker_id = $1 OR advertiser_id = $2 ORDER BY created_at DESC', [req.user!.id, req.user!.advertiserId]);
  res.json(await Promise.all(rows.map((r) => conversationOut(r.id))));
}));
R.get('/conversations/:id', requireAuth, h(async (req, res) => {
  await conversationFor(req.user!, req.params.id);
  res.json(await conversationOut(req.params.id));
}));
R.post('/conversations/:id/messages', requireAuth, h(async (req, res) => {
  const b = parse(z.object({ text: z.string().trim().min(1).max(2000) }), req.body);
  const c = await conversationFor(req.user!, req.params.id);
  const asAdvertiser = c.advertiser_id === req.user!.advertiserId && c.seeker_id !== req.user!.id;
  await pool.query('INSERT INTO messages (conversation_id, sender_id, body, flagged) VALUES ($1,$2,$3,$4)',
    [c.id, asAdvertiser ? c.advertiser_id : req.user!.id, b.text, moderate(b.text).some((x) => x.bad)]);
  await notify(pool, asAdvertiser ? c.seeker_id : c.advertiser_id, 'رسالة جديدة.', 'New message.');
  res.status(201).json(await conversationOut(c.id));
}));

// ---------- favorites & notifications ----------
R.get('/favorites', requireAuth, h(async (req, res) => {
  res.json((await q('SELECT property_id FROM favorites WHERE user_id = $1 ORDER BY created_at', [req.user!.id])).map((r) => r.property_id));
}));
R.put('/favorites/:propertyId', requireAuth, h(async (req, res) => {
  await pool.query('INSERT INTO favorites (user_id, property_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user!.id, req.params.propertyId]);
  res.status(204).end();
}));
R.delete('/favorites/:propertyId', requireAuth, h(async (req, res) => {
  await pool.query('DELETE FROM favorites WHERE user_id = $1 AND property_id = $2', [req.user!.id, req.params.propertyId]);
  res.status(204).end();
}));
R.get('/notifications', requireAuth, h(async (req, res) => {
  res.json(await q('SELECT * FROM notifications WHERE recipient = ANY($1) ORDER BY created_at DESC LIMIT 50', [[req.user!.id, req.user!.advertiserId].filter(Boolean)]));
}));
R.post('/notifications/read', requireAuth, h(async (req, res) => {
  await pool.query('UPDATE notifications SET read = true WHERE recipient = ANY($1)', [[req.user!.id, req.user!.advertiserId].filter(Boolean)]);
  res.status(204).end();
}));

// ---------- admin / supervisor ----------
const staff = requireRole('admin', 'supervisor');
const adminOnly = requireRole('admin');

R.get('/admin/status-requests', staff, h(async (req, res) => {
  const state = parse(z.enum(['pending', 'approved', 'rejected']).default('pending'), req.query.state);
  res.json(await q('SELECT * FROM status_requests WHERE state = $1 ORDER BY created_at DESC', [state]));
}));
R.post('/admin/status-requests/:id/approve', staff, h(async (req, res) => res.json(await reviewStatus(req.user!, req.params.id, true))));
R.post('/admin/status-requests/:id/reject', staff, h(async (req, res) => res.json(await reviewStatus(req.user!, req.params.id, false))));

R.get('/admin/advertisers', adminOnly, h(async (req, res) => {
  const v = parse(z.enum(['verified', 'pending', 'rejected']).optional(), req.query.verified);
  res.json((await q(`SELECT * FROM advertisers ${v ? 'WHERE verified = $1' : ''} ORDER BY joined DESC`, v ? [v] : [])).map(toAdvertiser));
}));
R.post('/admin/advertisers/:id/verify', adminOnly, h(async (req, res) => {
  const b = parse(z.object({ approve: z.boolean() }), req.body);
  const a = await one('UPDATE advertisers SET verified = $2 WHERE id = $1 RETURNING *', [req.params.id, b.approve ? 'verified' : 'rejected']);
  if (!a) throw new HttpError(404, 'not_found', 'Advertiser not found');
  await adminLog(pool, req.user!.id, `${b.approve ? 'Verified' : 'Rejected'} advertiser ${a.id}`);
  if (b.approve) await notify(pool, a.id, 'تم توثيق حسابك، يمكنك نشر الإعلانات الآن.', 'Your account is verified. You can publish ads now.');
  res.json(toAdvertiser(a));
}));
R.get('/admin/reports', staff, h(async (_req, res) => res.json(await q('SELECT * FROM reports WHERE open ORDER BY created_at DESC'))));
R.post('/admin/reports/:id/resolve', staff, h(async (req, res) => {
  const b = parse(z.object({ pauseListing: z.boolean().default(false) }), req.body ?? {});
  const r = await one('UPDATE reports SET open = false WHERE id = $1 RETURNING *', [req.params.id]);
  if (!r) throw new HttpError(404, 'not_found', 'Report not found');
  if (b.pauseListing) await pool.query(`UPDATE listings SET status = 'paused' WHERE id = $1 AND status = 'active'`, [r.listing_id]);
  await adminLog(pool, req.user!.id, b.pauseListing ? `Paused ad ${r.listing_id} after report` : `Dismissed report ${r.id}`);
  res.json(r);
}));
R.get('/admin/duplicates', staff, h(async (_req, res) => res.json(await q('SELECT * FROM duplicate_attempts ORDER BY created_at DESC'))));
R.get('/admin/transactions', adminOnly, h(async (_req, res) => res.json(await q('SELECT * FROM transactions ORDER BY created_at DESC'))));
R.get('/admin/users', adminOnly, h(async (_req, res) => res.json((await q('SELECT * FROM users ORDER BY created_at')).map(publicUser))));
R.get('/admin/log', staff, h(async (_req, res) => res.json(await q('SELECT * FROM admin_log ORDER BY created_at DESC LIMIT 200'))));

// ---------- AI property agent (database-backed; OpenAI optional) ----------
const prefsSchema = z.object({
  deal: z.enum(['sale', 'rent']).optional(),
  types: z.array(z.enum(PROPERTY_TYPES)).optional(),
  category: z.enum(['residential', 'commercial']).optional(),
  budgetMax: z.number().positive().optional(), budgetMin: z.number().positive().optional(),
  districts: z.array(z.enum(districtIds)).optional(),
  roomsMin: z.number().int().positive().optional(), areaMin: z.number().positive().optional(),
  amenities: z.array(z.enum(['masjid', 'school_middle', 'school_high', 'university', 'hospital', 'pharmacy', 'gym', 'park', 'mall'])).optional(),
  features: z.array(z.string().max(40)).optional(),
}).strip();

R.get('/agent/status', h(async (_req, res) => res.json(agentStatus())));
R.post('/agent/chat', h(async (req, res) => {
  const b = parse(z.object({ message: z.string().trim().min(1).max(1000), prefs: prefsSchema.default({}) }), req.body);
  res.json(await chat(b.message, b.prefs));
}));

// ---------- whole-app snapshot in the prototype's State shape (used by the React store) ----------
R.get('/state', h(async (req, res) => {
  const u = req.user;
  const keys = u ? [u.id, u.advertiserId].filter(Boolean) : [];
  const staffView = isStaff(u);
  const [users, advertisers, land, props, listings, favs, srs, hist, dups, txs, notes, reports, logs] = await Promise.all([
    q('SELECT id, name_ar, name_en, role, advertiser_id FROM users ORDER BY created_at, id'),
    q('SELECT * FROM advertisers'), q('SELECT * FROM land_records ORDER BY code'), q('SELECT * FROM properties'),
    q(`SELECT ${LISTING_COLS} FROM listings l ORDER BY l.created_at DESC`),
    u ? q('SELECT property_id FROM favorites WHERE user_id = $1', [u.id]) : Promise.resolve([]),
    staffView ? q('SELECT * FROM status_requests ORDER BY created_at DESC') : u?.advertiserId ? q('SELECT * FROM status_requests WHERE advertiser_id = $1', [u.advertiserId]) : Promise.resolve([]),
    q('SELECT * FROM status_history ORDER BY created_at DESC'),
    staffView ? q('SELECT * FROM duplicate_attempts ORDER BY created_at DESC') : u?.advertiserId ? q('SELECT * FROM duplicate_attempts WHERE advertiser_id = $1', [u.advertiserId]) : Promise.resolve([]),
    u?.role === 'admin' ? q('SELECT * FROM transactions ORDER BY created_at DESC') : Promise.resolve([]),
    keys.length ? q('SELECT * FROM notifications WHERE recipient = ANY($1) ORDER BY created_at DESC LIMIT 50', [keys]) : Promise.resolve([]),
    staffView ? q('SELECT * FROM reports ORDER BY created_at DESC') : Promise.resolve([]),
    staffView ? q('SELECT * FROM admin_log ORDER BY created_at DESC LIMIT 100') : Promise.resolve([]),
  ]);
  const convIds = u ? await q('SELECT id FROM conversations WHERE seeker_id = $1 OR advertiser_id = $2 ORDER BY created_at DESC', [u.id, u.advertiserId]) : [];
  const state: Omit<State, 'lang'> & { lang?: State['lang'] } = {
    version: 3,
    currentUserId: u?.id ?? 'u-seeker',
    users: users.map((x) => ({ id: x.id, name: { ar: x.name_ar, en: x.name_en }, role: x.role, ...(x.advertiser_id ? { advertiserId: x.advertiser_id } : {}) })),
    advertisers: advertisers.map(toAdvertiser),
    landRegistry: land.map((r) => ({ code: r.code, districtId: r.district_id, area: r.area, lat: r.lat, lng: r.lng })),
    properties: props.map(toProperty),
    listings: listings.map(toListing),
    conversations: (await Promise.all(convIds.map((c) => conversationOut(c.id)))).map(({ messages, ...c }) => ({ ...c, messages: messages.map(({ id, from, text, at }) => ({ id, from, text, at })) })),
    favorites: u ? { [u.id]: favs.map((f) => f.property_id) } : {},
    statusRequests: srs.map((r) => ({ id: r.id, propertyId: r.property_id, listingId: r.listing_id, advertiserId: r.advertiser_id, outcome: r.outcome, value: r.value, state: r.state, at: iso(r.created_at), ...(r.reviewed_by ? { reviewedBy: r.reviewed_by } : {}) })),
    history: hist.map((x) => ({ id: x.id, propertyId: x.property_id, from: x.from_status, to: x.to_status, by: x.by_user, at: iso(x.created_at), note: x.note })),
    duplicates: dups.map((d) => ({ id: d.id, advertiserId: d.advertiser_id, landCode: d.land_code, existingListingId: d.existing_listing_id, at: iso(d.created_at) })),
    transactions: txs.map((t) => ({ id: t.id, propertyId: t.property_id, listingId: t.listing_id, advertiserId: t.advertiser_id, value: t.value, commission: t.commission, rule: t.rule, at: iso(t.created_at) })),
    notices: notes.map((n) => ({ id: n.id, to: n.recipient, text: { ar: n.text_ar, en: n.text_en }, at: iso(n.created_at), read: n.read })),
    reports: reports.map((r) => ({ id: r.id, listingId: r.listing_id, by: r.by_user, reason: r.reason, at: iso(r.created_at), open: r.open })),
    adminLog: logs.map((a) => ({ id: a.id, by: a.by_user, action: a.action, at: iso(a.created_at) })),
  };
  res.json(state);
}));

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found', 'Route not found')));
app.use(errorHandler);
