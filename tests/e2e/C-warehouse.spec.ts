import { test, expect } from '@playwright/test';
import { loginAdmin, snap, navigateTo } from './helpers';

test.describe.serial('Bloque C: Almacén — Check-in/Check-out', () => {

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('C1: Check-in de una cita pendiente', async ({ page }) => {
    await navigateTo(page, '/warehouse');
    await page.waitForTimeout(2000);
    await snap(page, 'C1-01-warehouse-inicio');

    // Navigate forward to find a day with pending appointments
    for (let i = 0; i < 14; i++) {
      const checkinBtn = page.locator('[data-testid^="button-checkin-"]').first();
      if (await checkinBtn.isVisible().catch(() => false)) {
        break;
      }
      const nextBtn = page.locator('[data-testid="button-calendar-next"]').or(page.locator('button:has-text("Siguiente")').first());
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    await snap(page, 'C1-02-dia-con-citas');

    // Try check-in
    const checkinBtn = page.locator('[data-testid^="button-checkin-"]').first();
    if (await checkinBtn.isVisible().catch(() => false)) {
      await checkinBtn.click();
      await page.waitForTimeout(2000);

      // Handle confirmation dialog if present
      const confirmBtn = page.locator('[data-testid="button-confirm-action"]');
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }

      await snap(page, 'C1-03-checkin-realizado');
    } else {
      // Try alternative button text
      const altBtn = page.locator('button:has-text("Ha llegado"), button:has-text("Check-in"), button:has-text("Registrar llegada")').first();
      if (await altBtn.isVisible().catch(() => false)) {
        await altBtn.click();
        await page.waitForTimeout(2000);
        await snap(page, 'C1-03-checkin-realizado');
      } else {
        await snap(page, 'C1-03-no-citas-pendientes');
      }
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'C1-04-mobile');

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1500);
    await snap(page, 'C1-05-tablet');
  });

  test('C2: Check-out de una cita en descarga', async ({ page }) => {
    await navigateTo(page, '/warehouse');
    await page.waitForTimeout(2000);

    // Navigate to find day with in-progress appointments
    for (let i = 0; i < 14; i++) {
      const checkoutBtn = page.locator('[data-testid^="button-checkout-"]').first();
      if (await checkoutBtn.isVisible().catch(() => false)) {
        break;
      }
      const nextBtn = page.locator('[data-testid="button-calendar-next"]').or(page.locator('button:has-text("Siguiente")').first());
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    await snap(page, 'C2-01-dia-con-descarga');

    const checkoutBtn = page.locator('[data-testid^="button-checkout-"]').first();
    if (await checkoutBtn.isVisible().catch(() => false)) {
      await checkoutBtn.click();
      await page.waitForTimeout(1500);

      // Try to fill units field if present
      const unitsInput = page.locator('input[type="number"]').first();
      if (await unitsInput.isVisible().catch(() => false)) {
        await unitsInput.fill('25');
      }

      // Confirm
      const confirmBtn = page.locator('[data-testid="button-confirm-action"]').or(page.locator('button:has-text("Confirmar")').first());
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }

      await snap(page, 'C2-02-checkout-realizado');
    } else {
      const altBtn = page.locator('button:has-text("Ha terminado"), button:has-text("Check-out"), button:has-text("Finalizar")').first();
      if (await altBtn.isVisible().catch(() => false)) {
        await altBtn.click();
        await page.waitForTimeout(2000);
        await snap(page, 'C2-02-checkout-realizado');
      } else {
        await snap(page, 'C2-02-no-descargas-activas');
      }
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'C2-03-mobile');

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1500);
    await snap(page, 'C2-04-tablet');
  });

  test('C3: Check-in + Check-out rápido', async ({ page }) => {
    await navigateTo(page, '/warehouse');
    await page.waitForTimeout(2000);

    // Navigate to find pending appointments
    for (let i = 0; i < 14; i++) {
      const checkinBtn = page.locator('[data-testid^="button-checkin-"]').first();
      if (await checkinBtn.isVisible().catch(() => false)) break;
      const nextBtn = page.locator('[data-testid="button-calendar-next"]').or(page.locator('button:has-text("Siguiente")').first());
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    const checkinBtn = page.locator('[data-testid^="button-checkin-"]').first();
    if (await checkinBtn.isVisible().catch(() => false)) {
      // Check-in
      await checkinBtn.click();
      await page.waitForTimeout(2000);
      const confirmBtn = page.locator('[data-testid="button-confirm-action"]');
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
      await snap(page, 'C3-01-checkin');

      // Wait a bit then check-out
      await page.waitForTimeout(2000);
      const checkoutBtn = page.locator('[data-testid^="button-checkout-"]').first();
      if (await checkoutBtn.isVisible().catch(() => false)) {
        await checkoutBtn.click();
        await page.waitForTimeout(1500);
        const unitsInput = page.locator('input[type="number"]').first();
        if (await unitsInput.isVisible().catch(() => false)) {
          await unitsInput.fill('45');
        }
        const confirmBtn2 = page.locator('[data-testid="button-confirm-action"]').or(page.locator('button:has-text("Confirmar")').first());
        if (await confirmBtn2.isVisible().catch(() => false)) {
          await confirmBtn2.click();
          await page.waitForTimeout(2000);
        }
        await snap(page, 'C3-02-checkout');
      }
    } else {
      await snap(page, 'C3-01-no-citas-pendientes');
    }

    // Mobile + Tablet
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'C3-03-mobile');

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1500);
    await snap(page, 'C3-04-tablet');
  });

  test('C4: Undo Check-in', async ({ page }) => {
    await navigateTo(page, '/warehouse');
    await page.waitForTimeout(2000);

    // Navigate to find an appointment with undo option
    for (let i = 0; i < 14; i++) {
      const undoBtn = page.locator('[data-testid^="button-undo-"]').first();
      const checkinBtn = page.locator('[data-testid^="button-checkin-"]').first();
      if (await undoBtn.isVisible().catch(() => false) || await checkinBtn.isVisible().catch(() => false)) {
        break;
      }
      const nextBtn = page.locator('[data-testid="button-calendar-next"]').or(page.locator('button:has-text("Siguiente")').first());
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    // First do check-in if needed
    const checkinBtn = page.locator('[data-testid^="button-checkin-"]').first();
    if (await checkinBtn.isVisible().catch(() => false)) {
      await checkinBtn.click();
      await page.waitForTimeout(2000);
      const confirmBtn = page.locator('[data-testid="button-confirm-action"]');
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
      await snap(page, 'C4-01-checkin-para-undo');
    }

    // Now undo
    const undoBtn = page.locator('[data-testid^="button-undo-"]').or(page.locator('button:has-text("Deshacer")').first());
    if (await undoBtn.isVisible().catch(() => false)) {
      await undoBtn.click();
      await page.waitForTimeout(1500);
      const confirmBtn = page.locator('[data-testid="button-confirm-action"]');
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
      await snap(page, 'C4-02-undo-realizado');
    } else {
      await snap(page, 'C4-02-no-undo-disponible');
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'C4-03-mobile');
  });

  test('C5: Verificar Precisión IA post check-outs', async ({ page }) => {
    await navigateTo(page, '/analytics');
    await page.waitForTimeout(2000);
    await snap(page, 'C5-01-precision-post-checkout');

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'C5-02-mobile');
  });
});
