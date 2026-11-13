# MIFTAH (مفتاح) — AI-powered real estate marketplace

**عقارك يبدأ بمفتاح · Your property starts with Miftah**

Riyadh real estate marketplace: owners, licensed offices and marketers advertise; seekers search in Arabic or English
with an AI agent; ads for the same land code are grouped so seekers can compare offers; one live ad per account per
land code; a verified sale/rental closes every ad for that property.

| Part | Stack | Folder |
|---|---|---|
| Mobile app (Arabic RTL default, iPhone/iPad layouts) | React 18, TypeScript, Tailwind, Vite | `src/mobile/` |
| Shared logic (rules, AI agent, i18n, types) | TypeScript, used by app **and** API | `src/lib/`, `src/types.ts`, `src/data/` |
| API | Node, Express, TypeScript, zod, JWT, bcrypt | `server/` |
| Database | PostgreSQL (SQL migrations, `pg`) | `server/migrations/` |

Earlier desktop web pages are kept in `src/pages/` for reference (not used by the current entry point).

## Quick start

```bash
# 1. Database (any PostgreSQL 13+; or: docker compose up -d db)
cd server
cp .env.example .env          # set DATABASE_URL and a long random JWT_SECRET
npm install
npm run migrate               # creates the schema
npm run seed                  # demo catalogue  (OR restore the real data, see below)
npm start                     # API on http://localhost:4000/api

# 2. App against the API
cd ..
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:5173
```

Without `VITE_API_URL` the app runs fully in the browser on the bundled data snapshot (that is how the Claude Artifact
build works: `npm run build` → `dist/index.html` and `dist/miftah-app.html`).

Demo logins (password = `SEED_PASSWORD`, default `miftah123`): `seeker@`, `owner@`, `company@`, `marketer@`, `admin@`,
`supervisor@miftah.demo`, plus other advertisers as `<advertiserId>@miftah.demo`. Change these before any public use.

## Data and recovery

- **Schema:** `server/migrations/001_init.sql` (properties vs listings, partial unique index for duplicates, trigger
  that copies the land code, status history, etc.). Applied by `npm run migrate` / on server start.
- **Demo catalogue:** `npm run seed` (fictional data generated from `src/data/seed.ts`). Wipes the target DB.
- **Real data snapshot:** `src/data/snapshot.json` is a sanitized export of the live database
  (29 properties, 44 listings, 12 users, conversations, status history). It contains **no emails and no password hashes**.
  - Refresh it from a running DB: `cd server && npx tsx scripts/export-snapshot.ts` (read-only).
  - Restore it into an empty DB: `cd server && DATABASE_URL=... npx tsx scripts/restore-snapshot.ts`
    (refuses a non-empty DB unless `--force`; demo logins get `SEED_PASSWORD`).
- **Raw dumps** (`pg_dump`) are deliberately git-ignored because they contain password hashes and emails.
  Keep them in private storage.

## Tests

- API: `cd server && npm run seed && npm start` then `npm run test:api` (70 checks, needs a freshly seeded DB).
- Mobile UI: `npm run build && node tests/e2e/mobile-app.cjs` (20 checks, Playwright).
- Full stack through the UI with DB verification: see `tests/e2e/README.md`.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | server | Auth tokens (secret must be long and random) |
| `PORT`, `CORS_ORIGIN` | server | HTTP port, allowed browser origins |
| `SEED_PASSWORD` | server | Password for seeded/restored demo accounts |
| `ALLOW_DEMO_LOGIN` | server | Lets the demo role switcher sign in without a password; set `false` in production |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | server | Optional: OpenAI extracts search preferences; results still come only from the DB. Without a key the built-in Arabic/English parser is used. |
| `VITE_API_URL` | app | API base URL; empty = offline mode |

Never commit `.env` files; only the `*.env.example` templates are tracked.

## Simulated / not yet integrated

Riyadh Municipality land-code portal, REGA/FAL and Wathq licence checks, Google Maps and nearby places (demo points),
payments and binding transactions (none), photo uploads (images are URLs; the app draws generated illustrations).
Company commission assumes 20% of a 2.5% brokerage fee until the business rule is confirmed.

See `server/README.md` for the full API reference and business rules.
