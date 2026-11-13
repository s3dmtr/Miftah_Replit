// MIFTAH property agent, served from the database.
// 1) Understand: the shared Arabic/English parser (src/lib/agent.ts) always runs. If OPENAI_API_KEY is set,
//    OpenAI also extracts structured preferences from the message (understanding only, never listings).
// 2) Retrieve: candidate listings come from PostgreSQL (active ads on available properties, SQL-filtered).
// 3) Rank + explain: the shared scorer ranks candidates and explains every criterion from real fields.
import { COMMERCIAL, DISTRICTS } from '../../src/data/seed.ts';
import { parse as ruleParse, type Prefs } from '../../src/lib/agent.ts';
import { converse } from '../../src/lib/conversation.ts';
import type { PoiCat, PropertyType, State } from '../../src/types.ts';
import { q } from './db.js';
import { LISTING_COLS, toListing, toProperty } from './mappers.js';

const TYPES: PropertyType[] = ['apartment', 'villa', 'floor', 'land', 'office', 'shop'];
const POIS: PoiCat[] = ['masjid', 'school_middle', 'school_high', 'university', 'hospital', 'pharmacy', 'gym', 'park', 'mall'];
const FEATURES = ['parking', 'elevator', 'maid_room', 'driver_room', 'pool', 'garden', 'ac', 'furnished', 'basement', 'roof', 'street_facing', 'corner'];

export function agentStatus() {
  const key = !!process.env.OPENAI_API_KEY;
  return {
    mode: key ? 'openai+database' : 'rule_based+database',
    dataSource: 'postgresql',
    model: key ? (process.env.OPENAI_MODEL || 'gpt-4o-mini') : null,
    missingConfig: key ? [] : ['OPENAI_API_KEY'],
    note: key
      ? 'OpenAI extracts preferences; listings, ranking and explanations come only from the database.'
      : 'OPENAI_API_KEY is not set: using the built-in Arabic/English rule-based parser. Listings still come from the database.',
  };
}

/** Ask OpenAI for structured preferences. Returns null on any failure so the rule parser result is used. */
async function llmPrefs(message: string, prev: Prefs): Promise<{ prefs: Partial<Prefs>; error?: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const sys = `You extract real-estate search preferences for Riyadh, Saudi Arabia from Arabic or English messages.
Return ONLY a JSON object with any of these keys (omit unknown ones):
deal: "sale"|"rent"; types: array of ${JSON.stringify(TYPES)}; category: "residential"|"commercial";
budgetMax, budgetMin: numbers in SAR (rent is per year; "مليون ونص" = 1500000, "٧٠ ألف" = 70000);
districts: array of ids from ${JSON.stringify(DISTRICTS.map((d) => ({ id: d.id, ar: d.name.ar, en: d.name.en })))} ("north Riyadh/شمال الرياض" = malqa,yasmin,narjis,arid,sahafa,aqiq,nada,qurtubah,hittin);
roomsMin, areaMin: numbers; amenities: array of ${JSON.stringify(POIS)}; features: array of ${JSON.stringify(FEATURES)}.
Previous preferences (keep unless the user changes them): ${JSON.stringify(prev)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: message }] }),
    });
    if (!r.ok) return { prefs: {}, error: `OpenAI HTTP ${r.status}` };
    const j = await r.json();
    const raw = JSON.parse(j.choices?.[0]?.message?.content ?? '{}');
    // Keep only valid values: the model can never inject listings or unknown fields.
    const out: Partial<Prefs> = {};
    if (raw.deal === 'sale' || raw.deal === 'rent') out.deal = raw.deal;
    if (Array.isArray(raw.types)) { const t = raw.types.filter((x: string) => TYPES.includes(x as PropertyType)); if (t.length) out.types = t; }
    if (raw.category === 'residential' || raw.category === 'commercial') out.category = raw.category;
    for (const k of ['budgetMax', 'budgetMin', 'roomsMin', 'areaMin'] as const) if (typeof raw[k] === 'number' && raw[k] > 0) out[k] = raw[k];
    if (Array.isArray(raw.districts)) { const d = raw.districts.filter((x: string) => DISTRICTS.some((y) => y.id === x)); if (d.length) out.districts = d; }
    if (Array.isArray(raw.amenities)) { const a = raw.amenities.filter((x: string) => POIS.includes(x as PoiCat)); if (a.length) out.amenities = a; }
    if (Array.isArray(raw.features)) { const f = raw.features.filter((x: string) => FEATURES.includes(x)); if (f.length) out.features = f; }
    return { prefs: out };
  } catch (e) {
    return { prefs: {}, error: `OpenAI unavailable: ${(e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Load candidate listings from PostgreSQL in the State shape the shared ranker expects. */
async function candidates(p: Prefs) {
  const where = [`l.status = 'active'`, `p.availability = 'available'`];
  const args: unknown[] = [];
  const add = (sql: string, v: unknown) => { args.push(v); where.push(sql.replace('?', `$${args.length}`)); };
  if (p.deal) add('l.deal = ?', p.deal);
  const types = p.types ?? (p.category === 'commercial' ? COMMERCIAL : p.category === 'residential' ? TYPES.filter((t) => !COMMERCIAL.includes(t)) : undefined);
  if (types) add('p.type = ANY(?)', types);
  const rows = await q(`SELECT ${LISTING_COLS}, row_to_json(p) AS prop FROM listings l JOIN properties p ON p.id = l.property_id WHERE ${where.join(' AND ')}`, args);
  const props = new Map<string, ReturnType<typeof toProperty>>();
  for (const r of rows) props.set(r.property_id, toProperty(r.prop));
  // Budget is applied by the ranker (with a 10% tolerance) so every offer of a property is still counted.
  return { listings: rows.map(toListing), properties: [...props.values()] };
}

export async function chat(message: string, prev: Prefs) {
  const status = agentStatus();
  const rule = ruleParse(message, prev);
  let hint: Partial<Prefs> | undefined;
  let llmError: string | undefined;
  let usedLlm = false;
  if (!rule.reset) {
    const llm = await llmPrefs(message, prev);
    if (llm?.error) llmError = llm.error;
    if (llm && !llm.error) { hint = llm.prefs; usedLlm = true; }
  }
  const c = await candidates({});
  const state = { listings: c.listings, properties: c.properties } as unknown as State;
  // converse() runs the consultant dialogue (questions, follow-ups, recommendation) over the DB candidates.
  const reply = converse(state, message, rule.reset ? {} : prev, hint);
  return {
    reply,
    meta: {
      mode: usedLlm ? 'openai+database' : 'rule_based+database',
      dataSource: 'postgresql',
      candidatesFromDb: c.listings.length,
      missingConfig: status.missingConfig,
      ...(llmError ? { llmError, fallback: 'rule_based' } : {}),
    },
  };
}
