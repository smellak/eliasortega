import { test, expect } from '@playwright/test';
import { loginAdmin, snap, navigateTo } from './helpers';

test.describe.serial('Bloque B: Panel Admin — Navegación y verificación', () => {

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('B1: Dashboard + Calendario vistas', async ({ page }) => {
    await navigateTo(page, '/');
    await snap(page, 'B1-01-dashboard-calendario');

    // Verificar que el calendario está visible
    const calendar = page.locator('[data-testid="slot-calendar-week"], [data-testid="slot-calendar-month"], [data-testid="slot-calendar-day"]');
    await expect(calendar.first()).toBeVisible({ timeout: 10000 });

    // Vista mensual
    const monthBtn = page.locator('[data-testid="button-view-month"]');
    if (await monthBtn.isVisible()) {
      await monthBtn.click();
      await page.waitForTimeout(1500);
      await snap(page, 'B1-02-vista-mensual');
    }

    // Vista semanal
    const weekBtn = page.locator('[data-testid="button-view-week"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await page.waitForTimeout(1500);
      await snap(page, 'B1-03-vista-semanal');
    }

    // Vista diaria
    const dayBtn = page.locator('[data-testid="button-view-day"]');
    if (await dayBtn.isVisible()) {
      await dayBtn.click();
      await page.waitForTimeout(1500);
      await snap(page, 'B1-04-vista-diaria');
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B1-05-mobile');
  });

  test('B2: Lista de citas', async ({ page }) => {
    await navigateTo(page, '/appointments');
    await page.waitForTimeout(2000);
    await snap(page, 'B2-01-lista-citas');

    // Verificar que hay citas (al menos los cards)
    const cards = page.locator('[data-testid^="card-appointment-"]');
    const count = await cards.count();
    // Click on first appointment if exists
    if (count > 0) {
      await cards.first().click();
      await page.waitForTimeout(1500);
      await snap(page, 'B2-02-detalle-cita');
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B2-03-mobile');
  });

  test('B3: Proveedores', async ({ page }) => {
    await navigateTo(page, '/providers');
    await page.waitForTimeout(2000);
    await snap(page, 'B3-01-proveedores');

    // Check provider rows exist
    const rows = page.locator('[data-testid^="row-provider-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Click edit on first provider
    if (count > 0) {
      const editBtn = page.locator('[data-testid^="button-edit-provider-"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForTimeout(1500);
        await snap(page, 'B3-02-editar-proveedor');
        // Close modal
        await page.keyboard.press('Escape');
      }
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B3-03-mobile');
  });

  test('B4: Calendario — Detalles de citas', async ({ page }) => {
    await navigateTo(page, '/');

    // Go to week view
    const weekBtn = page.locator('[data-testid="button-view-week"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await page.waitForTimeout(1500);
    }
    await snap(page, 'B4-01-calendario-semanal');

    // Check for appointment elements in calendar
    const appts = page.locator('[data-testid^="button-add-appt-"]');
    const slotCount = await appts.count();
    await snap(page, 'B4-02-slots');

    // Check legend button
    const legendBtn = page.locator('[data-testid="button-category-legend"]');
    if (await legendBtn.isVisible()) {
      await legendBtn.click();
      await page.waitForTimeout(1000);
      await snap(page, 'B4-03-leyenda');
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B4-04-mobile');
  });

  test('B5: Capacidad', async ({ page }) => {
    await navigateTo(page, '/capacity');
    await page.waitForTimeout(2000);
    await snap(page, 'B5-01-capacidad');

    // Verify slot templates tab
    const templatesTab = page.locator('[data-testid="tab-templates"]');
    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForTimeout(1500);
      await snap(page, 'B5-02-templates');
    }

    // Check capacity indicators
    const apptCount = page.locator('[data-testid="card-appointment-count"]');
    if (await apptCount.isVisible()) {
      await snap(page, 'B5-03-indicadores');
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B5-04-mobile');
  });

  test('B6: Muelles', async ({ page }) => {
    await navigateTo(page, '/docks');
    await page.waitForTimeout(2000);
    await snap(page, 'B6-01-muelles');

    // Verify docks are listed
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('M1');

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B6-02-mobile');
  });

  test('B7: Notificaciones', async ({ page }) => {
    await navigateTo(page, '/notifications');
    await page.waitForTimeout(2000);
    await snap(page, 'B7-01-notificaciones');

    // Check tabs
    const provTab = page.locator('[data-testid="tab-providers"]');
    if (await provTab.isVisible()) {
      await provTab.click();
      await page.waitForTimeout(1500);
      await snap(page, 'B7-02-tab-proveedores');
    }

    const teamTab = page.locator('[data-testid="tab-team"]');
    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForTimeout(1500);
      await snap(page, 'B7-03-tab-equipo');
    }

    const logTab = page.locator('[data-testid="tab-email-log"]');
    if (await logTab.isVisible()) {
      await logTab.click();
      await page.waitForTimeout(1500);
      await snap(page, 'B7-04-tab-registro');
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B7-05-mobile');
  });

  test('B8: Usuarios + Roles', async ({ page }) => {
    await navigateTo(page, '/users');
    await page.waitForTimeout(2000);
    await snap(page, 'B8-01-usuarios');

    // Verify roles are shown
    const pageContent = await page.textContent('body');
    const hasRoles = pageContent?.includes('ADMIN') || pageContent?.includes('admin');
    expect(hasRoles).toBeTruthy();

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B8-02-mobile');
  });

  test('B9: Auditoría', async ({ page }) => {
    await navigateTo(page, '/audit');
    await page.waitForTimeout(2000);
    await snap(page, 'B9-01-auditoria');

    // Check for audit entries
    const content = await page.textContent('body');
    const hasEntries = content?.includes('CREATE') || content?.includes('CHAT_AGENT') || content?.includes('USER');

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B9-02-mobile');
  });

  test('B10: Precisión IA (Analytics)', async ({ page }) => {
    await navigateTo(page, '/analytics');
    await page.waitForTimeout(2000);
    await snap(page, 'B10-01-precision-ia');

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'B10-02-mobile');
  });
});
