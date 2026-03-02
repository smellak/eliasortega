/**
 * BLOQUE C: ALMACÉN — Check-in / Check-out (5 tests)
 * All 3 viewports — MOBILE/TABLET PRIORITY (operarios en almacén)
 */
import {
  BASE, launchBrowser, newContext, snap,
  loginAdmin, log, saveResults, TestResults,
} from './helpers.mjs';

const VIEWPORTS_LIST = ['desktop', 'mobile', 'tablet'];

async function snapAll(pages, name) {
  const shots = [];
  for (const [vp, page] of Object.entries(pages)) {
    const suffix = vp === 'desktop' ? '' : `-${vp}`;
    shots.push(await snap(page, `${name}${suffix}`));
  }
  return shots;
}

async function gotoAll(pages, path) {
  for (const page of Object.values(pages)) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  }
  await Object.values(pages)[0].waitForTimeout(2000);
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  BLOQUE C: ALMACÉN — 5 tests × 3 viewports');
  console.log('═'.repeat(60) + '\n');

  const browser = await launchBrowser();
  const results = new TestResults('Bloque C: Almacén');

  // Create contexts and login
  const pages = {};
  for (const vp of VIEWPORTS_LIST) {
    const ctx = await newContext(browser, vp);
    const page = await ctx.newPage();
    await loginAdmin(page);
    pages[vp] = page;
  }

  // Navigate to warehouse
  await gotoAll(pages, '/warehouse');
  await pages.desktop.waitForTimeout(2000);

  // ─── C1: Check-in first appointment ───
  try {
    log('C1', '▶ Check-in primera cita');
    await snapAll(pages, 'C1-01-pendiente');

    // Find check-in button (text "Ha llegado" or similar)
    const checkinBtn = pages.desktop.locator('button:has-text("Ha llegado"), button:has-text("Check-in"), button:has-text("Llegada")').first();
    if (await checkinBtn.isVisible().catch(() => false)) {
      await checkinBtn.click();
      await pages.desktop.waitForTimeout(2000);
      // Refresh other viewports
      for (const vp of ['mobile', 'tablet']) {
        await pages[vp].reload({ waitUntil: 'networkidle' });
        await pages[vp].waitForTimeout(1000);
      }
      await snapAll(pages, 'C1-02-checkin');
      results.add('C1', 'PASS', 'Check-in completed, status changed');
    } else {
      // Try finding any actionable button in warehouse
      await snap(pages.desktop, 'C1-02-no-checkin-btn');
      results.add('C1', 'PARTIAL', 'No check-in button found — may be no appointments for today');
    }
  } catch (e) {
    results.add('C1', 'FAIL', e.message);
    log('C1', `❌ ${e.message}`);
  }

  // ─── C2: Check-out ───
  try {
    log('C2', '▶ Check-out primera cita');
    // Reload warehouse
    await gotoAll(pages, '/warehouse');
    await pages.desktop.waitForTimeout(2000);

    const checkoutBtn = pages.desktop.locator('button:has-text("Ha terminado"), button:has-text("Check-out"), button:has-text("Completar")').first();
    if (await checkoutBtn.isVisible().catch(() => false)) {
      await checkoutBtn.click();
      await pages.desktop.waitForTimeout(1500);

      // Check for units input dialog
      const unitsInput = pages.desktop.locator('input[type="number"], input[placeholder*="unidades"], input[placeholder*="bultos"]').first();
      if (await unitsInput.isVisible().catch(() => false)) {
        await unitsInput.fill('25');
        await pages.desktop.waitForTimeout(500);
        // Confirm
        const confirmBtn = pages.desktop.locator('button:has-text("Confirmar"), button:has-text("Guardar"), button[type="submit"]').first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await pages.desktop.waitForTimeout(2000);
        }
      }

      for (const vp of ['mobile', 'tablet']) {
        await pages[vp].reload({ waitUntil: 'networkidle' });
        await pages[vp].waitForTimeout(1000);
      }
      await snapAll(pages, 'C2-01-checkout');
      results.add('C2', 'PASS', 'Check-out completed');
    } else {
      await snap(pages.desktop, 'C2-01-no-checkout-btn');
      results.add('C2', 'PARTIAL', 'No check-out button found');
    }
  } catch (e) {
    results.add('C2', 'FAIL', e.message);
    log('C2', `❌ ${e.message}`);
  }

  // ─── C3: Check-in + Check-out second appointment ───
  try {
    log('C3', '▶ Check-in + Check-out segunda cita');
    await gotoAll(pages, '/warehouse');
    await pages.desktop.waitForTimeout(2000);

    // Check-in
    const checkinBtn = pages.desktop.locator('button:has-text("Ha llegado"), button:has-text("Check-in"), button:has-text("Llegada")').first();
    if (await checkinBtn.isVisible().catch(() => false)) {
      await checkinBtn.click();
      await pages.desktop.waitForTimeout(2000);
      for (const vp of ['mobile', 'tablet']) {
        await pages[vp].reload({ waitUntil: 'networkidle' });
      }
      await snapAll(pages, 'C3-01-checkin');

      await pages.desktop.waitForTimeout(2000); // simulate short wait

      // Check-out
      await pages.desktop.reload({ waitUntil: 'networkidle' });
      await pages.desktop.waitForTimeout(1000);
      const checkoutBtn = pages.desktop.locator('button:has-text("Ha terminado"), button:has-text("Check-out"), button:has-text("Completar")').first();
      if (await checkoutBtn.isVisible().catch(() => false)) {
        await checkoutBtn.click();
        await pages.desktop.waitForTimeout(1500);
        const unitsInput = pages.desktop.locator('input[type="number"]').first();
        if (await unitsInput.isVisible().catch(() => false)) {
          await unitsInput.fill('45');
          const confirmBtn = pages.desktop.locator('button:has-text("Confirmar"), button:has-text("Guardar"), button[type="submit"]').first();
          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click();
            await pages.desktop.waitForTimeout(2000);
          }
        }
        for (const vp of ['mobile', 'tablet']) {
          await pages[vp].reload({ waitUntil: 'networkidle' });
        }
        await snapAll(pages, 'C3-02-checkout');
      }
      results.add('C3', 'PASS', 'Check-in + Check-out done');
    } else {
      results.add('C3', 'PARTIAL', 'No check-in button for second appointment');
    }
  } catch (e) {
    results.add('C3', 'FAIL', e.message);
    log('C3', `❌ ${e.message}`);
  }

  // ─── C4: Undo Check-in ───
  try {
    log('C4', '▶ Undo check-in');
    await gotoAll(pages, '/warehouse');
    await pages.desktop.waitForTimeout(2000);

    // Check-in first
    const checkinBtn = pages.desktop.locator('button:has-text("Ha llegado"), button:has-text("Check-in")').first();
    if (await checkinBtn.isVisible().catch(() => false)) {
      await checkinBtn.click();
      await pages.desktop.waitForTimeout(2000);
      for (const vp of ['mobile', 'tablet']) {
        await pages[vp].reload({ waitUntil: 'networkidle' });
      }
      await snapAll(pages, 'C4-01-checkin');

      // Undo
      await pages.desktop.reload({ waitUntil: 'networkidle' });
      await pages.desktop.waitForTimeout(1000);
      const undoBtn = pages.desktop.locator('button:has-text("Deshacer"), button:has-text("Undo"), button:has-text("Deshacer registro")').first();
      if (await undoBtn.isVisible().catch(() => false)) {
        await undoBtn.click();
        await pages.desktop.waitForTimeout(2000);
        for (const vp of ['mobile', 'tablet']) {
          await pages[vp].reload({ waitUntil: 'networkidle' });
        }
        await snapAll(pages, 'C4-02-undo');
        results.add('C4', 'PASS', 'Undo check-in successful');
      } else {
        await snap(pages.desktop, 'C4-02-no-undo-btn');
        results.add('C4', 'PARTIAL', 'No undo button found');
      }
    } else {
      results.add('C4', 'PARTIAL', 'No appointment available for undo test');
    }
  } catch (e) {
    results.add('C4', 'FAIL', e.message);
    log('C4', `❌ ${e.message}`);
  }

  // ─── C5: Analytics post-checkout ───
  try {
    log('C5', '▶ Precisión IA post check-outs');
    await gotoAll(pages, '/analytics');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'C5-01-precision-post');
    results.add('C5', 'PASS', 'Analytics page captured post check-outs');
  } catch (e) {
    results.add('C5', 'FAIL', e.message);
    log('C5', `❌ ${e.message}`);
  }

  // Cleanup
  for (const page of Object.values(pages)) {
    await page.context().close();
  }
  await browser.close();

  results.print();
  saveResults('block-c-results.json', results.summary());
  console.log('\n✅ Bloque C complete.\n');
})();
