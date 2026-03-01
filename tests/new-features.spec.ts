import { test, expect, Page } from "@playwright/test";

const SCREENSHOT_DIR = "/root/eliasortega/test-results/screenshots";
const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASS = "admin123";

async function login(page: Page) {
  await page.goto("/");
  await page.waitForTimeout(2000);
  const emailInput = page.locator('[data-testid="input-email"]').first();
  const isLoginPage = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
  if (!isLoginPage) return;
  await emailInput.fill(ADMIN_EMAIL);
  const passInput = page.locator('[data-testid="input-password"]').first();
  await passInput.fill(ADMIN_PASS);
  await page.locator('button:has-text("Iniciar sesión")').click();
  await page.waitForSelector('text=Calendario', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function navigateTo(page: Page, path: string) {
  const linkMap: Record<string, string> = {
    "/providers": "Proveedores",
    "/warehouse": "Almacén",
    "/analytics": "Precisión IA",
  };
  const linkText = linkMap[path];
  if (linkText) {
    const link = page.locator('nav a, aside a, [role="navigation"] a').filter({ hasText: linkText }).first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(2000);
      return;
    }
  }
  await page.goto(path);
  await page.waitForTimeout(3000);
}

test.describe("New Features Verification", () => {

  test("Floating AI assistant widget", async ({ page }) => {
    test.setTimeout(60000);
    await login(page);
    await page.waitForTimeout(3000);

    const fab = page.locator('[data-testid="fab-assistant"]');
    await expect(fab).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/new-fab-visible.png`, fullPage: true });

    await fab.click();
    await page.waitForTimeout(1000);
    const panel = page.locator('[data-testid="floating-assistant-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/new-fab-panel-open.png`, fullPage: true });

    await page.locator('[data-testid="button-close-assistant"]').click();
    await page.waitForTimeout(500);
    await expect(panel).not.toBeVisible();
    await expect(fab).toBeVisible();
  });

  test("Provider edit modal opens on row click", async ({ page }) => {
    test.setTimeout(60000);
    await login(page);
    await navigateTo(page, "/providers");
    await page.waitForTimeout(3000);

    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(2000);

    // Modal should show "Editar proveedor" heading
    const modal = page.locator('[data-testid="provider-edit-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('h3:has-text("Información básica")')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/new-provider-modal.png`, fullPage: true });

    // Scroll to contacts section
    const contactsHeading = modal.locator('h3:has-text("Contactos")');
    await contactsHeading.scrollIntoViewIfNeeded();
    await expect(contactsHeading).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/new-provider-modal-contacts.png`, fullPage: true });
  });

  test("Tildes are correct across the app", async ({ page }) => {
    test.setTimeout(60000);
    await login(page);
    await page.waitForTimeout(3000);

    const body = await page.textContent("body") || "";
    expect(body).toContain("Almacén");
    expect(body).toContain("Precisión IA");

    await navigateTo(page, "/warehouse");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/new-tildes-warehouse.png`, fullPage: true });
  });
});
