/**
 * BLOQUE B: PANEL ADMIN — Navegación y verificación (10 tests)
 * Desktop (1400×900) + Mobile (375×812) + Tablet (768×1024)
 */
import {
  BASE, launchBrowser, newContext, snap, snapFull,
  loginAdmin, log, saveResults, TestResults,
} from './helpers.mjs';

const VIEWPORTS_LIST = ['desktop', 'mobile', 'tablet'];

// Helper: take screenshot in all 3 viewports
async function snapAll(pages, name) {
  const shots = [];
  for (const [vp, page] of Object.entries(pages)) {
    const suffix = vp === 'desktop' ? '' : `-${vp}`;
    shots.push(await snap(page, `${name}${suffix}`));
  }
  return shots;
}

// Helper: navigate all pages to a URL
async function gotoAll(pages, path) {
  for (const page of Object.values(pages)) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  }
  await Object.values(pages)[0].waitForTimeout(2000);
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  BLOQUE B: PANEL ADMIN — 10 tests × 3 viewports');
  console.log('═'.repeat(60) + '\n');

  const browser = await launchBrowser();
  const results = new TestResults('Bloque B: Panel Admin');

  // Create contexts and login for each viewport
  const pages = {};
  for (const vp of VIEWPORTS_LIST) {
    const ctx = await newContext(browser, vp);
    const page = await ctx.newPage();
    const ok = await loginAdmin(page);
    if (!ok) {
      log('B-SETUP', `Login failed for ${vp}`);
    }
    pages[vp] = page;
  }

  // ─── B1: Dashboard / Calendar ───
  try {
    log('B1', '▶ Dashboard + Calendar views');
    await gotoAll(pages, '/');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'B1-01-dashboard');

    // Month view
    for (const page of Object.values(pages)) {
      const btn = page.locator('[data-testid="button-view-month"]');
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }
    await pages.desktop.waitForTimeout(1500);
    await snapAll(pages, 'B1-02-mensual');

    // Week view
    for (const page of Object.values(pages)) {
      const btn = page.locator('[data-testid="button-view-week"]');
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }
    await pages.desktop.waitForTimeout(1500);
    await snapAll(pages, 'B1-03-semanal');

    // Day view
    for (const page of Object.values(pages)) {
      const btn = page.locator('[data-testid="button-view-day"]');
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }
    await pages.desktop.waitForTimeout(1500);
    await snapAll(pages, 'B1-04-diaria');

    results.add('B1', 'PASS', 'Dashboard + 3 calendar views captured');
  } catch (e) {
    results.add('B1', 'FAIL', e.message);
    log('B1', `❌ ${e.message}`);
  }

  // ─── B2: Appointments list ───
  try {
    log('B2', '▶ Lista de citas');
    await gotoAll(pages, '/appointments');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'B2-01-lista');

    // Try to click first appointment
    const card = pages.desktop.locator('[data-testid^="card-appointment-"]').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await pages.desktop.waitForTimeout(1500);
      await snap(pages.desktop, 'B2-02-detalle');
      await snap(pages.mobile, 'B2-02-detalle-mobile');
    }
    results.add('B2', 'PASS', 'Appointments list + detail captured');
  } catch (e) {
    results.add('B2', 'FAIL', e.message);
    log('B2', `❌ ${e.message}`);
  }

  // ─── B3: Providers ───
  try {
    log('B3', '▶ Proveedores');
    await gotoAll(pages, '/providers');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'B3-01-lista');

    // Try clicking edit on first provider
    const editBtn = pages.desktop.locator('[data-testid^="button-edit-"]').first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await pages.desktop.waitForTimeout(1500);
      await snap(pages.desktop, 'B3-02-modal');
      await snap(pages.mobile, 'B3-02-modal-mobile');
      // Close modal
      await pages.desktop.keyboard.press('Escape');
      await pages.desktop.waitForTimeout(500);
    }
    results.add('B3', 'PASS', 'Providers list + edit modal captured');
  } catch (e) {
    results.add('B3', 'FAIL', e.message);
    log('B3', `❌ ${e.message}`);
  }

  // ─── B4: Calendar details ───
  try {
    log('B4', '▶ Calendar — detalles de citas');
    await gotoAll(pages, '/');
    await pages.desktop.waitForTimeout(1000);

    // Week view
    for (const page of Object.values(pages)) {
      const btn = page.locator('[data-testid="button-view-week"]');
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }
    await pages.desktop.waitForTimeout(1500);
    await snapAll(pages, 'B4-01-semana-citas');

    // Try clicking an appointment on the calendar
    const appt = pages.desktop.locator('[class*="appointment"], [class*="event"], [data-testid^="card-appointment"]').first();
    if (await appt.isVisible().catch(() => false)) {
      await appt.click();
      await pages.desktop.waitForTimeout(1500);
      await snap(pages.desktop, 'B4-02-detalle-cita');
    }
    results.add('B4', 'PASS', 'Calendar week view + appointment detail captured');
  } catch (e) {
    results.add('B4', 'FAIL', e.message);
    log('B4', `❌ ${e.message}`);
  }

  // ─── B5: Capacity ───
  try {
    log('B5', '▶ Capacidad');
    await gotoAll(pages, '/capacity');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'B5-01-capacidad');
    results.add('B5', 'PASS', 'Capacity page captured');
  } catch (e) {
    results.add('B5', 'FAIL', e.message);
    log('B5', `❌ ${e.message}`);
  }

  // ─── B6: Docks ───
  try {
    log('B6', '▶ Muelles');
    await gotoAll(pages, '/docks');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'B6-01-muelles');
    results.add('B6', 'PASS', 'Docks page captured');
  } catch (e) {
    results.add('B6', 'FAIL', e.message);
    log('B6', `❌ ${e.message}`);
  }

  // ─── B7: Notifications ───
  try {
    log('B7', '▶ Notificaciones');
    await gotoAll(pages, '/notifications');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'B7-01-proveedores-tab');

    // Click Team tab
    for (const page of Object.values(pages)) {
      const tab = page.locator('[data-testid="tab-team"]');
      if (await tab.isVisible().catch(() => false)) await tab.click();
    }
    await pages.desktop.waitForTimeout(1500);
    await snapAll(pages, 'B7-03-equipo');

    // Click Email log tab
    for (const page of Object.values(pages)) {
      const tab = page.locator('[data-testid="tab-email-log"]');
      if (await tab.isVisible().catch(() => false)) await tab.click();
    }
    await pages.desktop.waitForTimeout(1500);
    await snapAll(pages, 'B7-04-registro');

    results.add('B7', 'PASS', 'Notifications tabs captured');
  } catch (e) {
    results.add('B7', 'FAIL', e.message);
    log('B7', `❌ ${e.message}`);
  }

  // ─── B8: Users ───
  try {
    log('B8', '▶ Usuarios');
    await gotoAll(pages, '/users');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'B8-01-usuarios');
    results.add('B8', 'PASS', 'Users page captured');
  } catch (e) {
    results.add('B8', 'FAIL', e.message);
    log('B8', `❌ ${e.message}`);
  }

  // ─── B9: Audit ───
  try {
    log('B9', '▶ Auditoría');
    await gotoAll(pages, '/audit');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'B9-01-auditoria');

    // Filter by CHAT_AGENT
    const select = pages.desktop.locator('[data-testid="select-actor-type"]');
    if (await select.isVisible().catch(() => false)) {
      await select.click();
      await pages.desktop.waitForTimeout(500);
      // Try selecting CHAT_AGENT option
      const opt = pages.desktop.locator('text=CHAT_AGENT').first();
      if (await opt.isVisible().catch(() => false)) {
        await opt.click();
        await pages.desktop.waitForTimeout(500);
      }
      const applyBtn = pages.desktop.locator('[data-testid="button-apply-filters"]');
      if (await applyBtn.isVisible().catch(() => false)) {
        await applyBtn.click();
        await pages.desktop.waitForTimeout(1500);
      }
      await snap(pages.desktop, 'B9-02-filtrado');
    }
    results.add('B9', 'PASS', 'Audit page + filter captured');
  } catch (e) {
    results.add('B9', 'FAIL', e.message);
    log('B9', `❌ ${e.message}`);
  }

  // ─── B10: Analytics ───
  try {
    log('B10', '▶ Precisión IA');
    await gotoAll(pages, '/analytics');
    await pages.desktop.waitForTimeout(2000);
    await snapAll(pages, 'B10-01-precision');
    results.add('B10', 'PASS', 'Analytics page captured');
  } catch (e) {
    results.add('B10', 'FAIL', e.message);
    log('B10', `❌ ${e.message}`);
  }

  // Cleanup
  for (const page of Object.values(pages)) {
    await page.context().close();
  }
  await browser.close();

  results.print();
  saveResults('block-b-results.json', results.summary());
  console.log('\n✅ Bloque B complete.\n');
})();
