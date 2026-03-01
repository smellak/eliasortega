import { test, expect, Page } from "@playwright/test";

const SCREENSHOT_DIR = "/root/eliasortega/test-results/screenshots";
const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASS = "admin123";

async function login(page: Page) {
  await page.goto("/");
  await page.waitForTimeout(2000);
  
  // Check if already on dashboard
  const hasCalendar = await page.locator("text=Calendario").isVisible().catch(() => false);
  if (hasCalendar) return;
  
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

test.describe("Phase 1: Visual Analysis - All Pages", () => {
  test("Login page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/login-desktop.png`, fullPage: true });
  });

  test("Dashboard / Calendar", async ({ page }) => {
    await login(page);
    await page.goto("/");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/calendar-desktop.png`, fullPage: true });
  });

  test("Appointments page", async ({ page }) => {
    await login(page);
    await page.goto("/appointments");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/appointments-desktop.png`, fullPage: true });
  });

  test("Capacity page", async ({ page }) => {
    await login(page);
    await page.goto("/capacity");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/capacity-desktop.png`, fullPage: true });
  });

  test("Docks page", async ({ page }) => {
    await login(page);
    await page.goto("/docks");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/docks-desktop.png`, fullPage: true });
  });

  test("Providers page", async ({ page }) => {
    await login(page);
    await page.goto("/providers");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/providers-desktop.png`, fullPage: true });
  });

  test("Warehouse page", async ({ page }) => {
    await login(page);
    await page.goto("/warehouse");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/warehouse-desktop.png`, fullPage: true });
  });

  test("Audit page", async ({ page }) => {
    await login(page);
    await page.goto("/audit");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/audit-desktop.png`, fullPage: true });
  });

  test("Notifications page", async ({ page }) => {
    await login(page);
    await page.goto("/notifications");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/notifications-desktop.png`, fullPage: true });
  });

  test("Users page", async ({ page }) => {
    await login(page);
    await page.goto("/users");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/users-desktop.png`, fullPage: true });
  });

  test("Admin Chat page", async ({ page }) => {
    await login(page);
    await page.goto("/admin-chat");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/admin-chat-desktop.png`, fullPage: true });
  });

  test("Public Chat page", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/chat-desktop.png`, fullPage: true });
  });
});
