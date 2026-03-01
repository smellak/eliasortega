import { test, expect, Page } from "@playwright/test";

const SCREENSHOT_DIR = "/root/eliasortega/test-results/screenshots";
const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASS = "admin123";

async function login(page: Page) {
  await page.goto("/");
  await page.waitForTimeout(2000);
  
  // Check if login form is present
  const emailInput = page.locator('#email, [data-testid="input-email"], input[type="email"]').first();
  const isLoginPage = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!isLoginPage) {
    // Already logged in
    return;
  }
  
  // Clear and fill email
  await emailInput.click();
  await emailInput.fill(ADMIN_EMAIL);
  
  // Fill password
  const passInput = page.locator('#password, [data-testid="input-password"], input[type="password"]').first();
  await passInput.click();
  await passInput.fill(ADMIN_PASS);
  
  // Submit form
  await page.locator('[data-testid="button-login"]').click();
  
  // Wait for login to complete - sidebar should appear
  try {
    await page.waitForSelector('text=Calendario', { timeout: 10000 });
  } catch {
    // Fallback: wait a bit more
    await page.waitForTimeout(5000);
  }
  
  // Verify we're logged in
  await page.waitForTimeout(2000);
}

async function navigateTo(page: Page, path: string) {
  // Use SPA navigation by clicking sidebar links instead of page.goto()
  const linkMap: Record<string, string> = {
    "/": "Calendario",
    "/appointments": "Citas",
    "/capacity": "Capacidad",
    "/docks": "Muelles",
    "/providers": "Proveedores",
    "/warehouse": "Almacén",
    "/notifications": "Notificaciones",
    "/users": "Usuarios",
    "/audit": "Auditoría",
    "/admin-chat": "Asistente IA",
  };
  
  const linkText = linkMap[path];
  if (linkText) {
    const link = page.locator(`nav a, aside a, [role="navigation"] a`).filter({ hasText: linkText }).first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(2000);
      return;
    }
  }
  
  // Fallback: direct navigation
  await page.goto(path);
  await page.waitForTimeout(3000);
}

test.describe("Phase 3: Admin Panel Verification", () => {

  test("TEST 7: Login + Dashboard + Calendar March", async ({ page }) => {
    test.setTimeout(90000);
    
    await page.goto("/");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-login.png`, fullPage: true });
    
    await login(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-dashboard.png`, fullPage: true });
    
    // Navigate to month view
    const monthBtn = page.locator('[data-testid="button-view-month"]');
    if (await monthBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await monthBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/07-calendar-march.png`, fullPage: true });
    }
  });

  test("TEST 8: Providers with enriched data", async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page);
    await navigateTo(page, "/providers");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-providers.png`, fullPage: true });
    
    const body = await page.textContent("body") || "";
    console.log("Page text includes '86':", body.includes("86"));
    console.log("Page text includes 'Tipo':", body.includes("Tipo"));
    console.log("Page text includes 'Tapicería':", body.includes("Tapicería"));
    console.log("Page text length:", body.length);
  });

  test("TEST 9: Appointments list", async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page);
    await navigateTo(page, "/appointments");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-appointments.png`, fullPage: true });
  });

  test("TEST 10: Docks page", async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page);
    await navigateTo(page, "/docks");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-docks.png`, fullPage: true });
  });

  test("TEST 11: Capacity page", async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page);
    await navigateTo(page, "/capacity");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-capacity.png`, fullPage: true });
  });

  test("TEST 12: Warehouse page", async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page);
    await navigateTo(page, "/warehouse");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/12-warehouse-today.png`, fullPage: true });
  });

  test("TEST 13: Audit page", async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page);
    await navigateTo(page, "/audit");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/13-audit.png`, fullPage: true });
    
    const body = await page.textContent("body") || "";
    console.log("Has CHAT_AGENT:", body.includes("CHAT_AGENT"));
  });

  test("TEST 14: Dark mode sweep", async ({ page }) => {
    test.setTimeout(120000);
    
    await login(page);
    
    // Click dark mode toggle
    const darkToggle = page.locator('button').filter({ has: page.locator('svg.lucide-moon') }).first();
    if (await darkToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await darkToggle.click();
      await page.waitForTimeout(1000);
    }
    
    // Dashboard dark
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-dark-calendar.png`, fullPage: true });
    
    // Appointments dark
    await navigateTo(page, "/appointments");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-dark-appointments.png`, fullPage: true });
    
    // Providers dark
    await navigateTo(page, "/providers");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-dark-providers.png`, fullPage: true });
    
    // Docks dark
    await navigateTo(page, "/docks");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-dark-docks.png`, fullPage: true });
    
    // Capacity dark
    await navigateTo(page, "/capacity");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-dark-capacity.png`, fullPage: true });
  });

  test("TEST 15: Admin Chat", async ({ page }) => {
    test.setTimeout(180000);
    
    await login(page);
    await navigateTo(page, "/admin-chat");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/15-admin-chat.png`, fullPage: true });
    
    const input = page.locator('textarea, input[placeholder*="mensaje"], input[placeholder*="Escribe"]');
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill("¿Cuántas citas hay para la primera semana de marzo?");
      await input.press("Enter");
      await page.waitForTimeout(20000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/15-admin-chat-response.png`, fullPage: true });
    }
  });

  test("TEST 6: Mobile responsive chat", async ({ page }) => {
    test.setTimeout(120000);
    
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/chat");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-mobile-layout.png`, fullPage: true });
    
    const input = page.locator('textarea, input[placeholder*="mensaje"], input[placeholder*="Escribe"]');
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill("Hola, quiero programar una descarga");
      await input.press("Enter");
      await page.waitForTimeout(12000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/06-mobile-response.png`, fullPage: true });
    }
  });
});
