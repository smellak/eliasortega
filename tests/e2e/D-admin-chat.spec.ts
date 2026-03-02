import { test, expect } from '@playwright/test';
import { loginAdmin, snap, navigateTo, sendAdminChat } from './helpers';

test.describe.serial('Bloque D: Asistente IA Admin — Elías interno', () => {

  test('D1: Resumen del día', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await navigateTo(page, '/admin-chat');
    await page.waitForTimeout(2000);
    await snap(page, 'D1-01-admin-chat-inicio');

    const resp = await sendAdminChat(page, 'Dame un resumen de las citas de esta semana');
    await snap(page, 'D1-02-resumen');
    expect(resp.length).toBeGreaterThan(10);

    await ctx.close();
  });

  test('D2: Consultar ocupación', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await navigateTo(page, '/admin-chat');
    await page.waitForTimeout(2000);

    const resp = await sendAdminChat(page, '¿Cómo está de ocupado el lunes?');
    await snap(page, 'D2-01-ocupacion');
    expect(resp.length).toBeGreaterThan(10);

    await ctx.close();
  });

  test('D3: Consultar proveedor', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await navigateTo(page, '/admin-chat');
    await page.waitForTimeout(2000);

    const resp = await sendAdminChat(page, '¿Qué sabes de Pedro Ortiz?');
    await snap(page, 'D3-01-proveedor');
    expect(resp.length).toBeGreaterThan(10);

    await ctx.close();
  });

  test('D4: Crear cita manual', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await navigateTo(page, '/admin-chat');
    await page.waitForTimeout(2000);

    const resp = await sendAdminChat(page, 'Crea una cita para Ikea el viernes a las 10, 50 muebles de mobiliario. Email: test-ikea@test.com');
    await snap(page, 'D4-01-crear-cita');
    expect(resp.length).toBeGreaterThan(10);

    // Confirm if asked
    if (resp.toLowerCase().includes('confirma') || resp.toLowerCase().includes('seguro') || resp.toLowerCase().includes('proceder')) {
      const resp2 = await sendAdminChat(page, 'Sí, confirma');
      await snap(page, 'D4-02-cita-confirmada');
    }

    await ctx.close();
  });

  test('D5: Modificar cita', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await navigateTo(page, '/admin-chat');
    await page.waitForTimeout(2000);

    const resp = await sendAdminChat(page, 'Cambia la cita de Tapicería Jaén a las 10:00');
    await snap(page, 'D5-01-modificar');
    expect(resp.length).toBeGreaterThan(10);

    // Confirm if asked
    if (resp.toLowerCase().includes('confirma') || resp.toLowerCase().includes('seguro') || resp.toLowerCase().includes('modificar')) {
      const resp2 = await sendAdminChat(page, 'Sí, confirma el cambio');
      await snap(page, 'D5-02-modificacion-confirmada');
    }

    await ctx.close();
  });

  test('D6: Cancelar cita', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await navigateTo(page, '/admin-chat');
    await page.waitForTimeout(2000);

    const resp = await sendAdminChat(page, 'Cancela la cita de CODECO');
    await snap(page, 'D6-01-cancelar');
    expect(resp.length).toBeGreaterThan(10);

    if (resp.toLowerCase().includes('confirma') || resp.toLowerCase().includes('seguro') || resp.toLowerCase().includes('cancelar')) {
      const resp2 = await sendAdminChat(page, 'Sí, cancela');
      await snap(page, 'D6-02-cancelacion-confirmada');
    }

    await ctx.close();
  });

  test('D7: Consultar muelles', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await navigateTo(page, '/admin-chat');
    await page.waitForTimeout(2000);

    const resp = await sendAdminChat(page, '¿Cuántos muelles tenemos activos?');
    await snap(page, 'D7-01-muelles');
    expect(resp.length).toBeGreaterThan(10);

    await ctx.close();
  });

  test('D8: Consultar precisión', async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await navigateTo(page, '/admin-chat');
    await page.waitForTimeout(2000);

    const resp = await sendAdminChat(page, '¿Cómo va la precisión de las estimaciones?');
    await snap(page, 'D8-01-precision');
    expect(resp.length).toBeGreaterThan(10);

    await ctx.close();
  });
});
