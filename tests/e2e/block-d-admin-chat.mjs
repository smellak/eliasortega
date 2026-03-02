/**
 * BLOQUE D: ASISTENTE IA ADMIN — Elías interno (8 tests)
 * Desktop + Mobile
 */
import {
  BASE, launchBrowser, newContext, snap, scrollChatToBottom,
  loginAdmin, log, saveResults, TestResults,
} from './helpers.mjs';

// Send message in admin chat and wait for response
async function sendAdminMsg(page, message, timeoutMs = 120000) {
  // Try both admin-chat page and floating assistant
  const inputSels = ['[data-testid="admin-chat-input"]', '[data-testid="floating-chat-input"]'];
  const sendSels  = ['[data-testid="admin-chat-send"]', '[data-testid="floating-chat-send"]'];

  let inputEl = null;
  for (const sel of inputSels) {
    const el = page.locator(sel);
    if (await el.isVisible().catch(() => false)) { inputEl = el; break; }
  }
  if (!inputEl) {
    console.log('  ⚠️ Admin chat input not found');
    return '[INPUT NOT FOUND]';
  }

  // Count messages before sending
  const beforeCount = await page.locator('[data-testid^="message-assistant-"]').count().catch(() => 0);

  await inputEl.click();
  await inputEl.fill(message);
  await page.waitForTimeout(300);

  for (const sel of sendSels) {
    const btn = page.locator(sel);
    if (await btn.isVisible().catch(() => false)) { await btn.click(); break; }
  }

  const short = message.length > 55 ? message.slice(0, 52) + '...' : message;
  console.log(`  → Admin: "${short}"`);

  // Wait for new response
  try {
    await page.waitForFunction(
      (bc) => document.querySelectorAll('[data-testid^="message-assistant-"]').length > bc,
      beforeCount,
      { timeout: 60000 }
    );
  } catch {
    await page.waitForTimeout(5000);
  }

  // Wait for streaming to finish
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
  const resp = lastText.trim();
  console.log(`  ← (${resp.length}ch) "${resp.slice(0, 95)}..."`);
  return resp;
}

// ── Test definitions ──────────────────────────────────────────────
const TESTS = [
  {
    id: 'D1', name: 'Resumen del día',
    msg: 'Dame un resumen de las citas de esta semana',
  },
  {
    id: 'D2', name: 'Consultar ocupación',
    msg: '¿Qué ocupación hay el lunes?',
  },
  {
    id: 'D3', name: 'Consultar proveedor',
    msg: '¿Qué sabes de Pedro Ortiz?',
  },
  {
    id: 'D4', name: 'Crear cita manual',
    msg: 'Crea una cita para TEST-Ikea el viernes a las 10, 50 muebles de mobiliario, email test-ikea@test.com',
  },
  {
    id: 'D5', name: 'Modificar cita',
    msg: 'Cambia la cita de Tapicería Jaén a las 10:00',
  },
  {
    id: 'D6', name: 'Cancelar cita',
    msg: 'Cancela la cita de CODECO',
  },
  {
    id: 'D7', name: 'Consultar muelles',
    msg: '¿Cuántos muelles tenemos activos?',
  },
  {
    id: 'D8', name: 'Consultar precisión',
    msg: '¿Cómo va la precisión de las estimaciones?',
  },
];

async function runAdminTest(browser, test, viewport) {
  const suffix = viewport === 'desktop' ? '' : `-${viewport}`;
  const label = `${test.id}${suffix}`;
  log(label, `▶ ${test.name} (${viewport})`);

  const ctx = await newContext(browser, viewport);
  const page = await ctx.newPage();
  const screenshots = [];

  try {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin-chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // If admin-chat page doesn't have the input, try floating assistant
    const hasAdminChat = await page.locator('[data-testid="admin-chat-input"]').isVisible().catch(() => false);
    if (!hasAdminChat) {
      // Try opening floating assistant
      const fab = page.locator('[data-testid="fab-assistant"]');
      if (await fab.isVisible().catch(() => false)) {
        await fab.click();
        await page.waitForTimeout(1000);
      }
    }

    const response = await sendAdminMsg(page, test.msg, 120000);

    // For D6 (cancel), confirm if asked
    if (test.id === 'D6' && (response.includes('confirmar') || response.includes('seguro') || response.includes('cancelar'))) {
      await sendAdminMsg(page, 'Sí, cancela', 60000);
      await page.waitForTimeout(1000);
    }

    // For D5 (modify), confirm if asked
    if (test.id === 'D5' && (response.includes('confirmar') || response.includes('cambiar'))) {
      await sendAdminMsg(page, 'Sí, confirma el cambio', 60000);
      await page.waitForTimeout(1000);
    }

    await scrollChatToBottom(page);
    screenshots.push(await snap(page, `${test.id}-01-respuesta${suffix}`));

    const status = response.length > 20 ? 'PASS' : 'PARTIAL';
    const notes = `Response: ${response.slice(0, 150)}`;

    await ctx.close();
    log(label, `${status === 'PASS' ? '✅' : '⚠️'} ${status}`);
    return { testId: label, status, notes, screenshots };
  } catch (e) {
    try { screenshots.push(await snap(page, `${test.id}-ERROR${suffix}`)); } catch {}
    await ctx.close();
    log(label, `❌ ${e.message}`);
    return { testId: label, status: 'FAIL', notes: e.message, screenshots };
  }
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  BLOQUE D: ASISTENTE IA ADMIN — 8 tests × 2 viewports');
  console.log('═'.repeat(60) + '\n');

  const browser = await launchBrowser();
  const results = new TestResults('Bloque D: Admin Chat');

  // Desktop
  console.log('\n── DESKTOP ──────────────────────────────────────────\n');
  for (const test of TESTS) {
    const r = await runAdminTest(browser, test, 'desktop');
    results.add(r.testId, r.status, r.notes, r.screenshots);
  }

  // Mobile
  console.log('\n── MOBILE ───────────────────────────────────────────\n');
  for (const test of TESTS) {
    const r = await runAdminTest(browser, test, 'mobile');
    results.add(r.testId, r.status, r.notes, r.screenshots);
  }

  await browser.close();
  results.print();
  saveResults('block-d-results.json', results.summary());
  console.log('\n✅ Bloque D complete.\n');
})();
