import { test, expect } from '@playwright/test';
import { sendChatMessage, snap, scrollChatToBottom } from './helpers';

const BASE = 'https://elias.centrohogarsanchez.es';

test.describe.serial('Bloque A: Chat Público — Proveedores reservando citas', () => {
  // Each test uses its own chat session (new page context)

  test('A1: Tapicería Jaén — flujo completo', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await snap(page, 'A1-01-chat-inicio');

    // Step 1: Presentación
    const r1 = await sendChatMessage(page, 'Hola buenas, soy José Antonio de Tapicería Jaén');
    await snap(page, 'A1-02-reconocimiento');
    expect(r1.length).toBeGreaterThan(10);

    // Step 2: Mercancía
    const r2 = await sendChatMessage(page, 'Traigo 20 sofás y 5 sillones, unos 25 bultos en total');
    await snap(page, 'A1-03-mercancia');
    expect(r2.length).toBeGreaterThan(10);

    // Step 3: Albaranes
    const r3 = await sendChatMessage(page, 'Tengo 2 albaranes');
    await snap(page, 'A1-04-albaranes');
    expect(r3.length).toBeGreaterThan(10);

    // Step 4: Fecha
    const r4 = await sendChatMessage(page, 'El lunes que viene, primera hora');
    await snap(page, 'A1-05-disponibilidad');
    expect(r4.length).toBeGreaterThan(10);

    // Step 5: Confirmar
    const r5 = await sendChatMessage(page, 'Vale, confirma');
    await snap(page, 'A1-06-confirmacion');
    expect(r5.length).toBeGreaterThan(10);

    // Step 6: Email
    const r6 = await sendChatMessage(page, 'Mi email es test-jaen@test.com');
    await snap(page, 'A1-07-email-final');

    // Mobile check
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A1-08-mobile-final');

    await ctx.close();
  });

  test('A2: Mengualba — agencia electro Delonghi', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Buenas, soy Carmen de Mengualba, traemos mercancía de Delonghi');
    await snap(page, 'A2-01-reconocimiento');
    expect(r1.length).toBeGreaterThan(10);

    const r2 = await sendChatMessage(page, '45 bultos de electrodomésticos, 3 albaranes');
    await snap(page, 'A2-02-mercancia');
    expect(r2.length).toBeGreaterThan(10);

    const r3 = await sendChatMessage(page, 'El miércoles de esta semana si hay hueco');
    await snap(page, 'A2-03-dia');
    expect(r3.length).toBeGreaterThan(10);

    const r4 = await sendChatMessage(page, 'A las 10 si puede ser');
    await snap(page, 'A2-04-hora');
    expect(r4.length).toBeGreaterThan(10);

    const r5 = await sendChatMessage(page, 'Mi email es test-mengualba@test.com');
    await snap(page, 'A2-05-email');

    const r6 = await sendChatMessage(page, 'Vale, confirma por favor');
    await snap(page, 'A2-06-confirmado');

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A2-07-mobile');

    await ctx.close();
  });

  test('A3: Transportes Mediterráneo — proveedor nuevo', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Hola, somos Transportes Mediterráneo, es la primera vez que llamamos');
    await snap(page, 'A3-01-presentacion');
    expect(r1.length).toBeGreaterThan(10);

    const r2 = await sendChatMessage(page, 'Traemos 30 muebles de cocina');
    await snap(page, 'A3-02-mercancia');
    expect(r2.length).toBeGreaterThan(10);

    const r3 = await sendChatMessage(page, 'No sé cuántos albaranes, no lo tengo a mano');
    await snap(page, 'A3-03-albaranes');
    expect(r3.length).toBeGreaterThan(10);

    const r4 = await sendChatMessage(page, 'El jueves de la semana que viene');
    await snap(page, 'A3-04-dia');
    expect(r4.length).toBeGreaterThan(10);

    const r5 = await sendChatMessage(page, 'Mi email es test-mediterraneo@test.com');
    await snap(page, 'A3-05-email');

    const r6 = await sendChatMessage(page, 'Sí, perfecto, confirma');
    await snap(page, 'A3-06-confirmado');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A3-07-mobile');

    await ctx.close();
  });

  test('A4: Pedro Ortiz — tráiler completo', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Soy de Pedro Ortiz, tráiler completo, 180 bultos de tapicería');
    await snap(page, 'A4-01-reconocimiento');
    expect(r1.length).toBeGreaterThan(10);

    const r2 = await sendChatMessage(page, 'Tengo 6 albaranes');
    await snap(page, 'A4-02-albaranes');

    const r3 = await sendChatMessage(page, 'Viernes primera hora si hay sitio');
    await snap(page, 'A4-03-disponibilidad');
    expect(r3.length).toBeGreaterThan(10);

    const r4 = await sendChatMessage(page, 'Mi email es test-pedroortiz@test.com');
    await snap(page, 'A4-04-email');

    const r5 = await sendChatMessage(page, 'Sí, confirma');
    await snap(page, 'A4-05-confirmado');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A4-06-mobile');

    await ctx.close();
  });

  test('A5: DHL PAE — entrega pequeña', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Buenas, de DHL, traigo 10 paquetes de pequeño electrodoméstico');
    await snap(page, 'A5-01-presentacion');
    expect(r1.length).toBeGreaterThan(10);

    const r2 = await sendChatMessage(page, '2 albaranes, cosa rápida');
    await snap(page, 'A5-02-albaranes');

    const r3 = await sendChatMessage(page, 'Mañana si puede ser');
    await snap(page, 'A5-03-dia');
    expect(r3.length).toBeGreaterThan(10);

    const r4 = await sendChatMessage(page, 'Mi email es test-dhl@test.com');
    await snap(page, 'A5-04-email');

    const r5 = await sendChatMessage(page, 'Perfecto, confirma');
    await snap(page, 'A5-05-confirmado');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A5-06-mobile');

    await ctx.close();
  });

  test('A6: Colchones del Sur — cambia de opinión', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Soy de Colchones del Sur, traigo 80 colchones');
    await snap(page, 'A6-01-presentacion');
    expect(r1.length).toBeGreaterThan(10);

    const r2 = await sendChatMessage(page, '4 albaranes, el lunes por favor');
    await snap(page, 'A6-02-dia-lunes');

    // Cambia a martes
    const r3 = await sendChatMessage(page, 'No, mejor el martes');
    await snap(page, 'A6-03-cambio-martes');
    expect(r3.length).toBeGreaterThan(10);

    // Cambia cantidad
    const r4 = await sendChatMessage(page, 'Ah espera, en realidad son 120 colchones, no 80');
    await snap(page, 'A6-04-cambio-cantidad');
    expect(r4.length).toBeGreaterThan(10);

    const r5 = await sendChatMessage(page, 'Mi email es test-colchones@test.com');
    await snap(page, 'A6-05-email');

    const r6 = await sendChatMessage(page, 'Vale, confirma');
    await snap(page, 'A6-06-confirmado');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A6-07-mobile');

    await ctx.close();
  });

  test('A7: Proveedor pide domingo (rechazado)', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Hola, soy de Transportes del Sur, necesito descargar el domingo, traigo 30 bultos de mobiliario');
    await snap(page, 'A7-01-domingo');
    expect(r1.length).toBeGreaterThan(10);
    // Should reject Sunday politely

    const r2 = await sendChatMessage(page, 'Entonces el lunes a primera hora');
    await snap(page, 'A7-02-lunes');
    expect(r2.length).toBeGreaterThan(10);

    const r3 = await sendChatMessage(page, 'Mi email es test-prov7@test.com');
    await snap(page, 'A7-03-email');

    const r4 = await sendChatMessage(page, 'Vale, confirma');
    await snap(page, 'A7-04-confirmado');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A7-05-mobile');

    await ctx.close();
  });

  test('A8: Proveedor con fecha pasada', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Hola, soy de Muebles Europa, traigo 40 muebles de salón, 3 albaranes. Quiero reservar para el 15 de enero');
    await snap(page, 'A8-01-fecha-pasada');
    expect(r1.length).toBeGreaterThan(10);
    // Should reject past date

    const r2 = await sendChatMessage(page, 'Perdona, quería decir el 15 del mes que viene');
    await snap(page, 'A8-02-fecha-corregida');
    expect(r2.length).toBeGreaterThan(10);

    const r3 = await sendChatMessage(page, 'Mi email es test-prov8@test.com');
    await snap(page, 'A8-03-email');

    const r4 = await sendChatMessage(page, 'Confirma, por favor');
    await snap(page, 'A8-04-confirmado');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A8-05-mobile');

    await ctx.close();
  });

  test('A9: CODECO — carga grande electro', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Somos de CODECO, traemos 200 electrodomésticos, 8 albaranes');
    await snap(page, 'A9-01-presentacion');
    expect(r1.length).toBeGreaterThan(10);

    const r2 = await sendChatMessage(page, 'El lunes de la semana que viene');
    await snap(page, 'A9-02-dia');
    expect(r2.length).toBeGreaterThan(10);

    const r3 = await sendChatMessage(page, 'Mi email es test-codeco@test.com');
    await snap(page, 'A9-03-email');

    const r4 = await sendChatMessage(page, 'Confirma');
    await snap(page, 'A9-04-confirmado');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A9-05-mobile');

    await ctx.close();
  });

  test('A10: Jancor — concurrencia misma hora', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const r1 = await sendChatMessage(page, 'Hola, de Jancor, traemos 50 colchones, 4 albaranes');
    await snap(page, 'A10-01-presentacion');
    expect(r1.length).toBeGreaterThan(10);

    // Request same Monday first hour as other appointments
    const r2 = await sendChatMessage(page, 'El lunes que viene a las 8 de la mañana');
    await snap(page, 'A10-02-misma-hora');
    expect(r2.length).toBeGreaterThan(10);

    const r3 = await sendChatMessage(page, 'Mi email es test-jancor@test.com');
    await snap(page, 'A10-03-email');

    const r4 = await sendChatMessage(page, 'Vale, confirma lo que haya disponible');
    await snap(page, 'A10-04-confirmado');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await scrollChatToBottom(page);
    await snap(page, 'A10-05-mobile');

    await ctx.close();
  });
});
