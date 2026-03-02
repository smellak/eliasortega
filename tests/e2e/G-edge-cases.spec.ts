import { test, expect } from '@playwright/test';
import { sendChatMessage, snap, scrollChatToBottom } from './helpers';

const BASE = 'https://elias.centrohogarsanchez.es';

test.describe('Bloque G: Edge Cases y Stress', () => {

  test('G1: Mensaje vacío', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await snap(page, 'G1-01-antes');

    // Try sending empty message
    const sendBtn = page.locator('[data-testid="button-send"]');
    const isDisabled = await sendBtn.isDisabled().catch(() => false);
    await snap(page, 'G1-02-boton-estado');

    // Try clicking send with empty input
    if (!isDisabled) {
      await sendBtn.click();
      await page.waitForTimeout(2000);
    }

    // Verify no message was sent (count should remain 0)
    const assistantMsgs = await page.locator('[data-testid^="message-assistant-"]').count();
    await snap(page, 'G1-03-despues');

    await ctx.close();
  });

  test('G2: Mensaje muy largo (2000 chars)', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const longMsg = 'Hola, necesito hacer una reserva. ' + 'Traemos mucha mercancía variada. '.repeat(60);
    const r1 = await sendChatMessage(page, longMsg);
    await snap(page, 'G2-01-mensaje-largo');
    // Should either process or truncate, not crash
    expect(r1.length).toBeGreaterThan(0);

    await ctx.close();
  });

  test('G3: Conversación no relacionada', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, '¿Cuál es el mejor restaurante de Granada?');
    await snap(page, 'G3-01-off-topic');
    expect(r1.length).toBeGreaterThan(10);
    // Elías should redirect to booking topic

    await ctx.close();
  });

  test('G4: Múltiples citas mismo proveedor mismo día', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // First booking
    const r1 = await sendChatMessage(page, 'Hola, de Muebles Test, traemos 20 mesas por la mañana, 2 albaranes. El miércoles que viene. Email: test-g4@test.com');
    await snap(page, 'G4-01-primera-cita');
    expect(r1.length).toBeGreaterThan(10);

    const r2 = await sendChatMessage(page, 'Confirma por favor');
    await snap(page, 'G4-02-primera-confirmada');

    // Second booking same day
    const r3 = await sendChatMessage(page, 'Necesito otra descarga el mismo miércoles por la tarde, otros 20 bultos, 2 albaranes más');
    await snap(page, 'G4-03-segunda-cita');
    expect(r3.length).toBeGreaterThan(10);

    if (r3.toLowerCase().includes('confirma') || r3.toLowerCase().includes('disponible')) {
      const r4 = await sendChatMessage(page, 'Sí, confirma también');
      await snap(page, 'G4-04-segunda-confirmada');
    }

    await ctx.close();
  });

  test('G5: Cita en sábado (horario reducido)', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Hola, de Electrodomésticos Sur, necesito descargar el sábado. Traigo 15 electrodomésticos, 2 albaranes. Email: test-g5@test.com');
    await snap(page, 'G5-01-sabado');
    expect(r1.length).toBeGreaterThan(10);
    // Should offer Saturday slots (08:00-11:00 or 11:00-14:00)

    const r2 = await sendChatMessage(page, 'Confirma por favor');
    await snap(page, 'G5-02-confirmado');

    await ctx.close();
  });
});
