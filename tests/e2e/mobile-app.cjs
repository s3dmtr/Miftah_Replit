const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const ok = (n, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`);
  const shot = (n) => p.screenshot({ path: require('path').join(require('os').tmpdir(), `miftah-${n}.png`) });
  const tab = (label) => p.locator('nav[aria-label] button', { hasText: label }).first().click();
  const wait = (ms = 450) => p.waitForTimeout(ms);
  // Real horizontal overflow = a vertical scroller (or the page) that can scroll sideways.
  const overflow = () => p.evaluate(() => [document.documentElement, ...document.querySelectorAll('.scroll')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className.toString().slice(0, 40)));
  const top = () => p.locator('.push-in').last();

  await p.goto('' + (process.env.APP_URL ?? 'file://' + require('path').resolve(__dirname, '../../dist/index.html')) + ''); await wait(700);
  await shot('01-splash');
  ok('splash shows', await p.locator('text=MIFTAH').count() > 0);
  await wait(2200);
  ok('splash dismissed → home', await p.locator('text=عقار واحد، عدة عروض').count() === 1);
  await shot('02-home');
  ok('no desktop header', await p.locator('header nav a').count() === 0);
  ok('home: no horizontal overflow', (await overflow()).length === 0, (await overflow()).join(' | '));

  await p.locator('button:has-text("فلل")').click(); await wait(600);
  ok('category → pushed search', await p.locator('text=البحث عن عقار').count() === 1);
  await p.locator('button[aria-label="الفلاتر"]').click(); await wait(500);
  await shot('03-filters');
  await p.locator('.sheet button', { hasText: 'الملقا' }).click();
  await p.locator('.sheet button', { hasText: /عرض .* نتيجة/ }).click(); await wait(400);
  const rows = await top().locator('[role=button]').count();
  ok('filters applied (villa + Malqa)', rows >= 1, `${rows} results`);
  await shot('04-results');
  await top().locator('[role=button]').first().click(); await wait(700);
  await shot('05-property');
  ok('property details open', await p.locator('text=راسل المعلن').count() >= 1);
  const cmp = p.locator('button:has-text("قارن العروض")');
  ok('multiple offers + compare button', await cmp.count() === 1);
  await cmp.click(); await wait(700);
  await shot('06-compare');
  ok('compare screen', await p.locator('text=الفرق بين أعلى وأقل عرض').count() === 1);
  await p.locator('button:has-text("راسل هذا المعلن")').click(); await wait(800);
  await p.fill('#m-chat-input', 'السلام عليكم، هل الفيلا متاحة للمعاينة؟'); await p.locator('form button[type=submit]').click(); await wait(2000);
  await shot('07-chat');
  ok('chat: message sent + simulated reply', await p.locator('text=السلام عليكم، هل الفيلا متاحة للمعاينة؟').count() >= 1 && (await p.locator('text=شكراً لتواصلك').count() + await p.locator('text=سأرسل لك التفاصيل').count()) >= 1);
  // back out of stack
  for (let i = 0; i < 4; i++) { const back = p.locator('button[aria-label="رجوع"]').last(); if (await back.count()) { await back.click(); await wait(400); } }

  await tab('مفتاح AI'); await wait(500);
  await p.fill('#m-agent-input', 'ابغى فله للبيع بالملقا بحدود ٤ مليون قريبة من مسجد'); await p.keyboard.press('Enter'); await wait(1400);
  await shot('08-ai');
  ok('AI: Arabic query returns matches', await p.locator('text=وجدت').count() >= 1 && await p.locator('text=لماذا هذا الترشيح؟').count() >= 1);
  await tab('الرسائل'); await wait(500); await shot('09-inbox');
  ok('inbox lists conversations', await p.locator('.screen button.tap', { hasText: 'السلام' }).count() + (await p.locator('text=شكراً لتواصلك').count() + await p.locator('text=سأرسل لك التفاصيل').count()) >= 1);
  await tab('حسابي'); await wait(500); await shot('10-profile');
  ok('profile', await p.locator('text=تبديل الحساب التجريبي').count() === 1);
  await p.locator('button:has-text("العقارات المحفوظة")').click(); await wait(600);
  await p.locator('button:has-text("قارن")').first().click(); await wait(300);
  const items = top().locator('button.tap.rounded-\\[22px\\]');
  await items.nth(0).click(); await items.nth(1).click();
  await p.locator('button:has-text("قارن (")').click(); await wait(700);
  await shot('11-compare-saved');
  ok('saved comparison', await p.locator('text=مقارنة المحفوظات').count() === 1);
  for (let i = 0; i < 3; i++) { const back = p.locator('button[aria-label="رجوع"]').last(); if (await back.count()) { await back.click(); await wait(400); } }

  // advertiser
  await tab('حسابي'); await wait(400);
  await p.locator('button:has-text("تبديل الحساب التجريبي")').click(); await wait(500);
  await p.locator('button:has-text("دار السنام العقارية")').first().click(); await wait(900);
  ok('switched to company: dashboard tab', await p.locator('nav[aria-label] button', { hasText: 'لوحتي' }).count() === 1);
  await tab('لوحتي'); await wait(500); await shot('12-dashboard');
  await p.locator('.screen button.tap.flex.gap-3').first().click(); await wait(500);
  await shot('13-manage');
  await p.locator('.sheet button:has-text("تعديل السعر")').click(); await p.fill('#m-edit-price', '3999000'); await p.locator('.sheet button:has-text("حفظ السعر")').click(); await wait(500);
  ok('edit price via sheet', await p.locator('text=تم تحديث السعر').count() === 1);
  await p.locator('button:has-text("إعلان")').first().click(); await wait(600);
  await p.locator('button', { hasText: 'تعلن عنها مسبقاً' }).click(); await wait(300);
  await shot('14-add-dup');
  ok('add: duplicate blocked', await p.locator('text=لديك إعلان حي لنفس رقم كود الأرض').count() === 1);
  await p.locator('button', { hasText: 'قطعة جديدة' }).click(); await wait(300);
  await p.locator('button:has-text("التالي")').click(); await wait(300); await shot('15-add-step2');
  await p.locator('button:has-text("التالي")').click(); await wait(300);
  await p.fill('#m-price', '2450000'); await shot('16-add-step3');
  await p.locator('button:has-text("نشر الإعلان")').click(); await wait(700);
  await shot('17-published');
  ok('add: published', await p.locator('text=إعلانك منشور').count() === 1);
  await p.locator('button:has-text("إعلاناتي")').click(); await wait(800);

  // mark sold then supervisor approves
  const card = p.locator('.screen button.tap.flex.gap-3').first(); await card.click(); await wait(400);
  await p.locator('.sheet button:has-text("تم البيع")').click(); await p.locator('.sheet button:has-text("إرسال للتوثيق")').click(); await wait(500);
  await tab('حسابي'); await wait(400);
  await p.locator('button:has-text("تبديل الحساب التجريبي")').click(); await wait(500);
  await p.locator('button:has-text("مشرف المنصة")').click(); await wait(900);
  await tab('المراجعات'); await wait(500); await shot('18-reviews');
  const before = await p.locator('button:has-text("توثيق وإغلاق")').count();
  await p.locator('button:has-text("توثيق وإغلاق")').first().click(); await wait(600);
  ok('reviews: approve sync', await p.locator('button:has-text("توثيق وإغلاق")').count() === before - 1);

  // English
  await tab('حسابي'); await wait(400); await p.locator('button:has-text("اللغة")').click(); await wait(500);
  await tab('Home'); await wait(500); await shot('19-home-en');
  ok('English LTR', await p.evaluate(() => document.documentElement.dir) === 'ltr');
  console.log('ERRORS', errors);

  const d = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await d.goto('' + (process.env.APP_URL ?? 'file://' + require('path').resolve(__dirname, '../../dist/index.html')) + ''); await d.waitForTimeout(2800);
  await d.screenshot({ path: require('path').join(require('os').tmpdir(), 'miftah-20-desktop.png') });
  await b.close();
})();
