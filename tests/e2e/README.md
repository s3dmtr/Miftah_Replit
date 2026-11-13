# End-to-end tests (Playwright, real browser)

Playwright is not a project dependency; install it once (`npm i -g playwright && npx playwright install chromium`)
or run where it is preinstalled. Build the app first with `npm run build` for the offline tests.

| Script | Needs | What it checks |
|---|---|---|
| `mobile-app.cjs` | `npm run build` (opens `dist/index.html`, or `APP_URL`) | 20 checks on an emulated iPhone: splash, every tab, Arabic AI conversation, filters, property details, offer comparison, chat, saved comparison, advertiser dashboard, add listing + duplicate block, supervisor approval, English LTR |
| `conversation-payment.cjs` | `npm run build` | 22 checks: consultant-style AI conversation (greeting, one question at a time, "no preference", family size, recommendation, follow-ups), booking deposit payment (details, mada test card, wrong/right OTP, receipt with masked card), contextual advertiser chat (price, counter-offer, viewing slot, confirmation), payments list |
| `fullstack-journey.cjs` | API on :4000 + `VITE_API_URL=http://localhost:4000 npm run dev` on :5173, and `psql` access to the DB | 43 checks through the UI with every step verified in PostgreSQL. Written for the earlier desktop UI (`src/pages`); kept for reference. |

API tests: `server/scripts/smoke.sh` (76 checks; run against a freshly seeded **scratch** database, e.g.
`SMOKE_DB=miftah_smoke API=http://localhost:4100/api bash scripts/smoke.sh`). The tests add records; never point them at real data.
