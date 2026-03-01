import { test, expect } from "@playwright/test";
import { adminLogin, adminScreenshot, navigateTo } from "../helpers/auth-helpers";

const BASE = process.env.BASE_URL || "http://10.0.1.4:5000";

test.describe.serial("Sistema de Emails — Notificaciones", () => {

  test("Tab Proveedores — configuración y preview", async ({ page }) => {
    test.setTimeout(60_000);
    await adminLogin(page, BASE);
    await navigateTo(page, BASE, "/notifications");

    // Click Proveedores tab
    await page.locator('[data-testid="tab-providers"]').click();
    await page.waitForTimeout(1000);

    // Verify config elements
    await expect(page.locator('[data-testid="switch-confirmation-enabled"]')).toBeVisible();
    await expect(page.locator('[data-testid="switch-reminder-enabled"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-contact-phone"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-extra-text"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-preview-container"]')).toBeVisible();

    await adminScreenshot(page, "email-tab-proveedores.png");
  });

  test("Preview cambia entre tipos de email", async ({ page }) => {
    test.setTimeout(60_000);
    await adminLogin(page, BASE);
    await navigateTo(page, BASE, "/notifications");

    await page.locator('[data-testid="tab-providers"]').click();
    await page.waitForTimeout(1000);

    // Switch to reminder type
    await page.locator('[data-testid="select-preview-type"]').click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]:has-text("Recordatorio")').first().click();
    await page.waitForTimeout(1500);

    await adminScreenshot(page, "email-preview-recordatorio.png");
  });

  test("Enviar email de prueba de confirmación", async ({ page }) => {
    test.setTimeout(60_000);
    await adminLogin(page, BASE);
    await navigateTo(page, BASE, "/notifications");

    await page.locator('[data-testid="tab-providers"]').click();
    await page.waitForTimeout(500);

    // Fill test email address
    await page.fill('[data-testid="input-test-email"]', "s.mellak.shiito@gmail.com");
    await page.locator('[data-testid="button-send-test-email"]').click();

    // Wait for response
    await page.waitForTimeout(4000);

    await adminScreenshot(page, "email-test-enviado.png");
  });

  test("Tab Equipo — destinatarios del equipo", async ({ page }) => {
    test.setTimeout(60_000);
    await adminLogin(page, BASE);
    await navigateTo(page, BASE, "/notifications");

    await page.locator('[data-testid="tab-team"]').click();
    await page.waitForTimeout(1000);

    // Verify test recipient is visible
    await expect(page.locator('text=Sofiane (Test)')).toBeVisible();

    await adminScreenshot(page, "email-tab-equipo.png");
  });

  test("Tab Registro — historial de emails", async ({ page }) => {
    test.setTimeout(60_000);
    await adminLogin(page, BASE);
    await navigateTo(page, BASE, "/notifications");

    await page.locator('[data-testid="tab-email-log"]').click();
    await page.waitForTimeout(1000);

    // Verify filter elements
    await expect(page.locator('[data-testid="select-log-status-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="select-log-type-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-log-total"]')).toBeVisible();

    await adminScreenshot(page, "email-tab-registro.png");
  });
});
