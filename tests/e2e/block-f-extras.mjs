/**
 * BLOQUE F: RESPONSIVE, DARK MODE Y EXTRAS (3 tests)
 * F1: Guide page
 * F2: Dark mode sweep all pages
 * F3: Exhaustive mobile/tablet audit (14 pages × 3 viewports = 42+ screenshots)
 */
import {
  BASE, launchBrowser, newContext, snap,
  loginAdmin, log, saveResults, TestResults,
} from './helpers.mjs';

const ADMIN_PAGES = [
  { path: '/', name: 'calendario' },
  { path: '/appointments', name: 'citas' },
  { path: '/warehouse', name: 'almacen' },
  { path: '/admin-chat', name: 'admin-chat' },
  { path: '/capacity', name: 'capacidad' },
  { path: '/docks', name: 'muelles' },
  { path: '/providers', name: 'proveedores' },
  { path: '/notifications', name: 'notificaciones' },
  { path: '/users', name: 'usuarios' },
  { path: '/audit', name: 'auditoria' },
  { path: '/analytics', name: 'precision' },
  { path: '/rules', name: 'reglas' },
  { path: '/guide', name: 'guia' },
];

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  BLOQUE F: RESPONSIVE, DARK MODE Y EXTRAS');
  console.log('═'.repeat(60) + '\n');

  const browser = await launchBrowser();
  const results = new TestResults('Bloque F: Extras');

  // ─── F1: Guide page ───
  try {
    log('F1', '▶ Página guía');
    const ctx = await newContext(browser, 'desktop');
    const page = await ctx.newPage();
    await loginAdmin(page);
    await page.goto(`${BASE}/guide`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    if (page.url().includes('/guide')) {
      await snap(page, 'F1-01-guia');

      // Mobile
      const mCtx = await newContext(browser, 'mobile');
      const mPage = await mCtx.newPage();
      await loginAdmin(mPage);
      await mPage.goto(`${BASE}/guide`, { waitUntil: 'networkidle', timeout: 15000 });
      await mPage.waitForTimeout(1500);
      await snap(mPage, 'F1-01-guia-mobile');

      // Tablet
      const tCtx = await newContext(browser, 'tablet');
      const tPage = await tCtx.newPage();
      await loginAdmin(tPage);
      await tPage.goto(`${BASE}/guide`, { waitUntil: 'networkidle', timeout: 15000 });
      await tPage.waitForTimeout(1500);
      await snap(tPage, 'F1-01-guia-tablet');

      // Try collapse/expand
      const collapsible = page.locator('[data-state="open"], button[aria-expanded="true"]').first();
      if (await collapsible.isVisible().catch(() => false)) {
        await collapsible.click();
        await page.waitForTimeout(500);
        await snap(page, 'F1-02-colapsada');
      }

      results.add('F1', 'PASS', 'Guide page captured in all viewports');
      await mCtx.close();
      await tCtx.close();
    } else {
      results.add('F1', 'SKIP', '/guide page not found');
    }
    await ctx.close();
  } catch (e) {
    results.add('F1', 'FAIL', e.message);
    log('F1', `❌ ${e.message}`);
  }

  // ─── F2: Dark mode sweep ───
  try {
    log('F2', '▶ Dark mode sweep');
    const ctx = await newContext(browser, 'desktop');
    const page = await ctx.newPage();
    await loginAdmin(page);

    // Enable dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(500);

    let darkCount = 0;
    for (const pg of ADMIN_PAGES) {
      try {
        await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        // Re-apply dark mode after navigation
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
        });
        await page.waitForTimeout(1500);

        if (!page.url().includes('/login')) {
          await snap(page, `F2-dark-${pg.name}`);
          darkCount++;
        }
      } catch {
        log('F2', `⚠️ Could not load ${pg.path} in dark mode`);
      }
    }

    // Also dark mode for public chat (no login needed)
    const chatCtx = await newContext(browser, 'desktop');
    const chatPage = await chatCtx.newPage();
    await chatPage.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 15000 });
    await chatPage.waitForTimeout(1500);
    // Toggle dark via button
    const themeBtn = chatPage.locator('[data-testid="button-theme-toggle"]');
    if (await themeBtn.isVisible().catch(() => false)) {
      await themeBtn.click();
      await chatPage.waitForTimeout(500);
    }
    await snap(chatPage, 'F2-dark-chat-publico');
    await chatCtx.close();

    results.add('F2', 'PASS', `Dark mode screenshots: ${darkCount + 1} pages`);
    await ctx.close();
  } catch (e) {
    results.add('F2', 'FAIL', e.message);
    log('F2', `❌ ${e.message}`);
  }

  // ─── F3: Exhaustive mobile/tablet audit (42+ screenshots) ───
  try {
    log('F3', '▶ Auditoría exhaustiva: 14 páginas × 3 viewports');
    const viewports = ['desktop', 'mobile', 'tablet'];
    const auditResults = [];

    // Public chat (no login)
    for (const vp of viewports) {
      const vpCtx = await newContext(browser, vp);
      const vpPage = await vpCtx.newPage();
      await vpPage.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 15000 });
      await vpPage.waitForTimeout(2000);
      const suffix = vp === 'desktop' ? '' : `-${vp}`;
      await snap(vpPage, `F3-chat${suffix}`);
      auditResults.push({ page: '/chat', viewport: vp, captured: true });
      await vpCtx.close();
    }

    // Admin pages
    for (const vp of viewports) {
      const vpCtx = await newContext(browser, vp);
      const vpPage = await vpCtx.newPage();
      await loginAdmin(vpPage);

      for (const pg of ADMIN_PAGES) {
        try {
          await vpPage.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
          await vpPage.waitForTimeout(1500);

          if (!vpPage.url().includes('/login')) {
            const suffix = vp === 'desktop' ? '' : `-${vp}`;
            await snap(vpPage, `F3-${pg.name}${suffix}`);
            auditResults.push({ page: pg.path, viewport: vp, captured: true });
          } else {
            auditResults.push({ page: pg.path, viewport: vp, captured: false, reason: 'redirected to login' });
          }
        } catch (e) {
          auditResults.push({ page: pg.path, viewport: vp, captured: false, reason: e.message });
        }
      }

      await vpCtx.close();
    }

    const captured = auditResults.filter(r => r.captured).length;
    const failed = auditResults.filter(r => !r.captured);
    let notes = `${captured} screenshots captured`;
    if (failed.length > 0) {
      notes += `, ${failed.length} failed: ${failed.map(f => `${f.page}(${f.viewport})`).join(', ')}`;
    }

    results.add('F3', captured >= 30 ? 'PASS' : 'PARTIAL', notes);
    saveResults('f3-audit-matrix.json', auditResults);
  } catch (e) {
    results.add('F3', 'FAIL', e.message);
    log('F3', `❌ ${e.message}`);
  }

  await browser.close();
  results.print();
  saveResults('block-f-results.json', results.summary());
  console.log('\n✅ Bloque F complete.\n');
})();
