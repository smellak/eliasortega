import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'https://elias.centrohogarsanchez.es';
const DIR = '/root/eliasortega/test-results/screenshots/visual-audit-v3';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ──────── DESKTOP (1400x900) ────────
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  console.log('Logging in (desktop)...');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@admin.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Save auth state for reuse
  const state = await ctx.storageState();
  writeFileSync('/tmp/auth-state.json', JSON.stringify(state));

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 01. Week empty (current week Feb 23-28)
  await page.screenshot({ path: `${DIR}/01-desktop-week-empty.png`, fullPage: true });
  console.log('01 - Desktop week empty');

  // 02. Week with data (Mar 2-7)
  await page.click('[data-testid="button-calendar-next"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${DIR}/02-desktop-week-data-viewport.png`, fullPage: false });
  await page.screenshot({ path: `${DIR}/02-desktop-week-data-full.png`, fullPage: true });
  console.log('02 - Desktop week with data');

  // 03. Week scrolled down
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/03-desktop-week-scrolled.png`, fullPage: false });
  console.log('03 - Desktop week scrolled');

  // 04. KPI details expanded
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.click('[data-testid="button-toggle-details"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/04-desktop-details-expanded.png`, fullPage: true });
  console.log('04 - Details expanded');
  await page.click('[data-testid="button-toggle-details"]');

  // 05. Day view - Monday Mar 2 (with appointments)
  await page.click('[data-testid="button-view-day"]');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}/05-desktop-day-mar2-viewport.png`, fullPage: false });
  await page.screenshot({ path: `${DIR}/05-desktop-day-mar2-full.png`, fullPage: true });
  console.log('05 - Day Mar 2 (with appointments)');

  // 06. Day view - Tuesday Mar 3
  await page.click('[data-testid="button-calendar-next"]');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}/06-desktop-day-mar3-full.png`, fullPage: true });
  console.log('06 - Day Mar 3');

  // 07. Day view - Wednesday Mar 4 (empty)
  await page.click('[data-testid="button-calendar-next"]');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}/07-desktop-day-mar4-empty.png`, fullPage: true });
  console.log('07 - Day Mar 4 (empty)');

  // 08. Day view - Saturday Mar 7 (2 slots)
  for (let i = 0; i < 3; i++) {
    await page.click('[data-testid="button-calendar-next"]');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}/08-desktop-day-sat-full.png`, fullPage: true });
  console.log('08 - Day Saturday');

  // 09. Day view - Sunday (no slots)
  await page.click('[data-testid="button-calendar-next"]');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}/09-desktop-day-sunday.png`, fullPage: false });
  console.log('09 - Day Sunday (no slots)');

  // 10. Month view - March
  await page.click('[data-testid="button-view-month"]');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/10-desktop-month-mar.png`, fullPage: true });
  console.log('10 - Month March');

  // 11. Month view - February
  await page.click('[data-testid="button-calendar-prev"]');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/11-desktop-month-feb.png`, fullPage: true });
  console.log('11 - Month February');

  // 12. Week view with "Hoy" button
  await page.click('[data-testid="button-view-week"]');
  await page.waitForTimeout(1000);
  await page.click('[data-testid="button-calendar-today"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${DIR}/12-desktop-week-today.png`, fullPage: true });
  console.log('12 - Week after Hoy');

  await ctx.close();

  // ──────── DARK MODE (1400x900) ────────
  console.log('\n--- DARK MODE ---');
  const darkCtx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
    storageState: '/tmp/auth-state.json',
  });
  const darkPage = await darkCtx.newPage();
  await darkPage.goto(BASE + '/', { waitUntil: 'networkidle' });
  await darkPage.waitForTimeout(2000);

  // Toggle dark mode
  try {
    const allBtns = await darkPage.$$('button');
    for (const btn of allBtns) {
      const inner = await btn.innerHTML();
      if (inner.includes('Moon') || inner.includes('Sun') || inner.includes('moon') || inner.includes('sun')) {
        await btn.click();
        break;
      }
    }
    await darkPage.waitForTimeout(1500);
  } catch (e) {
    await darkPage.evaluate(() => document.documentElement.classList.add('dark'));
    await darkPage.waitForTimeout(500);
  }

  // 13. Dark week with data
  await darkPage.click('[data-testid="button-calendar-next"]');
  await darkPage.waitForTimeout(2500);
  await darkPage.screenshot({ path: `${DIR}/13-dark-week-data.png`, fullPage: true });
  console.log('13 - Dark week');

  // 14. Dark day with appointments
  await darkPage.click('[data-testid="button-view-day"]');
  await darkPage.waitForTimeout(2000);
  await darkPage.screenshot({ path: `${DIR}/14-dark-day-full.png`, fullPage: true });
  console.log('14 - Dark day');

  // 15. Dark day empty
  await darkPage.click('[data-testid="button-calendar-next"]');
  await darkPage.waitForTimeout(300);
  await darkPage.click('[data-testid="button-calendar-next"]');
  await darkPage.waitForTimeout(2000);
  await darkPage.screenshot({ path: `${DIR}/15-dark-day-empty.png`, fullPage: true });
  console.log('15 - Dark day empty');

  // 16. Dark month
  await darkPage.click('[data-testid="button-view-month"]');
  await darkPage.waitForTimeout(3000);
  await darkPage.screenshot({ path: `${DIR}/16-dark-month.png`, fullPage: true });
  console.log('16 - Dark month');

  // 17. Dark KPIs close-up
  await darkPage.evaluate(() => window.scrollTo(0, 0));
  await darkPage.waitForTimeout(300);
  await darkPage.screenshot({ path: `${DIR}/17-dark-kpis.png`, fullPage: false });
  console.log('17 - Dark KPIs');

  await darkCtx.close();

  // ──────── MOBILE (375x812) ────────
  console.log('\n--- MOBILE ---');
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    ignoreHTTPSErrors: true,
    storageState: '/tmp/auth-state.json',
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(BASE + '/', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(3000);

  // 18. Mobile day (auto-redirected from week)
  await mobilePage.screenshot({ path: `${DIR}/18-mobile-day-viewport.png`, fullPage: false });
  await mobilePage.screenshot({ path: `${DIR}/18-mobile-day-full.png`, fullPage: true });
  console.log('18 - Mobile day auto');

  // 19. Mobile day with data
  await mobilePage.evaluate(() => document.querySelector('[data-testid="button-calendar-next"]')?.click());
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: `${DIR}/19-mobile-day-data-viewport.png`, fullPage: false });
  await mobilePage.screenshot({ path: `${DIR}/19-mobile-day-data-full.png`, fullPage: true });
  console.log('19 - Mobile day with data');

  // 20. Mobile month
  await mobilePage.evaluate(() => document.querySelector('[data-testid="button-view-month"]')?.click());
  await mobilePage.waitForTimeout(3000);
  await mobilePage.screenshot({ path: `${DIR}/20-mobile-month-viewport.png`, fullPage: false });
  await mobilePage.screenshot({ path: `${DIR}/20-mobile-month-full.png`, fullPage: true });
  console.log('20 - Mobile month');

  // 21. Mobile KPIs
  await mobilePage.evaluate(() => window.scrollTo(0, 0));
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({ path: `${DIR}/21-mobile-kpis.png`, fullPage: false });
  console.log('21 - Mobile KPIs');

  // 22. Mobile day sunday (no slots)
  await mobilePage.evaluate(() => document.querySelector('[data-testid="button-view-day"]')?.click());
  await mobilePage.waitForTimeout(1000);
  for (let i = 0; i < 6; i++) {
    await mobilePage.evaluate(() => document.querySelector('[data-testid="button-calendar-next"]')?.click());
    await mobilePage.waitForTimeout(300);
  }
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: `${DIR}/22-mobile-day-sunday.png`, fullPage: false });
  console.log('22 - Mobile day sunday');

  await mobileCtx.close();

  // ──────── TABLET (768x1024) ────────
  console.log('\n--- TABLET ---');
  const tabletCtx = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    ignoreHTTPSErrors: true,
    storageState: '/tmp/auth-state.json',
  });
  const tabletPage = await tabletCtx.newPage();
  await tabletPage.goto(BASE + '/', { waitUntil: 'networkidle' });
  await tabletPage.waitForTimeout(3000);

  // 23. Tablet week
  await tabletPage.screenshot({ path: `${DIR}/23-tablet-week-viewport.png`, fullPage: false });
  console.log('23 - Tablet week viewport');

  // 24. Tablet week with data
  await tabletPage.evaluate(() => document.querySelector('[data-testid="button-calendar-next"]')?.click());
  await tabletPage.waitForTimeout(2500);
  await tabletPage.screenshot({ path: `${DIR}/24-tablet-week-data.png`, fullPage: true });
  console.log('24 - Tablet week data');

  // 25. Tablet day
  await tabletPage.evaluate(() => document.querySelector('[data-testid="button-view-day"]')?.click());
  await tabletPage.waitForTimeout(2000);
  await tabletPage.screenshot({ path: `${DIR}/25-tablet-day.png`, fullPage: true });
  console.log('25 - Tablet day');

  // 26. Tablet month
  await tabletPage.evaluate(() => document.querySelector('[data-testid="button-view-month"]')?.click());
  await tabletPage.waitForTimeout(3000);
  await tabletPage.screenshot({ path: `${DIR}/26-tablet-month.png`, fullPage: true });
  console.log('26 - Tablet month');

  await tabletCtx.close();

  // ──────── WIDE DESKTOP (1920x1080) ────────
  console.log('\n--- WIDE DESKTOP ---');
  const wideCtx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    storageState: '/tmp/auth-state.json',
  });
  const widePage = await wideCtx.newPage();
  await widePage.goto(BASE + '/', { waitUntil: 'networkidle' });
  await widePage.waitForTimeout(2000);

  // 27. Wide desktop week
  await widePage.evaluate(() => document.querySelector('[data-testid="button-calendar-next"]')?.click());
  await widePage.waitForTimeout(2500);
  await widePage.screenshot({ path: `${DIR}/27-wide-week.png`, fullPage: false });
  console.log('27 - Wide desktop week');

  // 28. Wide desktop month
  await widePage.evaluate(() => document.querySelector('[data-testid="button-view-month"]')?.click());
  await widePage.waitForTimeout(3000);
  await widePage.screenshot({ path: `${DIR}/28-wide-month.png`, fullPage: false });
  console.log('28 - Wide desktop month');

  await wideCtx.close();
  await browser.close();
  console.log('\nAll 28 screenshots done!');
})();
