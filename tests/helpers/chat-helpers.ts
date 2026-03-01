import { Page, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '/home/claudeuser/eliasortega/test-results/screenshots';
const AI_TIMEOUT = 90_000;

/**
 * Wait for the AI agent stream to complete.
 * The textarea becomes disabled while streaming and re-enabled when done.
 */
export async function waitForStreamComplete(page: Page, maxWaitMs = AI_TIMEOUT): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const disabled = await page.locator('[data-testid="input-message"]').isDisabled().catch(() => true);
    if (!disabled) {
      return true;
    }
    await page.waitForTimeout(1500);
  }
  return false;
}

/**
 * Get all agent message texts from the chat, cleaned of avatar initials and timestamps.
 */
export async function getAgentMessages(page: Page): Promise<string[]> {
  const agents = page.locator('.chat-bubble-agent');
  const count = await agents.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    let text = await agents.nth(i).textContent();
    if (text) {
      text = text.replace(/^EO/, '').replace(/\d{1,2}:\d{2}$/, '').trim();
      texts.push(text);
    }
  }
  return texts;
}

/**
 * Get the last agent message text.
 */
export async function getLastAgentMessage(page: Page): Promise<string> {
  const msgs = await getAgentMessages(page);
  return msgs.length > 0 ? msgs[msgs.length - 1] : '';
}

/**
 * Send a message in the public chat and wait for the AI agent response.
 * Takes a screenshot after the response arrives.
 */
export async function sendAndWait(
  page: Page,
  message: string,
  screenshotName?: string,
): Promise<{ done: boolean; response: string }> {
  const beforeMsgs = await getAgentMessages(page);
  const beforeCount = beforeMsgs.length;

  const textarea = page.locator('[data-testid="input-message"]');
  await textarea.fill(message);
  await page.waitForTimeout(300);
  await page.locator('[data-testid="button-send"]').click();

  const done = await waitForStreamComplete(page, AI_TIMEOUT);
  await page.waitForTimeout(1500);

  // Scroll to bottom to see latest message
  await page.evaluate(() => {
    const scrollEl = document.querySelector('.overflow-y-auto');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  });
  await page.waitForTimeout(500);

  if (screenshotName) {
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/${screenshotName}`,
      fullPage: true,
    });
  }

  const afterMsgs = await getAgentMessages(page);
  const response = afterMsgs.length > beforeCount
    ? afterMsgs[afterMsgs.length - 1]
    : (afterMsgs.length > 0 ? afterMsgs[afterMsgs.length - 1] : 'NO RESPONSE');

  return { done, response };
}

/**
 * Take a named screenshot.
 */
export async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/${name}`,
    fullPage: true,
  });
}

/**
 * Open a fresh chat session by navigating to /chat.
 * Uses a unique sessionId query param to ensure a new conversation.
 */
export async function openFreshChat(page: Page, baseURL: string) {
  const sessionId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto(`${baseURL}/chat?sessionId=${sessionId}`, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });
  await page.waitForTimeout(2000);
}
