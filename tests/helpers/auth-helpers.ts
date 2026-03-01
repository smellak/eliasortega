import { Page } from '@playwright/test';

const SCREENSHOTS_DIR = '/home/claudeuser/eliasortega/test-results/screenshots';

/**
 * Log into the admin panel.
 * Tries multiple selector strategies to find the login form.
 */
export async function adminLogin(page: Page, baseURL: string) {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(1500);

  // Check if we're on the login page (look for login form elements)
  const hasLoginForm = await page.locator('button:has-text("Iniciar sesión"), button[type="submit"], [data-testid="button-login"]').count();
  if (hasLoginForm === 0) {
    // No login form visible — might already be logged in
    // Check if sidebar is visible (sign of being logged in)
    const hasSidebar = await page.locator('[data-sidebar], aside, nav a[href="/appointments"]').count();
    if (hasSidebar > 0) return; // Already logged in
  }

  // Find and fill email input (try multiple selectors)
  const emailSelectors = [
    '[data-testid="input-email"]',
    '#email',
    'input[type="email"]',
    'input[placeholder*="email"]',
    'input[placeholder*="correo"]',
    'input[placeholder*="usuario"]',
  ];

  let emailFilled = false;
  for (const sel of emailSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      await page.locator(sel).first().fill('admin@admin.com');
      emailFilled = true;
      break;
    }
  }

  if (!emailFilled) {
    // Last resort: fill the first visible input
    const inputs = page.locator('input:visible');
    if (await inputs.count() >= 2) {
      await inputs.first().fill('admin@admin.com');
      emailFilled = true;
    }
  }

  // Find and fill password input
  const pwdSelectors = [
    '[data-testid="input-password"]',
    '#password',
    'input[type="password"]',
  ];

  for (const sel of pwdSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      await page.locator(sel).first().fill('admin123');
      break;
    }
  }

  // Click submit button
  const submitSelectors = [
    '[data-testid="button-login"]',
    'button:has-text("Iniciar sesión")',
    'button[type="submit"]',
  ];

  for (const sel of submitSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      await page.locator(sel).first().click();
      break;
    }
  }

  // Wait for dashboard to load
  await page.waitForTimeout(4000);

  // Verify login succeeded — if still on login page, wait more
  const stillOnLogin = await page.locator('button:has-text("Iniciar sesión")').count();
  if (stillOnLogin > 0) {
    await page.waitForTimeout(3000);
  }
}

/**
 * Take a screenshot with the standard path.
 */
export async function adminScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/${name}`,
    fullPage: true,
  });
}

/**
 * Navigate to an admin page (assumes already logged in).
 * Re-logins if redirected to the login page.
 */
export async function navigateTo(page: Page, baseURL: string, path: string) {
  await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2000);

  // If redirected to login, re-authenticate
  const hasLoginForm = await page.locator('button:has-text("Iniciar sesión"), [data-testid="button-login"]').count();
  if (hasLoginForm > 0 || page.url().includes('/login')) {
    await adminLogin(page, baseURL);
    await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
  }
}
