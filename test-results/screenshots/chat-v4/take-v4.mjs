import { chromium } from 'playwright';
const BASE = 'https://elias.centrohogarsanchez.es';
const DIR = '/root/eliasortega/test-results/screenshots/chat-v4';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ═══════════════════════════════════════════
  //  DESKTOP 1400x900
  // ═══════════════════════════════════════════
  console.log('=== DESKTOP 1400x900 ===');
  const dCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const dp = await dCtx.newPage();
  dp.on('pageerror', e => console.log('ERR:', e.message));
  dp.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE:', msg.text()); });
  
  await dp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await dp.waitForTimeout(3000);

  await dp.screenshot({ path: `${DIR}/01-desktop-welcome.png`, fullPage: false });
  console.log('01 - Desktop welcome');

  // Click suggestion
  await dp.locator('[data-testid^="button-suggestion"]').first().click();
  await dp.waitForTimeout(10000);
  await dp.screenshot({ path: `${DIR}/02-desktop-conversation.png`, fullPage: false });
  console.log('02 - Desktop conversation');

  // Hover for copy/feedback actions
  const lastAssistant = dp.locator('[data-testid^="message-assistant"]').last();
  if (await lastAssistant.count() > 0) {
    await lastAssistant.hover();
    await dp.waitForTimeout(500);
    await dp.screenshot({ path: `${DIR}/03-desktop-hover-actions.png`, fullPage: false });
    console.log('03 - Desktop hover actions');
    
    const copyBtn = await dp.locator('[data-testid="button-copy-message"]').count();
    const thumbUp = await dp.locator('[data-testid="button-feedback-up"]').count();
    const thumbDown = await dp.locator('[data-testid="button-feedback-down"]').count();
    console.log(`   Copy: ${copyBtn}, ThumbUp: ${thumbUp}, ThumbDown: ${thumbDown}`);
  }

  // Full page
  await dp.screenshot({ path: `${DIR}/04-desktop-full.png`, fullPage: true });
  console.log('04 - Desktop full');

  // Send second message
  const textarea = dp.locator('[data-testid="input-message"]');
  if (await textarea.count() > 0) {
    await textarea.fill('¿Qué horarios tiene el almacén?');
    const sendBtn = dp.locator('[data-testid="button-send"]');
    await sendBtn.click();
    await dp.waitForTimeout(500);
    await dp.screenshot({ path: `${DIR}/05-desktop-streaming.png`, fullPage: false });
    console.log('05 - Desktop streaming');
    await dp.waitForTimeout(10000);
    await dp.screenshot({ path: `${DIR}/06-desktop-multi-msg.png`, fullPage: false });
    console.log('06 - Desktop multi messages');
  }

  // Dark mode
  const themeBtn = dp.locator('[data-testid="button-theme-toggle"]');
  try {
    await themeBtn.click({ timeout: 3000 });
    await dp.waitForTimeout(500);
    await dp.screenshot({ path: `${DIR}/07-desktop-dark.png`, fullPage: false });
    console.log('07 - Desktop dark');
    await dp.screenshot({ path: `${DIR}/08-desktop-dark-full.png`, fullPage: true });
    console.log('08 - Desktop dark full');
  } catch(e) { console.log('07 - Dark mode failed:', e.message); }
  
  await dCtx.close();

  // ═══════════════════════════════════════════
  //  MOBILE 375x812
  // ═══════════════════════════════════════════
  console.log('\n=== MOBILE 375x812 ===');
  const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, ignoreHTTPSErrors: true });
  const mp = await mCtx.newPage();
  await mp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(3000);

  await mp.screenshot({ path: `${DIR}/09-mobile-welcome.png`, fullPage: false });
  console.log('09 - Mobile welcome');
  await mp.screenshot({ path: `${DIR}/10-mobile-full.png`, fullPage: true });
  console.log('10 - Mobile full');

  await mp.locator('[data-testid^="button-suggestion"]').first().click();
  await mp.waitForTimeout(10000);
  await mp.screenshot({ path: `${DIR}/11-mobile-conversation.png`, fullPage: false });
  console.log('11 - Mobile conversation');

  // Mobile dark
  const mTheme = mp.locator('[data-testid="button-theme-toggle"]');
  try {
    await mTheme.click({ timeout: 3000 });
    await mp.waitForTimeout(500);
    await mp.screenshot({ path: `${DIR}/12-mobile-dark.png`, fullPage: false });
    console.log('12 - Mobile dark');
  } catch(e) { console.log('12 - Mobile dark failed:', e.message); }
  
  await mCtx.close();

  // ═══════════════════════════════════════════
  //  TABLET 768x1024
  // ═══════════════════════════════════════════
  console.log('\n=== TABLET 768x1024 ===');
  const tCtx = await browser.newContext({ viewport: { width: 768, height: 1024 }, ignoreHTTPSErrors: true });
  const tp = await tCtx.newPage();
  await tp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await tp.waitForTimeout(3000);
  await tp.screenshot({ path: `${DIR}/13-tablet.png`, fullPage: false });
  console.log('13 - Tablet');
  await tCtx.close();

  // ═══════════════════════════════════════════
  //  WIDE 1920x1080
  // ═══════════════════════════════════════════
  console.log('\n=== WIDE 1920x1080 ===');
  const wCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  const wp = await wCtx.newPage();
  await wp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await wp.waitForTimeout(3000);
  await wp.screenshot({ path: `${DIR}/14-wide.png`, fullPage: false });
  console.log('14 - Wide desktop');
  await wCtx.close();

  // ═══════════════════════════════════════════
  //  LANDSCAPE 812x375
  // ═══════════════════════════════════════════
  console.log('\n=== LANDSCAPE 812x375 ===');
  const lCtx = await browser.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, ignoreHTTPSErrors: true });
  const lp = await lCtx.newPage();
  await lp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await lp.waitForTimeout(3000);
  await lp.screenshot({ path: `${DIR}/15-landscape.png`, fullPage: false });
  console.log('15 - Landscape');
  await lCtx.close();

  await browser.close();
  console.log('\n✅ V4 screenshots done!');
})();
