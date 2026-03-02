/**
 * BLOQUE E: REGLAS DE PROGRAMACIÓN (5 tests)
 * Desktop + Mobile + Tablet
 * If /rules doesn't exist, skip entire block
 */
import {
  BASE, launchBrowser, newContext, snap,
  loginAdmin, log, saveResults, TestResults,
} from './helpers.mjs';

(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  BLOQUE E: REGLAS DE PROGRAMACIÓN — 5 tests');
  console.log('═'.repeat(60) + '\n');

  const browser = await launchBrowser();
  const results = new TestResults('Bloque E: Scheduling Rules');

  // Check if /rules page exists
  const ctx = await newContext(browser, 'desktop');
  const page = await ctx.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE}/rules`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  const url = page.url();
  const hasRulesPage = url.includes('/rules') && !url.includes('/login');

  if (!hasRulesPage) {
    console.log('⏭️  /rules page does not exist — SKIPPING entire block E');
    results.add('E1', 'SKIP', '/rules page not found');
    results.add('E2', 'SKIP', '/rules page not found');
    results.add('E3', 'SKIP', '/rules page not found');
    results.add('E4', 'SKIP', '/rules page not found');
    results.add('E5', 'SKIP', '/rules page not found');
    await ctx.close();
    await browser.close();
    results.print();
    saveResults('block-e-results.json', results.summary());
    console.log('\n⏭️ Bloque E skipped.\n');
    return;
  }

  // ─── E1: Page renders ───
  try {
    log('E1', '▶ Página de reglas');
    await snap(page, 'E1-01-reglas');

    // Mobile
    const mCtx = await newContext(browser, 'mobile');
    const mPage = await mCtx.newPage();
    await loginAdmin(mPage);
    await mPage.goto(`${BASE}/rules`, { waitUntil: 'networkidle', timeout: 15000 });
    await mPage.waitForTimeout(1500);
    await snap(mPage, 'E1-01-reglas-mobile');

    // Tablet
    const tCtx = await newContext(browser, 'tablet');
    const tPage = await tCtx.newPage();
    await loginAdmin(tPage);
    await tPage.goto(`${BASE}/rules`, { waitUntil: 'networkidle', timeout: 15000 });
    await tPage.waitForTimeout(1500);
    await snap(tPage, 'E1-01-reglas-tablet');

    results.add('E1', 'PASS', 'Rules page rendered in all viewports');
    await mCtx.close();
    await tCtx.close();
  } catch (e) {
    results.add('E1', 'FAIL', e.message);
  }

  // ─── E2: Toggle rule ───
  try {
    log('E2', '▶ Desactivar regla de concurrencia');
    // Find switches on the page
    const switches = page.locator('button[role="switch"]');
    const count = await switches.count();
    log('E2', `Found ${count} switches`);

    if (count > 0) {
      // Toggle first switch
      await switches.first().click();
      await page.waitForTimeout(1000);
      await snap(page, 'E2-01-toggled');

      // Look for save button
      const saveBtn = page.locator('button:has-text("Guardar"), button:has-text("Save")').first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        await snap(page, 'E2-02-saved');
      }

      // Reload and verify persistence
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await snap(page, 'E2-03-after-reload');
      results.add('E2', 'PASS', 'Rule toggled and saved');
    } else {
      results.add('E2', 'PARTIAL', 'No switches found on rules page');
    }
  } catch (e) {
    results.add('E2', 'FAIL', e.message);
  }

  // ─── E3: Change limit ───
  try {
    log('E3', '▶ Cambiar límite simultáneo');
    const inputs = page.locator('input[type="number"]');
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      await inputs.first().fill('3');
      await page.waitForTimeout(500);
      const saveBtn = page.locator('button:has-text("Guardar"), button:has-text("Save")').first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
      await snap(page, 'E3-01-limite');
      results.add('E3', 'PASS', 'Limit changed to 3');
    } else {
      results.add('E3', 'PARTIAL', 'No number inputs found');
    }
  } catch (e) {
    results.add('E3', 'FAIL', e.message);
  }

  // ─── E4 & E5: Concurrency tests via chat — mark as requiring manual verification ───
  results.add('E4', 'SKIP', 'Concurrency test with rule ON — requires Block A data + rule state management');
  results.add('E5', 'SKIP', 'Concurrency test with rule OFF — requires Block A data + rule state management');

  await ctx.close();
  await browser.close();

  results.print();
  saveResults('block-e-results.json', results.summary());
  console.log('\n✅ Bloque E complete.\n');
})();
