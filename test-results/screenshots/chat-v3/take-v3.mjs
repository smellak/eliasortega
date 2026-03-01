import { chromium } from 'playwright';
const BASE = 'https://elias.centrohogarsanchez.es';
const DIR = '/root/eliasortega/test-results/screenshots/chat-v3';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Desktop 1400x900
  console.log('=== DESKTOP ===');
  const dCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const dp = await dCtx.newPage();
  dp.on('pageerror', e => console.log('ERR:', e.message));
  await dp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await dp.waitForTimeout(3000);

  await dp.screenshot({ path: `${DIR}/01-desktop-welcome.png`, fullPage: false });
  console.log('01 - Desktop welcome');

  // Send via suggestion
  await dp.locator('[data-testid^="button-suggestion"]').first().click();
  await dp.waitForTimeout(8000);
  await dp.screenshot({ path: `${DIR}/02-desktop-conversation.png`, fullPage: false });
  console.log('02 - Desktop conversation');

  await dp.screenshot({ path: `${DIR}/03-desktop-full.png`, fullPage: true });
  console.log('03 - Desktop full');

  // Dark mode
  const theme = dp.locator('[data-testid="button-theme-toggle"]').last();
  try {
    await theme.click({ timeout: 3000 });
    await dp.waitForTimeout(500);
    await dp.screenshot({ path: `${DIR}/04-desktop-dark.png`, fullPage: false });
    console.log('04 - Desktop dark');
    await dp.screenshot({ path: `${DIR}/05-desktop-dark-full.png`, fullPage: true });
    console.log('05 - Desktop dark full');
  } catch { console.log('04 - theme toggle failed'); }
  await dCtx.close();

  // Mobile 375x812
  console.log('\n=== MOBILE ===');
  const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, ignoreHTTPSErrors: true });
  const mp = await mCtx.newPage();
  await mp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(3000);

  await mp.screenshot({ path: `${DIR}/06-mobile-welcome.png`, fullPage: false });
  console.log('06 - Mobile welcome (video always visible)');

  await mp.locator('[data-testid^="button-suggestion"]').first().click();
  await mp.waitForTimeout(8000);
  await mp.screenshot({ path: `${DIR}/07-mobile-conversation.png`, fullPage: false });
  console.log('07 - Mobile conversation');
  await mCtx.close();

  // Tablet 768x1024
  console.log('\n=== TABLET ===');
  const tCtx = await browser.newContext({ viewport: { width: 768, height: 1024 }, ignoreHTTPSErrors: true });
  const tp = await tCtx.newPage();
  await tp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await tp.waitForTimeout(3000);
  await tp.screenshot({ path: `${DIR}/08-tablet.png`, fullPage: false });
  console.log('08 - Tablet');
  await tCtx.close();

  // Wide 1920x1080
  console.log('\n=== WIDE ===');
  const wCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  const wp = await wCtx.newPage();
  await wp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await wp.waitForTimeout(3000);
  await wp.screenshot({ path: `${DIR}/09-wide.png`, fullPage: false });
  console.log('09 - Wide');
  await wCtx.close();

  // Landscape 812x375
  console.log('\n=== LANDSCAPE ===');
  const lCtx = await browser.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, ignoreHTTPSErrors: true });
  const lp = await lCtx.newPage();
  await lp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await lp.waitForTimeout(3000);
  await lp.screenshot({ path: `${DIR}/10-landscape.png`, fullPage: false });
  console.log('10 - Landscape');
  await lCtx.close();

  await browser.close();
  console.log('\n✅ Done');
})();
