const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const ok = (n, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`);
  const top = () => p.locator('.push-in').last();
  const wait = (ms) => p.waitForTimeout(ms);
  await p.goto(process.env.APP_URL ?? 'file://' + require('path').resolve(__dirname, '../../dist/index.html')); await wait(3000);

  // 1. Conversational agent
  await p.locator('nav[aria-label] button', { hasText: 'مفتاح AI' }).click(); await wait(500);
  const say = async (t) => { const before = await p.locator('.tab-in.grid.gap-2\\.5').count(); await p.fill('#m-agent-input', t); await p.keyboard.press('Enter'); await p.waitForFunction((n) => document.querySelectorAll('.tab-in.grid.gap-2\\.5').length > n, before, { timeout: 8000 }); await wait(250); return (await p.locator('.tab-in.grid.gap-2\\.5').last().innerText()); };
  let r = await say('السلام عليكم'); ok('agent greets back and asks (no results yet)', /وعليكم السلام/.test(r) && /شراء ولا للإيجار/.test(r), r.slice(0, 80));
  r = await say('ابي اشتري بيت لعيلتي'); ok('asks property type', /نوع العقار/.test(r));
  r = await say('فيلا'); ok('asks district with live context', /حي معيّن/.test(r) && /أكثر الخيارات/.test(r));
  r = await say('ما يفرق'); ok('understands "no preference" and asks budget with price range', /كل الأحياء/.test(r) && /الميزانية/.test(r) && /يبدأ من/.test(r));
  r = await say('حدود ٤ مليون'); ok('asks rooms/family', /غرفة نوم|أفراد الأسرة/.test(r));
  r = await say('احنا ٦ افراد'); ok('converts family size to rooms', /لأسرة من ٦ أفراد/.test(r));
  r = await say('قريب من مسجد ومدرسة'); ok('summarises then recommends with reasons', /خلني ألخص طلبك/.test(r) && /ترشيحي الأول/.test(r) && /لأن/.test(r));
  ok('top pick labelled in card', await p.locator('text=ترشيحي الأول').count() >= 2);
  r = await say('حدثني عن الأول'); ok('answers about first result', /بخصوص الخيار الأول/.test(r));
  r = await say('فيه مسبح؟'); ok('follow-up about that property (not new search)', /بخصوص الخيار الأول/.test(r) && /مسبح/.test(r));
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'miftah-n-agent.png') });

  // 2. Payment from property
  await p.locator('.tab-in.grid.gap-2\\.5').last().locator('button').first().click(); await wait(800);
  await top().locator('button', { hasText: 'احجز الآن' }).click(); await wait(800);
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'miftah-n-pay1.png') });
  ok('payment summary shows deposit + note', await top().locator('text=عربون حجز العقار').count() === 1 && await top().locator('text=ضريبة التصرفات العقارية').count() === 1);
  await top().locator('button', { hasText: 'متابعة الحجز' }).click(); await wait(400);
  await p.fill('#pay-id', '1012345678'); await p.fill('#pay-phone', '0551234567');
  await top().locator('button', { hasText: 'أوافق' }).click(); await top().locator('button', { hasText: 'التالي' }).click(); await wait(400);
  await top().locator('button', { hasText: 'مدى' }).last().click(); await wait(200);
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'miftah-n-pay2.png') });
  ok('card brand detected as mada', await top().locator('text=•••').count() >= 0 && await top().locator('#pay-card').inputValue() === '4464 0400 0000 0007');
  await top().locator('button', { hasText: /^ادفع/ }).click(); await wait(500);
  await p.fill('#pay-otp', '000000'); await top().locator('button', { hasText: 'تأكيد الدفع' }).click(); await wait(2600);
  ok('wrong OTP rejected', await top().locator('text=رمز التحقق غير صحيح').count() === 1);
  await p.fill('#pay-otp', '123456'); await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'miftah-n-pay3.png') });
  await top().locator('button', { hasText: 'تأكيد الدفع' }).click(); await wait(800);
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'miftah-n-pay4.png') }); await wait(2600);
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'miftah-n-receipt.png'), fullPage: false });
  ok('receipt shown', await top().locator('text=تم الدفع بنجاح').count() === 1 && await top().locator('text=MFT-').count() >= 1 && await top().locator('text=4464').count() === 0);
  ok('receipt masks card (•••• 0007)', await top().locator('text=•••• 0007').count() === 1);
  // 3. Chat with advertiser
  await top().locator('button', { hasText: 'المعلن' }).last().click(); await wait(900);
  ok('payment message posted to chat', await top().locator('text=تم دفع عربون حجز عن طريق مفتاح').count() === 1);
  const send = async (t) => { await p.fill('#m-chat-input', t); await top().locator('form button[type=submit]').click(); await wait(500); const typing = await top().locator('text=يكتب…').count(); await wait(3600); return typing; };
  const typed = await send('السلام عليكم، السعر قابل للتفاوض؟');
  let txt = await top().locator('.scroll').innerText();
  ok('typing indicator shown', typed === 1);
  ok('advertiser greets + answers price from data', /وعليكم السلام/.test(txt) && /السعر المعلن/.test(txt));
  await send('اعطيك ٣ مليون و٨٠٠ ألف'); txt = await top().locator('.scroll').innerText();
  ok('negotiation counter-offer', /أقدر أنزل|قريب جداً|بعيد عن سعر السوق/.test(txt));
  await send('متى أقدر أعاين؟'); txt = await top().locator('.scroll').innerText();
  ok('offers viewing slots', /يسعدنا نرتب معاينة/.test(txt));
  await top().locator('button', { hasText: 'الموعد الأول يناسبني' }).click(); await wait(4000); txt = await top().locator('.scroll').innerText();
  ok('suggestion chip confirms appointment', /ثبتنا الموعد/.test(txt));
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'miftah-n-chat.png') });
  // 4. payments list
  for (let i = 0; i < 5; i++) { const bk = p.locator('button[aria-label="رجوع"]').last(); if (await bk.count()) { await bk.click(); await wait(350); } }
  await p.locator('nav[aria-label] button', { hasText: 'حسابي' }).click(); await wait(400);
  await p.locator('button', { hasText: 'مدفوعاتي' }).click(); await wait(600);
  ok('payments list has the receipt', await top().locator('text=MFT-').count() === 1);
  // advertiser sees it
  for (let i = 0; i < 2; i++) { const bk = p.locator('button[aria-label="رجوع"]').last(); if (await bk.count()) { await bk.click(); await wait(350); } }
  console.log('ERRORS', errors);
  await b.close();
})();
