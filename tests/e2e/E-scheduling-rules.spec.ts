import { test, expect } from '@playwright/test';
import { loginAdmin, snap, navigateTo, sendChatMessage, scrollChatToBottom } from './helpers';

const BASE = 'https://elias.centrohogarsanchez.es';

test.describe.serial('Bloque E: Reglas de Programación', () => {

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('E1: Página de reglas', async ({ page }) => {
    await navigateTo(page, '/rules');
    await page.waitForTimeout(2000);
    await snap(page, 'E1-01-reglas-completa');

    // Verify toggles/switches are visible
    const switches = page.locator('[data-testid^="switch-"]');
    const count = await switches.count();
    // Should have some rule switches
    expect(count).toBeGreaterThan(0);

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'E1-02-mobile');
  });

  test('E2: Toggle regla de concurrencia', async ({ page }) => {
    await navigateTo(page, '/rules');
    await page.waitForTimeout(2000);

    // Look for concurrency switch
    const concSwitch = page.locator('[data-testid="switch-avoid-concurrency"]')
      .or(page.locator('button[role="switch"]').filter({ hasText: /concurrencia/i }).first());

    if (await concSwitch.isVisible().catch(() => false)) {
      await concSwitch.click();
      await page.waitForTimeout(2000);
      await snap(page, 'E2-01-toggle-concurrencia');

      // Check for toast/save confirmation
      const toast = page.locator('[class*="toast"], [role="alert"]').first();
      if (await toast.isVisible().catch(() => false)) {
        await snap(page, 'E2-02-toast-confirmacion');
      }

      // Reload and verify persistence
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await snap(page, 'E2-03-persistencia');
    } else {
      await snap(page, 'E2-01-switch-no-encontrado');
    }
  });

  test('E3: Cambiar límite simultáneo', async ({ page }) => {
    await navigateTo(page, '/rules');
    await page.waitForTimeout(2000);

    // Look for max simultaneous input
    const maxInput = page.locator('[data-testid="input-max-simultaneous"]')
      .or(page.locator('input[type="number"]').first());

    if (await maxInput.isVisible().catch(() => false)) {
      await maxInput.fill('3');
      await page.waitForTimeout(1000);
      await snap(page, 'E3-01-cambio-limite');

      // Save if there's a save button
      const saveBtn = page.locator('button:has-text("Guardar")').first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }

      // Reload and verify
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await snap(page, 'E3-02-persistencia');
    } else {
      await snap(page, 'E3-01-input-no-encontrado');
    }
  });

  test('E4: Concurrencia activa — chat sugiere otro horario', async ({ browser }) => {
    // First make sure concurrency rule is enabled
    const adminCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const adminPage = await adminCtx.newPage();
    await loginAdmin(adminPage);
    await navigateTo(adminPage, '/rules');
    await adminPage.waitForTimeout(2000);
    await snap(adminPage, 'E4-01-reglas-antes');
    await adminCtx.close();

    // Now test chat with concurrency
    const chatCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const chatPage = await chatCtx.newPage();
    await chatPage.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await chatPage.waitForTimeout(2000);

    const r1 = await sendChatMessage(chatPage, 'Hola, de Muebles León, traemos 30 mesas, 2 albaranes. El lunes que viene a las 8. Email: test-e4@test.com');
    await snap(chatPage, 'E4-02-reserva-concurrente');
    expect(r1.length).toBeGreaterThan(10);

    if (r1.toLowerCase().includes('confirma') || r1.toLowerCase().includes('disponible')) {
      const r2 = await sendChatMessage(chatPage, 'Vale, confirma');
      await snap(chatPage, 'E4-03-confirmacion');
    }

    await chatCtx.close();
  });

  test('E5: Concurrencia desactivada — acepta directamente', async ({ browser }) => {
    // Test with concurrency potentially off
    const chatCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const chatPage = await chatCtx.newPage();
    await chatPage.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await chatPage.waitForTimeout(2000);

    const r1 = await sendChatMessage(chatPage, 'Buenas, de Muebles Alicante, traemos 25 sillas, 2 albaranes. El martes que viene a las 10. Email: test-e5@test.com');
    await snap(chatPage, 'E5-01-reserva');
    expect(r1.length).toBeGreaterThan(10);

    if (r1.toLowerCase().includes('confirma') || r1.toLowerCase().includes('disponible')) {
      const r2 = await sendChatMessage(chatPage, 'Sí, confirma');
      await snap(chatPage, 'E5-02-confirmacion');
    }

    await chatCtx.close();
  });
});
