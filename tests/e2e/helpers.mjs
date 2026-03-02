import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

export const BASE = 'https://elias.centrohogarsanchez.es';
export const SCREENSHOT_DIR = '/root/eliasortega/test-results/screenshots/mega-test';
export const RESULTS_DIR = '/root/eliasortega/test-results/mega-test-results';

try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
try { mkdirSync(RESULTS_DIR, { recursive: true }); } catch {}

export const VIEWPORTS = {
  desktop: { width: 1400, height: 900 },
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
};

export async function launchBrowser() {
  return chromium.launch({ headless: true, args: ['--no-sandbox'] });
}

export async function newContext(browser, viewport = 'desktop') {
  const vp = VIEWPORTS[viewport] || VIEWPORTS.desktop;
  return browser.newContext({
    viewport: vp,
    isMobile: viewport === 'mobile',
    ignoreHTTPSErrors: true,
  });
}

export async function snap(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${name}`);
  return path;
}

export async function snapFull(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${name} (full)`);
  return path;
}

export async function loginAdmin(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.fill('[data-testid="input-email"]', 'admin@admin.com');
  await page.fill('[data-testid="input-password"]', 'admin123');
  await page.click('[data-testid="button-login"]');
  await page.waitForTimeout(4000);

  if (page.url().includes('/login')) {
    try {
      await page.click('[data-testid="button-login"]');
      await page.waitForTimeout(4000);
    } catch {}
  }
  const ok = !page.url().includes('/login');
  console.log(`  ${ok ? '✅' : '❌'} Login → ${page.url()}`);
  return ok;
}

export async function scrollChatToBottom(page) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="chat-messages"]');
    if (el) el.scrollTop = el.scrollHeight;
    document.querySelectorAll('[class*="overflow-y"]')
      .forEach(c => { c.scrollTop = c.scrollHeight; });
  });
  await page.waitForTimeout(400);
}

export async function sendChatMessage(page, message, timeoutMs = 120000) {
  const beforeCount = await page.locator('[data-testid^="message-assistant-"]').count();

  const input = page.locator('[data-testid="input-message"]');
  await input.click();
  await input.fill(message);
  await page.waitForTimeout(300);
  await page.locator('[data-testid="button-send"]').click();

  const short = message.length > 55 ? message.slice(0, 52) + '...' : message;
  console.log(`  → "${short}"`);

  // Phase 1: wait for new assistant message element (max 60s)
  try {
    await page.waitForFunction(
      (bc) => document.querySelectorAll('[data-testid^="message-assistant-"]').length > bc,
      beforeCount,
      { timeout: 60000 }
    );
  } catch {
    console.log('  ⚠️  No new assistant message in 60s');
    await page.waitForTimeout(5000);
  }

  // Phase 2: wait for streaming to finish (text stable + no stop button)
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

  const resp = lastText.trim();
  const shortR = resp.length > 95 ? resp.slice(0, 92) + '...' : resp;
  console.log(`  ← (${resp.length}ch) "${shortR}"`);
  return resp;
}

// Wait for server to be healthy (check with fetch)
export async function waitForServer(maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await fetch(`${BASE}/chat`, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        console.log(`  🟢 Server OK (${resp.status})`);
        return true;
      }
      console.log(`  🟡 Server responded ${resp.status}, waiting...`);
    } catch {
      console.log(`  🔴 Server unreachable, waiting...`);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  console.log('  ❌ Server did not recover in time');
  return false;
}

export function ts() {
  return new Date().toISOString().slice(11, 19);
}

export function log(id, msg) {
  console.log(`[${ts()}] [${id}] ${msg}`);
}

export function saveResults(filename, data) {
  const path = `${RESULTS_DIR}/${filename}`;
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`\n📄 Results → ${path}`);
}

export class TestResults {
  constructor(block) {
    this.block = block;
    this.results = [];
    this.t0 = Date.now();
  }
  add(testId, status, notes = '', screenshots = []) {
    this.results.push({ testId, status, notes, screenshots, ts: new Date().toISOString() });
  }
  summary() {
    const r = this.results;
    return {
      block: this.block,
      total: r.length,
      passed: r.filter(x => x.status === 'PASS').length,
      failed: r.filter(x => x.status === 'FAIL').length,
      partial: r.filter(x => x.status === 'PARTIAL').length,
      skipped: r.filter(x => x.status === 'SKIP').length,
      duration: `${((Date.now() - this.t0) / 1000).toFixed(0)}s`,
      results: r,
    };
  }
  print() {
    const s = this.summary();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${s.block}: ${s.passed}/${s.total} PASS, ${s.failed} FAIL, ${s.partial} PARTIAL, ${s.skipped} SKIP (${s.duration})`);
    for (const r of s.results) {
      const ico = { PASS: '✅', FAIL: '❌', PARTIAL: '⚠️', SKIP: '⏭️' }[r.status] || '?';
      console.log(`  ${ico} ${r.testId}: ${r.notes.slice(0, 100)}`);
    }
    console.log('='.repeat(60));
  }
}
