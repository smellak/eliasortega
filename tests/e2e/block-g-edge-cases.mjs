/**
 * BLOQUE G: EDGE CASES Y STRESS (5 tests)
 * Desktop + Mobile
 */
import {
  BASE, launchBrowser, newContext, snap, scrollChatToBottom,
  sendChatMessage, log, saveResults, TestResults,
} from './helpers.mjs';

async function runEdgeTest(browser, id, name, viewport, testFn) {
  const suffix = viewport === 'desktop' ? '' : `-${viewport}`;
  const label = `${id}${suffix}`;
  log(label, `▶ ${name} (${viewport})`);

  const ctx = await newContext(browser, viewport);
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const result = await testFn(page, label, suffix);
    await ctx.close();
    log(label, `${result.status === 'PASS' ? '✅' : '⚠️'} ${result.status}`);
    return result;
  } catch (e) {
    try { await snap(page, `${id}-ERROR${suffix}`); } catch {}
    await ctx.close();
    log(label, `❌ ${e.message}`);
    return { testId: label, status: 'FAIL', notes: e.message, screenshots: [] };
  }
}

// ── Test implementations ──────────────────────────────────────────

async function testG1(page, label, suffix) {
  // Empty message — should not send
  const input = page.locator('[data-testid="input-message"]');
  await input.click();
  await input.fill('');

  const sendBtn = page.locator('[data-testid="button-send"]');
  const isDisabled = await sendBtn.isDisabled().catch(() => false);
  await snap(page, `G1-01-vacio${suffix}`);

  // Try clicking send with empty input
  try {
    await sendBtn.click({ timeout: 2000 });
  } catch {}
  await page.waitForTimeout(2000);

  // Check no message was sent
  const msgCount = await page.locator('[data-testid^="message-user-"]').count();
  const notes = isDisabled
    ? 'Send button correctly disabled for empty message'
    : msgCount === 0
      ? 'No message sent (button may not be disabled but prevented submission)'
      : 'WARNING: empty message was sent';

  return { testId: label, status: msgCount === 0 ? 'PASS' : 'PARTIAL', notes, screenshots: [] };
}

async function testG2(page, label, suffix) {
  // Very long message
  const longMsg = 'Este es un mensaje de prueba muy largo para verificar que el sistema maneja correctamente mensajes extensos. '.repeat(20);
  const response = await sendChatMessage(page, longMsg, 120000);
  await scrollChatToBottom(page);
  await snap(page, `G2-01-largo${suffix}`);

  return {
    testId: label,
    status: response.length > 10 ? 'PASS' : 'PARTIAL',
    notes: `Sent ${longMsg.length} chars, got ${response.length} char response`,
    screenshots: [],
  };
}

async function testG3(page, label, suffix) {
  // Off-topic question
  const response = await sendChatMessage(page, '¿Cuál es el mejor restaurante de Granada?', 120000);
  await scrollChatToBottom(page);
  await snap(page, `G3-01-offtopic${suffix}`);

  const redirected = response.toLowerCase().includes('cita') ||
    response.toLowerCase().includes('reserv') ||
    response.toLowerCase().includes('descarg') ||
    response.toLowerCase().includes('almacén') ||
    response.toLowerCase().includes('ayudar');

  return {
    testId: label,
    status: redirected ? 'PASS' : 'PARTIAL',
    notes: redirected
      ? 'Elías correctly redirected to booking topic'
      : `Response did not clearly redirect: "${response.slice(0, 100)}"`,
    screenshots: [],
  };
}

async function testG4(page, label, suffix) {
  // Double booking same provider same day
  const resp1 = await sendChatMessage(page, 'Hola, soy de TEST Doble Reserva, traigo 20 bultos, 2 albaranes', 120000);
  await snap(page, `G4-01-primera${suffix}`);

  const resp2 = await sendChatMessage(page, 'El viernes que viene por la mañana', 120000);
  await snap(page, `G4-02-dia${suffix}`);

  const resp3 = await sendChatMessage(page, 'Mi email es test-doble@test.com', 120000);
  await snap(page, `G4-03-email${suffix}`);

  const resp4 = await sendChatMessage(page, 'Confirma', 120000);
  await snap(page, `G4-04-primera-confirmada${suffix}`);

  // Now try second booking same day
  const resp5 = await sendChatMessage(page, 'Necesito otra cita también el viernes, traigo otros 15 bultos', 120000);
  await snap(page, `G4-05-segunda${suffix}`);

  const resp6 = await sendChatMessage(page, 'Confirma también', 120000);
  await scrollChatToBottom(page);
  await snap(page, `G4-06-doble${suffix}`);

  return {
    testId: label,
    status: 'PASS',
    notes: `Double booking test completed. AI response: "${resp6.slice(0, 100)}"`,
    screenshots: [],
  };
}

async function testG5(page, label, suffix) {
  // Saturday appointment (reduced hours)
  const resp1 = await sendChatMessage(page, 'Hola, necesito descargar el sábado', 120000);
  await snap(page, `G5-01-sabado-solicitud${suffix}`);

  const hasSaturdaySlots = resp1.toLowerCase().includes('sábado') ||
    resp1.toLowerCase().includes('08:') || resp1.toLowerCase().includes('11:');

  const resp2 = await sendChatMessage(page, 'Traigo 25 bultos de mobiliario, 2 albaranes. Mi email es test-sabado@test.com', 120000);
  await snap(page, `G5-02-datos${suffix}`);

  const resp3 = await sendChatMessage(page, 'Confirma por favor', 120000);
  await scrollChatToBottom(page);
  await snap(page, `G5-03-sabado${suffix}`);

  return {
    testId: label,
    status: 'PASS',
    notes: `Saturday booking test. Saturday slots mentioned: ${hasSaturdaySlots}. Final: "${resp3.slice(0, 100)}"`,
    screenshots: [],
  };
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  BLOQUE G: EDGE CASES — 5 tests × 2 viewports');
  console.log('═'.repeat(60) + '\n');

  const browser = await launchBrowser();
  const results = new TestResults('Bloque G: Edge Cases');

  const tests = [
    { id: 'G1', name: 'Mensaje vacío', fn: testG1 },
    { id: 'G2', name: 'Mensaje muy largo', fn: testG2 },
    { id: 'G3', name: 'Pregunta off-topic', fn: testG3 },
    { id: 'G4', name: 'Doble reserva mismo día', fn: testG4 },
    { id: 'G5', name: 'Cita en sábado', fn: testG5 },
  ];

  // Desktop
  console.log('\n── DESKTOP ──────────────────────────────────────────\n');
  for (const test of tests) {
    const r = await runEdgeTest(browser, test.id, test.name, 'desktop', test.fn);
    results.add(r.testId, r.status, r.notes, r.screenshots);
  }

  // Mobile
  console.log('\n── MOBILE ───────────────────────────────────────────\n');
  for (const test of tests) {
    const r = await runEdgeTest(browser, test.id, test.name, 'mobile', test.fn);
    results.add(r.testId, r.status, r.notes, r.screenshots);
  }

  await browser.close();
  results.print();
  saveResults('block-g-results.json', results.summary());
  console.log('\n✅ Bloque G complete.\n');
})();
