import { chromium } from 'playwright';
const BASE = 'https://elias.centrohogarsanchez.es';
const DIR = '/root/eliasortega/test-results/screenshots/chat-v4';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Desktop dark mode
  console.log('=== DESKTOP DARK ===');
  const dCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const dp = await dCtx.newPage();
  await dp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await dp.waitForTimeout(3000);

  // Toggle dark using the LEFT panel's theme button (desktop only)
  const themeBtn = dp.locator('[data-testid="button-theme-toggle"]');
  await themeBtn.click({ timeout: 3000 });
  await dp.waitForTimeout(500);
  await dp.screenshot({ path: `${DIR}/07-desktop-dark.png`, fullPage: false });
  console.log('07 - Desktop dark');

  // Send a suggestion in dark mode
  await dp.locator('[data-testid^="button-suggestion"]').first().click();
  await dp.waitForTimeout(10000);
  await dp.screenshot({ path: `${DIR}/08-desktop-dark-conversation.png`, fullPage: false });
  console.log('08 - Desktop dark conversation');
  await dp.screenshot({ path: `${DIR}/08b-desktop-dark-full.png`, fullPage: true });
  console.log('08b - Desktop dark full');
  await dCtx.close();

  // Mobile dark mode
  console.log('\n=== MOBILE DARK ===');
  const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, ignoreHTTPSErrors: true });
  const mp = await mCtx.newPage();
  await mp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(3000);

  // Toggle dark using mobile header button
  const mTheme = mp.locator('[data-testid="button-theme-toggle-mobile"]');
  await mTheme.click({ timeout: 3000 });
  await mp.waitForTimeout(500);
  await mp.screenshot({ path: `${DIR}/12-mobile-dark.png`, fullPage: false });
  console.log('12 - Mobile dark');

  await mp.locator('[data-testid^="button-suggestion"]').first().click();
  await mp.waitForTimeout(10000);
  await mp.screenshot({ path: `${DIR}/12b-mobile-dark-conversation.png`, fullPage: false });
  console.log('12b - Mobile dark conversation');
  await mCtx.close();

  await browser.close();
  console.log('\n✅ Dark mode screenshots done!');
})();
