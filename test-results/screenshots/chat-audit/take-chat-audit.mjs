import { chromium } from 'playwright';

const BASE = 'https://elias.centrohogarsanchez.es';
const DIR = '/root/eliasortega/test-results/screenshots/chat-audit';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ═══════════════════════════════════════════
  //  DESKTOP 1400x900
  // ═══════════════════════════════════════════
  console.log('=== DESKTOP 1400x900 ===');
  const dCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const dp = await dCtx.newPage();

  dp.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
  dp.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await dp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await dp.waitForTimeout(3000);
  console.log('URL:', dp.url());

  // D1: Initial state — empty chat
  await dp.screenshot({ path: `${DIR}/d01-desktop-initial.png`, fullPage: false });
  console.log('D01 - Desktop initial state');

  // D2: Full page
  await dp.screenshot({ path: `${DIR}/d02-desktop-full.png`, fullPage: true });
  console.log('D02 - Desktop full page');

  // D3: Check header/branding
  const headerText = await dp.locator('header, [class*="header"], nav').first().textContent().catch(() => 'none');
  console.log('D03 - Header text:', headerText?.substring(0, 100));

  // D4: Check input area
  const inputArea = await dp.locator('textarea, input[type="text"], [contenteditable]').count();
  console.log('D04 - Input areas found:', inputArea);

  // D5: Try typing a message
  const textarea = dp.locator('textarea').first();
  if (await textarea.count() > 0) {
    await textarea.fill('Hola, soy de Tapicería Jaén y quiero reservar una cita para descargar');
    await dp.waitForTimeout(500);
    await dp.screenshot({ path: `${DIR}/d05-desktop-typing.png`, fullPage: false });
    console.log('D05 - Desktop with typed message');

    // D6: Send the message
    const sendBtn = dp.locator('button[type="submit"], button:has(svg)').last();
    if (await sendBtn.count() > 0) {
      await sendBtn.click();
      await dp.waitForTimeout(8000); // Wait for AI response
      await dp.screenshot({ path: `${DIR}/d06-desktop-conversation.png`, fullPage: false });
      console.log('D06 - Desktop after sending message');

      // D7: Full page with conversation
      await dp.screenshot({ path: `${DIR}/d07-desktop-conversation-full.png`, fullPage: true });
      console.log('D07 - Desktop conversation full page');
    }
  }

  // D8: Dark mode check — use last visible toggle
  const themeToggle = dp.locator('[data-testid="button-theme-toggle"]').last();
  try {
    await themeToggle.click({ timeout: 3000 });
    await dp.waitForTimeout(500);
    await dp.screenshot({ path: `${DIR}/d08-desktop-dark.png`, fullPage: false });
    console.log('D08 - Desktop dark mode');
  } catch {
    console.log('D08 - Could not click theme toggle, skipping dark mode');
  }

  await dCtx.close();

  // ═══════════════════════════════════════════
  //  MOBILE 375x812 (iPhone 13 mini)
  // ═══════════════════════════════════════════
  console.log('\n=== MOBILE 375x812 ===');
  const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, ignoreHTTPSErrors: true });
  const mp = await mCtx.newPage();
  await mp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(3000);

  // M1: Mobile initial
  await mp.screenshot({ path: `${DIR}/m01-mobile-initial.png`, fullPage: false });
  console.log('M01 - Mobile initial state');

  // M2: Mobile full
  await mp.screenshot({ path: `${DIR}/m02-mobile-full.png`, fullPage: true });
  console.log('M02 - Mobile full page');

  // M3: Type and send
  const mTextarea = mp.locator('textarea').first();
  if (await mTextarea.count() > 0) {
    await mTextarea.fill('Hola, soy de Tapicería Jaén');
    await mp.waitForTimeout(300);
    await mp.screenshot({ path: `${DIR}/m03-mobile-typing.png`, fullPage: false });
    console.log('M03 - Mobile typing');

    const mSendBtn = mp.locator('button[type="submit"], button:has(svg)').last();
    if (await mSendBtn.count() > 0) {
      await mSendBtn.click();
      await mp.waitForTimeout(8000);
      await mp.screenshot({ path: `${DIR}/m04-mobile-conversation.png`, fullPage: false });
      console.log('M04 - Mobile conversation');

      await mp.screenshot({ path: `${DIR}/m05-mobile-conversation-full.png`, fullPage: true });
      console.log('M05 - Mobile conversation full');
    }
  }

  // M6: Check virtual keyboard behavior
  if (await mTextarea.count() > 0) {
    await mTextarea.focus();
    await mp.waitForTimeout(500);
    await mp.screenshot({ path: `${DIR}/m06-mobile-keyboard-focus.png`, fullPage: false });
    console.log('M06 - Mobile input focused');
  }

  await mCtx.close();

  // ═══════════════════════════════════════════
  //  TABLET 768x1024
  // ═══════════════════════════════════════════
  console.log('\n=== TABLET 768x1024 ===');
  const tCtx = await browser.newContext({ viewport: { width: 768, height: 1024 }, ignoreHTTPSErrors: true });
  const tp = await tCtx.newPage();
  await tp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await tp.waitForTimeout(3000);

  // T1: Tablet initial
  await tp.screenshot({ path: `${DIR}/t01-tablet-initial.png`, fullPage: false });
  console.log('T01 - Tablet initial');

  // T2: Tablet full
  await tp.screenshot({ path: `${DIR}/t02-tablet-full.png`, fullPage: true });
  console.log('T02 - Tablet full');

  await tCtx.close();

  // ═══════════════════════════════════════════
  //  WIDE DESKTOP 1920x1080
  // ═══════════════════════════════════════════
  console.log('\n=== WIDE 1920x1080 ===');
  const wCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  const wp = await wCtx.newPage();
  await wp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await wp.waitForTimeout(3000);

  await wp.screenshot({ path: `${DIR}/w01-wide-initial.png`, fullPage: false });
  console.log('W01 - Wide desktop initial');

  await wCtx.close();

  // ═══════════════════════════════════════════
  //  SMALL MOBILE 320x568 (iPhone SE)
  // ═══════════════════════════════════════════
  console.log('\n=== SMALL MOBILE 320x568 ===');
  const sCtx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, ignoreHTTPSErrors: true });
  const sp = await sCtx.newPage();
  await sp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await sp.waitForTimeout(3000);

  await sp.screenshot({ path: `${DIR}/s01-small-mobile-initial.png`, fullPage: false });
  console.log('S01 - Small mobile initial');

  await sp.screenshot({ path: `${DIR}/s02-small-mobile-full.png`, fullPage: true });
  console.log('S02 - Small mobile full');

  await sCtx.close();

  // ═══════════════════════════════════════════
  //  LANDSCAPE MOBILE 812x375
  // ═══════════════════════════════════════════
  console.log('\n=== LANDSCAPE 812x375 ===');
  const lCtx = await browser.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, ignoreHTTPSErrors: true });
  const lp = await lCtx.newPage();
  await lp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await lp.waitForTimeout(3000);

  await lp.screenshot({ path: `${DIR}/l01-landscape-initial.png`, fullPage: false });
  console.log('L01 - Landscape initial');

  await lCtx.close();

  await browser.close();
  console.log('\n✅ All chat audit screenshots done!');
})();
