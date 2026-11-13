# MIFTAH API (Express + TypeScript + PostgreSQL)

## Run
```bash
cp .env.example .env        # adjust DATABASE_URL / JWT_SECRET
npm install
npm run setup               # apply migrations + seed demo data
npm start                   # http://localhost:4000/api
npm run test:api            # 70 end-to-end checks (run on a freshly seeded DB)
```
Need a database? `docker compose up -d db` from the project root, or any PostgreSQL 13+ (uses `gen_random_uuid()`).

Demo accounts (password `miftah123`): seeker@, owner@, company@, marketer@, admin@, supervisor@miftah.demo,
plus every other advertiser as `<id>@miftah.demo` (c2, c3, m2, o2, m3, c4).

## Endpoints (all under /api)
| Area | Method & path | Who |
|---|---|---|
| Health | GET /health | public |
| Auth | POST /auth/register, POST /auth/login, GET /auth/me, POST /auth/demo-login | public / signed in |
| Search | GET /properties?deal&category&type&district&minPrice&maxPrice&minArea&minRooms&sort&page&pageSize | public |
| Details | GET /properties/:id (grouped offers, price per m², diff from lowest, nearby places) | public |
| Land code | GET /land-codes/:code (simulated portal; flags your own live ad) | public |
| Listings | POST /listings, GET/PATCH/DELETE /listings/:id, POST /listings/:id/images, POST /listings/:id/view | advertiser (own ads) / staff |
| Status | POST /listings/:id/status-requests | advertiser |
| Dashboard | GET /dashboard | advertiser |
| Inquiries | POST /listings/:id/inquiries, GET /conversations, GET /conversations/:id, POST /conversations/:id/messages | signed in |
| Favorites | GET /favorites, PUT/DELETE /favorites/:propertyId | signed in |
| Notifications | GET /notifications, POST /notifications/read | signed in |
| Reports | POST /listings/:id/reports | signed in |
| Admin | GET /admin/status-requests, POST /admin/status-requests/:id/approve or /reject, GET /admin/reports, POST /admin/reports/:id/resolve, GET /admin/duplicates, GET /admin/log | admin, supervisor |
| Admin | GET /admin/advertisers, POST /admin/advertisers/:id/verify, GET /admin/transactions, GET /admin/users | admin |
| AI agent | GET /agent/status, POST /agent/chat `{ message, prefs }` → `{ reply, meta }` | public |
| Frontend sync | GET /state (snapshot in the React app's `State` shape, scoped to the caller) | public / signed in |

Errors are JSON: `{ "error": "<code>", "message": "...", ...extra }` (400 validation_error with `issues`, 401, 403, 404, 409 duplicate with `existingListingId`).

## AI property agent
`POST /api/agent/chat` takes the user's message plus the preferences from the previous turn and returns ranked
matches from PostgreSQL with a per-criterion explanation (budget, district, type, rooms, area, features, distance
to masjid/schools/hospital/pharmacy/gym).
1. **Understand:** the shared parser in `src/lib/agent.ts` handles Arabic (spelling variants, attached prefixes
   such as «بالنرجس»/«للايجار», spoken amounts like «مليون ونص» and «نص مليون») and English. If `OPENAI_API_KEY`
   is set, OpenAI also extracts preferences as strict JSON; anything outside the allowed values is dropped.
2. **Retrieve:** active ads on available properties are loaded from the database (filtered by deal and type).
3. **Rank and explain:** the shared scorer ranks them; explanations use only stored fields. Nothing is invented.

`meta.mode` says what actually ran (`openai+database` or `rule_based+database`), `meta.missingConfig` lists
`OPENAI_API_KEY` when it is unset, and `meta.llmError` + `fallback` appear if OpenAI fails (timeout 8 s).
Note: Node's `fetch` does not use an HTTP proxy, so behind a corporate proxy OpenAI calls fall back to rule-based.

## Key rules
- **Properties vs ads:** `properties` (one per parcel) and `listings` (one per advertiser ad) are separate tables.
- **Duplicates:** checked in the API before insert and guaranteed by the partial unique index
  `listings_one_live_ad_per_land_code (advertiser_id, land_code) WHERE status IN ('active','paused','under_review')`.
  A trigger copies the land code from the property so clients cannot fake it. Attempts are logged in `duplicate_attempts`.
- **Status sync:** an advertiser's sold/rented claim only pauses their own ad. Approval by a supervisor/admin, in one
  transaction, updates the property, closes every linked ad, writes history, records a demo commission and notifies
  advertisers and users who saved the property.
- Shared code: seed data, types, title builder, commission rule, geo and the Arabic/English profanity filter are imported
  from the frontend's `src/` so both sides behave the same.

## Assumptions
- Roles: seeker, owner, company (real estate office), marketer, admin, supervisor.
- Owners are verified at sign-up; companies/marketers wait for admin approval (REGA/Wathq checks simulated).
- Company commission = 20% of an assumed 2.5% brokerage fee; individuals = 1.25% of value. Recorded only, never charged.
- Images are stored as URLs (`listing_images`); without uploads the UI shows generated illustrations from `image_seed`.
- Rent prices are yearly.

## Data snapshot (export / restore)
- `npx tsx scripts/export-snapshot.ts` — read-only export of the live DB to `../src/data/snapshot.json` (no emails, no password hashes; skips records created by automated tests).
- `DATABASE_URL=... npx tsx scripts/restore-snapshot.ts [--force]` — rebuilds a database from that snapshot. Refuses a non-empty DB unless `--force`. Demo logins get `SEED_PASSWORD`.
- Raw `pg_dump` files are git-ignored (they contain password hashes and emails).
