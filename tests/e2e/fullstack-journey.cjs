const { chromium } = require('playwright');
const { execSync } = require('child_process');
const db = (sql) => execSync(`PGPASSWORD=miftah psql -h localhost -U miftah -d miftah -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const API = process.env.API_URL ?? 'http://localhost:4000/api', U = process.env.WEB_URL ?? 'http://localhost:5173/';
const results = []; let section = '';
const ok = (name, cond, extra = '') => { results.push({ section, name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  [${section}] ${name}${extra ? '  — ' + extra : ''}`); };
const EMAIL = { c1: 'company@miftah.demo', m1: 'marketer@miftah.demo', o1: 'owner@miftah.demo' };
const emailOf = (adv) => EMAIL[adv] ?? `${adv}@miftah.demo`;
const login = async (email, password = 'miftah123') => (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const pageErrors = [], calls = [];
  p.on('pageerror', e => pageErrors.push(e.message));
  p.on('response', r => { if (r.url().includes(':4000/api/')) calls.push(`${r.request().method()} ${r.url().split('/api')[1].split('?')[0]} ${r.status()}`); });
  const asUser = async (email) => { const { token } = await login(email); await p.evaluate(t => localStorage.setItem('miftah-token', t), token); await p.reload(); await p.waitForTimeout(1500); return token; };

  // ================= 1. Arabic property-seeker journey =================
  section = 'Seeker';
  await p.goto(U); await p.waitForTimeout(1500);
  ok('app opens, signs in and loads data from API', calls.includes('POST /auth/demo-login 200') && calls.includes('GET /state 200'));
  ok('UI is Arabic RTL', await p.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar'));
  await p.goto(U + '#agent'); await p.waitForTimeout(800);
  await p.fill('#agent-input', 'ابغى فله للبيع بالملقا بحدود ٤ مليون قريبة من مسجد'); await p.keyboard.press('Enter');
  await p.waitForSelector('text=وجدت', { timeout: 8000 });
  ok('agent request handled by backend', calls.some(c => c === 'POST /agent/chat 200'));
  const hrefs = await p.locator('main a[href^="#property-"]').evaluateAll(a => a.map(x => x.getAttribute('href').slice(10)));
  const inDb = hrefs.length && hrefs.every(id => db(`select count(*) from listings l join properties p on p.id=l.property_id where p.id='${id}' and l.status='active' and p.availability='available'`) !== '0');
  ok('agent results are active listings in PostgreSQL', inDb, `${hrefs.length} results: ${hrefs.join(',')}`);
  ok('top result is in requested district (الملقا)', db(`select district_id from properties where id='${hrefs[0]}'`) === 'malqa');

  await p.goto(U + '#search'); await p.waitForTimeout(800);
  await p.selectOption('#f-type', 'villa'); await p.locator('button:has-text("شراء")').first().click(); await p.fill('#f-max', '4000000'); await p.waitForTimeout(500);
  const uiCount = await p.locator('main a[href^="#property-"]').count();
  const apiCount = (await (await fetch(API + '/properties?type=villa&deal=sale&maxPrice=4000000')).json()).total;
  const dbCount = db(`select count(distinct p.id) from properties p join listings l on l.property_id=p.id where p.type='villa' and l.deal='sale' and l.status='active' and p.availability='available' and l.price = (select min(price) from listings x where x.property_id=p.id and x.status='active' and x.deal='sale') and l.price<=4000000`);
  ok('filters (villa, buy, ≤4M): UI = API = DB', uiCount > 0 && uiCount === apiCount && String(apiCount) === dbCount, `UI ${uiCount} / API ${apiCount} / DB ${dbCount}`);

  const pid = hrefs[0];
  await p.goto(U + '#property-' + pid); await p.waitForTimeout(1200);
  const rows = await p.locator('table tbody tr').count();
  ok('property details: offers table matches DB', String(rows) === db(`select count(*) from listings where property_id='${pid}' and status='active'`), `${rows} offers`);
  ok('property details: land code shown', await p.locator(`text=${db(`select land_code from properties where id='${pid}'`)}`).count() > 0);

  const msgsBefore = +db('select count(*) from messages');
  await p.locator('button:has-text("راسل المعلن")').first().click(); await p.waitForTimeout(1500);
  const convId = (await p.evaluate(() => location.hash)).replace('#chat-', '');
  const inquiry = 'السلام عليكم، هل يمكن معاينة الفيلا يوم السبت؟ ' + Date.now();
  await p.fill('#chat-input', inquiry); await p.locator('form button[type=submit]').click(); await p.waitForTimeout(1500);
  ok('inquiry submitted and stored in DB', db(`select count(*) from messages where conversation_id='${convId}' and body='${inquiry}'`) === '1');
  ok('inquiry visible in chat UI (message bubble)', await p.locator('div[dir=auto]', { hasText: inquiry }).count() === 1);
  const advId = db(`select advertiser_id from conversations where id='${convId}'`);
  await asUser(emailOf(advId));
  await p.goto(U + '#chat-' + convId); await p.waitForTimeout(1200);
  ok('advertiser receives the inquiry (message bubble)', await p.locator('div[dir=auto]', { hasText: inquiry }).count() === 1, `advertiser ${advId}`);
  const reply = 'وعليكم السلام، نعم متاحة الساعة ٥ مساءً ' + Date.now();
  await p.fill('#chat-input', reply); await p.locator('form button[type=submit]').click(); await p.waitForTimeout(1200);
  ok('advertiser reply stored in DB', db(`select count(*) from messages where conversation_id='${convId}' and sender_id='${advId}' and body='${reply}'`) === '1');

  // ================= 2. Advertiser journey =================
  section = 'Advertiser';
  const coToken = await asUser('company@miftah.demo');
  ok('login with email + password (JWT) opens company session', !!coToken && await p.locator('header a[href="#dashboard"]').count() === 1);
  const code = db(`select code from land_records r where not exists (select 1 from properties p where p.land_code=r.code) order by code limit 1`);
  const before = +db(`select count(*) from listings where advertiser_id='c1'`);
  await p.goto(U + '#dashboard'); await p.waitForTimeout(1000);
  await p.getByRole('button', { name: /إعلان جديد/ }).first().click(); await p.waitForTimeout(300);
  await p.fill('#land-code', code); await p.press('#land-code', 'Enter'); await p.waitForTimeout(400);
  ok('land code lookup shows parcel', await p.locator('text=تم العثور على القطعة').count() === 1, code);
  await p.selectOption('#n-type', 'villa'); await p.fill('#n-price', '2750000'); await p.fill('#n-rooms', '5'); await p.fill('#n-baths', '4');
  await p.locator('button:has-text("نشر الإعلان")').click(); await p.waitForTimeout(1500);
  const newL = db(`select l.id from listings l join properties p on p.id=l.property_id where p.land_code='${code}' and l.advertiser_id='c1' and l.status='active'`);
  ok('add property: listing + property persisted', !!newL && +db(`select count(*) from listings where advertiser_id='c1'`) === before + 1, newL);

  await p.locator('button:has-text("إعلاناتي")').first().click(); await p.waitForTimeout(800);
  await p.locator(`#price-${newL}`).count(); // not open yet
  const card = p.locator('div.rounded-card', { hasText: code }).first();
  await card.locator('button:has-text("تعديل السعر")').click(); await p.fill(`#price-${newL}`, '2690000'); await card.locator('button:has-text("حفظ")').click(); await p.waitForTimeout(1200);
  ok('edit listing: price updated in DB', db(`select price from listings where id='${newL}'`) === '2690000');
  ok('edit listing: UI shows new price', await card.innerText().then(t => t.includes('٢٬٦٩٠٬٠٠٠') || t.includes('2,690,000')));

  const dupBefore = +db('select count(*) from duplicate_attempts');
  await p.getByRole('button', { name: /إعلان جديد/ }).first().click(); await p.waitForTimeout(300);
  await p.fill('#land-code', code); await p.press('#land-code', 'Enter'); await p.waitForTimeout(400);
  ok('duplicate: blocked in UI before publishing', await p.locator('text=لديك إعلان حي لنفس رقم كود الأرض').count() === 1);
  await p.fill('#n-price', '2600000'); await p.locator('button:has-text("انشر على أي حال")').click(); await p.waitForTimeout(1200);
  ok('duplicate: backend rejects (409) and logs attempt', calls.includes('POST /listings 409') && +db('select count(*) from duplicate_attempts') === dupBefore + 1);
  ok('duplicate: still exactly one live ad for this account + land code', db(`select count(*) from listings l join properties p on p.id=l.property_id where p.land_code='${code}' and l.advertiser_id='c1' and l.status in ('active','paused','under_review')`) === '1');

  await asUser('owner@miftah.demo');
  await p.goto(U + '#dashboard'); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /إعلان جديد/ }).first().click(); await p.waitForTimeout(300);
  await p.fill('#land-code', code); await p.press('#land-code', 'Enter'); await p.waitForTimeout(400);
  await p.fill('#n-price', '2800000'); await p.locator('button:has-text("نشر الإعلان")').click(); await p.waitForTimeout(1500);
  const propId = db(`select id from properties where land_code='${code}'`);
  ok('different account can advertise same land code (grouped)', db(`select count(*) from listings where property_id='${propId}' and status='active'`) === '2');

  await asUser('company@miftah.demo');
  await p.goto(U + '#dashboard'); await p.waitForTimeout(1000);
  const card2 = p.locator('div.rounded-card', { hasText: code }).first();
  await card2.locator('button:has-text("تحديد كمُباع")').click(); await card2.locator('button:has-text("إرسال للتوثيق")').click(); await p.waitForTimeout(1200);
  ok('status claim: pending request created, only own ad paused', db(`select count(*) from status_requests where listing_id='${newL}' and state='pending'`) === '1'
    && db(`select status from listings where id='${newL}'`) === 'under_review' && db(`select count(*) from listings where property_id='${propId}' and advertiser_id='o1' and status='active'`) === '1');
  await asUser('supervisor@miftah.demo');
  await p.goto(U + '#admin'); await p.waitForTimeout(1000);
  await p.locator('div.rounded-card', { hasText: code }).locator('button:has-text("توثيق وإغلاق العقار")').click(); await p.waitForTimeout(1500);
  ok('sync: property marked sold in DB', db(`select availability from properties where id='${propId}'`) === 'sold');
  ok('sync: ALL ads for the property closed (both accounts)', db(`select count(*) from listings where property_id='${propId}' and status='closed' and closed_reason='sold'`) === '2');
  ok('sync: history + transaction + notifications written', db(`select count(*) from status_history where property_id='${propId}'`) === '1' && db(`select count(*) from transactions where property_id='${propId}'`) === '1' && +db(`select count(*) from notifications where recipient in ('c1','o1') and text_en like '%${code}%'`) >= 2);
  const s = await (await fetch(API + '/properties?deal=sale&type=villa')).json();
  ok('sync: sold property removed from search', !s.results.some(r => r.property.id === propId));
  await p.goto(U + '#property-' + propId); await p.waitForTimeout(1000);
  ok('sync: property page shows verified-sold banner', await p.locator('text=تم البيع، وثّقه مفتاح').count() === 1);

  // ================= 3. Authentication & permissions =================
  section = 'Auth';
  const st = async (path, token, method = 'GET', body) => (await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) })).status;
  const T = {}; for (const [k, e] of Object.entries({ seeker: 'seeker@miftah.demo', company: 'company@miftah.demo', super: 'supervisor@miftah.demo', admin: 'admin@miftah.demo', c2: 'c2@miftah.demo' })) T[k] = (await login(e)).token;
  ok('wrong password rejected (401)', (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@miftah.demo', password: 'x' }) })).status === 401);
  ok('no token → protected route 401', await st('/favorites') === 401);
  ok('forged token → 401', await st('/dashboard', 'abc.def.ghi') === 401);
  ok('seeker → advertiser dashboard 403', await st('/dashboard', T.seeker) === 403);
  ok('seeker → create listing 403', await st('/listings', T.seeker, 'POST', { type: 'villa', deal: 'sale', price: 1 }) === 403);
  ok('seeker → admin approvals 403', await st('/admin/status-requests', T.seeker) === 403);
  ok('company → edit another account’s listing 403', await st('/listings/l2', T.company, 'PATCH', { price: 1 }) === 403);
  ok('company → admin 403', await st('/admin/status-requests', T.company) === 403);
  ok('supervisor → approvals 200, user admin 403', await st('/admin/status-requests', T.super) === 200 && await st('/admin/users', T.super) === 403);
  ok('admin → user admin 200', await st('/admin/users', T.admin) === 200);
  ok('outsider cannot read a conversation (404)', await st('/conversations/' + convId, T.c2) === 404);
  const reg = await (await fetch(API + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'مكتب اختبار', email: `final${Date.now()}@test.sa`, password: 'password123', role: 'marketer', license: 'FAL-TEST-1' }) })).json();
  ok('register: password hashed (bcrypt) and unverified marketer cannot publish', db(`select password_hash like '$2%' from users where id='${reg.user.id}'`) === 't' && await st('/listings', reg.token, 'POST', { type: 'villa', deal: 'sale', price: 1000000, districtId: 'malqa', area: 300 }) === 403);
  await asUser('seeker@miftah.demo'); await p.goto(U + '#admin'); await p.waitForTimeout(600);
  ok('UI: seeker has no admin nav and sees staff-only notice', await p.locator('header a[href="#admin"]').count() === 0 && await p.locator('text=هذا القسم مخصص للمدير والمشرف').count() === 1);

  // ================= 5. Frontend ↔ backend =================
  section = 'Integration';
  const bad = calls.filter(c => /\s5\d\d$/.test(c));
  const unexpected4xx = calls.filter(c => /\s4\d\d$/.test(c) && c !== 'POST /listings 409');
  ok('no 5xx responses during the whole UI run', bad.length === 0, bad.join(', '));
  ok('only expected 4xx (the duplicate test)', unexpected4xx.length === 0, unexpected4xx.join(', '));
  ok('no JavaScript errors in the page', pageErrors.length === 0, pageErrors.join(' | '));
  console.log(`API calls made by the UI: ${calls.length}`);
  require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'miftah-e2e-ids.json'), JSON.stringify({ newL, convId, inquiry, propId, code }));
  await b.close();
  const f = results.filter(r => !r.pass);
  console.log(`\nTOTAL ${results.length - f.length}/${results.length} passed`);
})();
