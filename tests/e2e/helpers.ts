import { Page, expect, BrowserContext } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';

export const BASE_URL = 'https://elias.centrohogarsanchez.es';
export const ADMIN_EMAIL = 'admin@admin.com';
export const ADMIN_PASS = 'admin123';
export const SCREENSHOT_DIR = 'test-results/screenshots/mega-test';
const AUTH_STATE_FILE = 'test-results/.auth-state.json';

try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
try { mkdirSync('test-results', { recursive: true }); } catch {}

/** Login as admin — uses stored JWT token via API call, then injects into localStorage */
export async function loginAdmin(page: Page) {
  // Try to get a token via API first (avoids rate limiting from browser clicks)
  let token = '';

  // Check if we have a cached token
  if (existsSync(AUTH_STATE_FILE)) {
    try {
      const state = JSON.parse(readFileSync(AUTH_STATE_FILE, 'utf-8'));
      if (state.token && Date.now() - state.ts < 3600000) { // 1hr validity
        token = state.token;
      }
    } catch {}
  }

  // If no cached token, get one via API (only once to avoid rate limiting)
  if (!token) {
    try {
      const resp = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        token = data.token || data.accessToken || '';
        const refreshTk = data.refreshToken || '';
        if (token) {
          writeFileSync(AUTH_STATE_FILE, JSON.stringify({ token, refreshToken: refreshTk, ts: Date.now() }));
        }
      }
    } catch {}
  }

  if (token) {
    // Navigate to any page to set the domain
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Inject tokens into localStorage (app uses 'authToken' and 'refreshToken')
    await page.evaluate(({ t, u }) => {
      localStorage.setItem('authToken', t);
      if (u) localStorage.setItem('currentUser', JSON.stringify(u));
    }, { t: token, u: { id: 'cmlzw59g20000rwb2lvues2gt', email: ADMIN_EMAIL, role: 'ADMIN' } });

    // Navigate to home with token set
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const sidebar = page.locator('[data-testid="link-sidebar-calendario"]');
    if (await sidebar.isVisible().catch(() => false)) {
      return;
    }
  }

  // Fallback: manual login via form
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if already logged in
  const sidebar = page.locator('[data-testid="link-sidebar-calendario"]');
  if (await sidebar.isVisible().catch(() => false)) {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    return;
  }

  // Fill and submit login form
  const emailInput = page.locator('[data-testid="input-email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(ADMIN_EMAIL);
  await page.waitForTimeout(200);
  await page.locator('[data-testid="input-password"]').fill(ADMIN_PASS);
  await page.waitForTimeout(200);
  await page.click('[data-testid="button-login"]');
  await page.waitForTimeout(5000);

  // Navigate to home
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Verify sidebar
  await expect(sidebar).toBeVisible({ timeout: 15000 });
}

/** Scroll chat container to bottom */
export async function scrollChatToBottom(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="chat-messages"]');
    if (el) el.scrollTop = el.scrollHeight;
    document.querySelectorAll('[class*="overflow-y"]')
      .forEach(c => { (c as HTMLElement).scrollTop = c.scrollHeight; });
  });
  await page.waitForTimeout(400);
}

/** Send a message in the public chat and wait for the AI response (SSE streaming) */
export async function sendChatMessage(page: Page, message: string, timeoutMs = 120000): Promise<string> {
  const beforeCount = await page.locator('[data-testid^="message-assistant-"]').count();

  const input = page.locator('[data-testid="input-message"]');
  await input.click();
  await input.fill(message);
  await page.waitForTimeout(300);
  await page.locator('[data-testid="button-send"]').click();

  // Wait for new assistant message element (max 60s)
  try {
    await page.waitForFunction(
      (bc: number) => document.querySelectorAll('[data-testid^="message-assistant-"]').length > bc,
      beforeCount,
      { timeout: 60000 }
    );
  } catch {
    // May still arrive
    await page.waitForTimeout(5000);
  }

  // Wait for streaming to finish (text stable + no stop button)
  const deadline = Date.now() + timeoutMs;
  let lastText = '';
  let stable = 0;

  while (Date.now() < deadline) {
    const streaming = await page.locator('[data-testid="button-stop-streaming"]')
      .isVisible().catch(() => false);

    const msgs = await page.locator('[data-testid^="message-assistant-"]').all();
    const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const text = last ? (await last.textContent().catch(() => '')) || '' : '';

    if (!streaming && text.length > 0 && text === lastText) {
      stable++;
      if (stable >= 3) break;
    } else {
      stable = 0;
    }
    lastText = text;
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(500);
  await scrollChatToBottom(page);
  return lastText.trim();
}

/** Send a message in the admin chat and wait for response */
export async function sendAdminChat(page: Page, message: string, timeoutMs = 120000): Promise<string> {
  // Count existing messages before sending
  const beforeText = await page.evaluate(() => document.body.innerText);

  const input = page.locator('[data-testid="admin-chat-input"]');
  await input.click();
  await input.fill(message);
  await page.waitForTimeout(300);

  await page.locator('[data-testid="admin-chat-send"]').click();

  // Wait for new content to appear (admin chat doesn't use data-testid on messages)
  const deadline = Date.now() + timeoutMs;
  let lastText = '';
  let stable = 0;

  await page.waitForTimeout(5000);

  while (Date.now() < deadline) {
    // Get all text content and find the last assistant-looking message
    const allText = await page.evaluate(() => {
      // Look for message bubbles by class patterns
      const bubbles = document.querySelectorAll('[class*="bg-card"], [class*="rounded"], p');
      const texts: string[] = [];
      bubbles.forEach(b => {
        const t = (b as HTMLElement).innerText?.trim();
        if (t && t.length > 10) texts.push(t);
      });
      return texts;
    });

    const currentText = allText.join('|||');

    if (currentText.length > 0 && currentText === lastText) {
      stable++;
      if (stable >= 3) break;
    } else {
      stable = 0;
    }
    lastText = currentText;
    await page.waitForTimeout(1500);
  }

  // Extract last distinct response (text that wasn't in beforeText)
  const afterText = await page.evaluate(() => document.body.innerText);
  const newContent = afterText.replace(beforeText, '').trim();

  // If we found new content, return the relevant part
  if (newContent.length > 10) {
    return newContent;
  }

  // Fallback: return the full page text difference
  return lastText.split('|||').pop() || '';
}

/** Take a descriptive screenshot */
export async function snap(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

/** Navigate to a page and wait for it to load */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
}

/** Get the count of assistant messages currently displayed */
export async function getAssistantMessageCount(page: Page): Promise<number> {
  return page.locator('[data-testid^="message-assistant-"]').count();
}
