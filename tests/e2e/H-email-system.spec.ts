import { test, expect, APIRequestContext } from '@playwright/test';
import { loginAdmin, snap, navigateTo, BASE_URL, ADMIN_EMAIL, ADMIN_PASS } from './helpers';
import { readFileSync, existsSync } from 'fs';

/**
 * Bloque H: Sistema de Emails — Tests E2E completos
 *
 * H1-H12: Destinatarios, toggles, previews, test email, confirmación,
 * recordatorio, daily summary, crear cita (auto-email), actualizar,
 * reenviar, eliminar, log completo, UI notificaciones.
 */

const TEST_RECIPIENT = 's.mellak.shiito@gmail.com';
const AUTH_STATE_FILE = 'test-results/.auth-state.json';

/** Get token from cached auth state or via Playwright request */
async function getToken(request: APIRequestContext): Promise<string> {
  if (existsSync(AUTH_STATE_FILE)) {
    try {
      const state = JSON.parse(readFileSync(AUTH_STATE_FILE, 'utf-8'));
      if (state.token && Date.now() - state.ts < 3600000) return state.token;
    } catch {}
  }
  const resp = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
  });
  const data = await resp.json() as any;
  return data.token || data.accessToken || '';
}

/** API helper using Playwright request context */
async function api(request: APIRequestContext, tk: string, method: string, path: string, body?: any) {
  const opts: any = { headers: { 'Authorization': `Bearer ${tk}` } };
  if (body) opts.data = body;
  let resp;
  switch (method) {
    case 'POST': resp = await request.post(`${BASE_URL}${path}`, opts); break;
    case 'PUT': resp = await request.put(`${BASE_URL}${path}`, opts); break;
    case 'DELETE': resp = await request.delete(`${BASE_URL}${path}`, opts); break;
    default: resp = await request.get(`${BASE_URL}${path}`, opts); break;
  }
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return text; }
}

test.describe.serial('Bloque H: Sistema de Emails', () => {
  let token: string;
  let createdProviderId: string;
  let createdAppointmentId: string;

  test.beforeEach(async ({ page, request }) => {
    if (!token) token = await getToken(request);
    await loginAdmin(page);
  });

  // ── H1 ──────────────────────────────────────────────────────
  test('H1: Verificar destinatarios — solo s.mellak.shiito@gmail.com', async ({ page, request }) => {
    const recipients = await api(request, token, 'GET', '/api/email-recipients');
    expect(Array.isArray(recipients)).toBe(true);
    expect(recipients.length).toBeGreaterThanOrEqual(1);

    const activeRecipients = recipients.filter((r: any) => r.active);
    for (const r of activeRecipients) {
      expect(r.email).toBe(TEST_RECIPIENT);
    }
    for (const r of recipients) {
      expect(r.email).not.toContain('tapizados');
      expect(r.email).not.toContain('pedroortiz');
      expect(r.email).not.toContain('mengualba');
    }

    await navigateTo(page, '/notifications');
    await page.waitForTimeout(2000);
    await snap(page, 'H1-01-notificaciones-equipo');

    const equipoTab = page.locator('button:has-text("Equipo"), [data-testid*="tab-equipo"], [data-testid*="tab-team"]');
    if (await equipoTab.first().isVisible().catch(() => false)) {
      await equipoTab.first().click();
      await page.waitForTimeout(1500);
      await snap(page, 'H1-02-tab-equipo');
    }

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('s.mellak.shiito@gmail.com');
  });

  // ── H2 ──────────────────────────────────────────────────────
  test('H2: Verificar toggles de equipo habilitados', async ({ page, request }) => {
    const toggles = await api(request, token, 'GET', '/api/email/team-toggles');
    expect(toggles.team_email_daily_summary_enabled).toBe(true);
    expect(toggles.team_email_new_appointment_enabled).toBe(true);
    expect(toggles.team_email_updated_appointment_enabled).toBe(true);
    expect(toggles.team_email_deleted_appointment_enabled).toBe(true);
    await snap(page, 'H2-01-toggles-verificados');
  });

  // ── H3 ──────────────────────────────────────────────────────
  test('H3: Preview de emails (confirmación, recordatorio, equipo)', async ({ page, request }) => {
    const confirmHtml = await api(request, token, 'GET', `/api/email/preview?type=confirmation&_token=${token}`);
    expect(typeof confirmHtml).toBe('string');
    expect(confirmHtml).toContain('Centro Hogar');

    const reminderHtml = await api(request, token, 'GET', `/api/email/preview?type=reminder&_token=${token}`);
    expect(typeof reminderHtml).toBe('string');
    expect(reminderHtml).toContain('Centro Hogar');

    const summaryHtml = await api(request, token, 'GET', `/api/email/preview/team/daily_summary?_token=${token}`);
    expect(typeof summaryHtml).toBe('string');
    expect(summaryHtml).toContain('Centro Hogar');

    const newApptHtml = await api(request, token, 'GET', `/api/email/preview/team/new_appointment?_token=${token}`);
    expect(typeof newApptHtml).toBe('string');

    await navigateTo(page, '/notifications');
    await page.waitForTimeout(2000);
    const provTab = page.locator('button:has-text("Proveedores"), [data-testid*="tab-prov"]');
    if (await provTab.first().isVisible().catch(() => false)) {
      await provTab.first().click();
      await page.waitForTimeout(1500);
      await snap(page, 'H3-01-preview-proveedores');
    }
    await snap(page, 'H3-02-previews-ok');
  });

  // ── H4 ──────────────────────────────────────────────────────
  test('H4: Enviar test email a s.mellak.shiito@gmail.com', async ({ page, request }) => {
    const result = await api(request, token, 'POST', '/api/email/test', { to: TEST_RECIPIENT });
    expect(result.success).toBe(true);

    await page.waitForTimeout(3000);
    const log = await api(request, token, 'GET', '/api/email-log?limit=3');
    const latest = log.logs[0];
    expect(latest.recipientEmail).toBe(TEST_RECIPIENT);
    expect(latest.status).toBe('SENT');
    expect(latest.subject).toContain('prueba');
    await snap(page, 'H4-01-test-email-sent');
  });

  // ── H5 ──────────────────────────────────────────────────────
  test('H5: Enviar test confirmación y recordatorio', async ({ page, request }) => {
    const confResult = await api(request, token, 'POST', '/api/email/test-confirmation', {
      to: TEST_RECIPIENT, type: 'confirmation',
    });
    expect(confResult.success).toBe(true);
    expect(confResult.message).toContain('confirmation');

    const remResult = await api(request, token, 'POST', '/api/email/test-confirmation', {
      to: TEST_RECIPIENT, type: 'reminder',
    });
    expect(remResult.success).toBe(true);
    expect(remResult.message).toContain('reminder');

    await page.waitForTimeout(3000);
    const log = await api(request, token, 'GET', '/api/email-log?limit=5');
    const sentEmails = log.logs.filter((l: any) => l.status === 'SENT' && l.recipientEmail === TEST_RECIPIENT);
    expect(sentEmails.length).toBeGreaterThanOrEqual(2);
    await snap(page, 'H5-01-confirmation-reminder-sent');
  });

  // ── H6 ──────────────────────────────────────────────────────
  test('H6: Enviar daily summary manual', async ({ page, request }) => {
    const result = await api(request, token, 'POST', '/api/email/send-summary', {});
    expect(result.success).toBe(true);
    expect(result.recipientsSent).toBeGreaterThanOrEqual(1);

    await page.waitForTimeout(3000);
    const log = await api(request, token, 'GET', '/api/email-log?limit=5');
    const summaries = log.logs.filter((l: any) => l.type === 'DAILY_SUMMARY' && l.status === 'SENT');
    expect(summaries.length).toBeGreaterThanOrEqual(1);
    await snap(page, 'H6-01-daily-summary-sent');
  });

  // ── H7 ──────────────────────────────────────────────────────
  test('H7: Crear proveedor TEST + cita → confirmación y alerta automáticas', async ({ page, request }) => {
    const provider = await api(request, token, 'POST', '/api/providers', {
      name: 'TEST-E2E-EmailCheck',
      officialName: 'Email Check Test S.L.',
      type: 'direct',
      category: 'Mobiliario',
      subcategory: 'Testing',
      transportType: 'Transporte propio',
      typicalVolume: 'Bajo',
      avgLeadDays: 2,
      automated: false,
      specialNotes: 'Proveedor E2E para test de emails - BORRAR',
      notes: 'Creado por H7 email test',
    });
    expect(provider.id).toBeTruthy();
    createdProviderId = provider.id;

    const today = new Date();
    const daysToThursday = (4 - today.getDay() + 7) % 7 || 7;
    const thursday = new Date(today);
    thursday.setDate(today.getDate() + daysToThursday);
    const dateStr = thursday.toISOString().split('T')[0];

    const logBefore = await api(request, token, 'GET', '/api/email-log?limit=1');
    const totalBefore = logBefore.total;

    const appt = await api(request, token, 'POST', '/api/appointments', {
      providerName: 'TEST-E2E-EmailCheck',
      providerId: createdProviderId,
      start: `${dateStr}T09:00:00.000Z`,
      end: `${dateStr}T10:30:00.000Z`,
      workMinutesNeeded: 90,
      forkliftsNeeded: 0,
      goodsType: 'Testing E2E',
      units: 20,
      lines: 5,
      deliveryNotesCount: 2,
      externalRef: 'E2E-EMAIL-H7',
      providerEmail: TEST_RECIPIENT,
      providerPhone: '+34 600 000 001',
    });
    expect(appt.id).toBeTruthy();
    createdAppointmentId = appt.id;

    await page.waitForTimeout(5000);

    const logAfter = await api(request, token, 'GET', '/api/email-log?limit=5');
    expect(logAfter.total).toBeGreaterThan(totalBefore);

    const recentSent = logAfter.logs.filter((l: any) => l.status === 'SENT');
    expect(recentSent.length).toBeGreaterThanOrEqual(2);

    const confirmEmail = logAfter.logs.find((l: any) =>
      l.subject.includes('Confirmación de cita') && l.recipientEmail === TEST_RECIPIENT && l.status === 'SENT'
    );
    expect(confirmEmail).toBeTruthy();

    const alertEmail = logAfter.logs.find((l: any) =>
      l.subject.includes('Nueva cita') && l.status === 'SENT'
    );
    expect(alertEmail).toBeTruthy();

    await navigateTo(page, '/notifications');
    await page.waitForTimeout(2000);
    const regTab = page.locator('button:has-text("Registro"), [data-testid*="tab-reg"], [data-testid*="tab-log"]');
    if (await regTab.first().isVisible().catch(() => false)) {
      await regTab.first().click();
      await page.waitForTimeout(1500);
    }
    await snap(page, 'H7-01-emails-auto-enviados');
  });

  // ── H8 ──────────────────────────────────────────────────────
  test('H8: Actualizar cita → alerta equipo (updated)', async ({ page, request }) => {
    expect(createdAppointmentId).toBeTruthy();

    const logBefore = await api(request, token, 'GET', '/api/email-log?limit=1');
    const totalBefore = logBefore.total;

    const updated = await api(request, token, 'PUT', `/api/appointments/${createdAppointmentId}`, {
      units: 40,
      goodsType: 'Testing E2E (Actualizado)',
    });
    expect(updated.units).toBe(40);

    await page.waitForTimeout(5000);

    const logAfter = await api(request, token, 'GET', '/api/email-log?limit=3');
    expect(logAfter.total).toBeGreaterThan(totalBefore);

    const updateAlert = logAfter.logs.find((l: any) =>
      l.subject.includes('actualizada') && l.status === 'SENT'
    );
    expect(updateAlert).toBeTruthy();
    expect(updateAlert.recipientEmail).toBe(TEST_RECIPIENT);
    await snap(page, 'H8-01-alerta-updated');
  });

  // ── H9 ──────────────────────────────────────────────────────
  test('H9: Reenviar confirmación de cita', async ({ page, request }) => {
    expect(createdAppointmentId).toBeTruthy();

    const result = await api(request, token, 'POST', `/api/appointments/${createdAppointmentId}/resend-confirmation`, {});
    expect(result.success).toBe(true);
    expect(result.sentTo).toBe(TEST_RECIPIENT);

    await page.waitForTimeout(3000);
    const log = await api(request, token, 'GET', '/api/email-log?limit=3');
    const resent = log.logs.find((l: any) =>
      l.subject.includes('Confirmación') && l.status === 'SENT' && !l.subject.includes('PRUEBA')
    );
    expect(resent).toBeTruthy();
    await snap(page, 'H9-01-resend-confirmation');
  });

  // ── H10 ─────────────────────────────────────────────────────
  test('H10: Eliminar cita → alerta equipo (deleted)', async ({ page, request }) => {
    expect(createdAppointmentId).toBeTruthy();

    const logBefore = await api(request, token, 'GET', '/api/email-log?limit=1');
    const totalBefore = logBefore.total;

    await api(request, token, 'DELETE', `/api/appointments/${createdAppointmentId}`);
    await page.waitForTimeout(5000);

    const logAfter = await api(request, token, 'GET', '/api/email-log?limit=3');
    expect(logAfter.total).toBeGreaterThan(totalBefore);

    const deleteAlert = logAfter.logs.find((l: any) =>
      l.subject.includes('eliminada') && l.status === 'SENT'
    );
    expect(deleteAlert).toBeTruthy();
    expect(deleteAlert.recipientEmail).toBe(TEST_RECIPIENT);
    await snap(page, 'H10-01-alerta-deleted');
  });

  // ── H11 ─────────────────────────────────────────────────────
  test('H11: Verificar log de emails completo', async ({ page, request }) => {
    const log = await api(request, token, 'GET', '/api/email-log?limit=50');
    expect(log.total).toBeGreaterThan(0);

    const sent = log.logs.filter((l: any) => l.status === 'SENT');
    expect(sent.length).toBeGreaterThanOrEqual(9);

    // All SENT emails must be to safe addresses
    for (const email of sent) {
      const addr = email.recipientEmail.toLowerCase();
      const isSafe = addr === TEST_RECIPIENT ||
                     addr === 'souf.mellak@gmail.com' ||
                     addr.endsWith('@test.com');
      expect(isSafe).toBe(true);
    }

    // No SENT emails to real provider addresses
    for (const email of sent) {
      expect(email.recipientEmail).not.toContain('tapizados');
      expect(email.recipientEmail).not.toContain('pedroortiz');
      expect(email.recipientEmail).not.toContain('mengualba');
      expect(email.recipientEmail).not.toContain('jancor');
      expect(email.recipientEmail).not.toContain('codeco');
    }

    await navigateTo(page, '/notifications');
    await page.waitForTimeout(2000);
    const regTab = page.locator('button:has-text("Registro"), [data-testid*="tab-reg"], [data-testid*="tab-log"]');
    if (await regTab.first().isVisible().catch(() => false)) {
      await regTab.first().click();
      await page.waitForTimeout(1500);
    }
    await snap(page, 'H11-01-log-emails-completo');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await snap(page, 'H11-02-log-emails-mobile');
  });

  // ── H12 ─────────────────────────────────────────────────────
  test('H12: UI de notificaciones — 3 tabs completos', async ({ page }) => {
    await navigateTo(page, '/notifications');
    await page.waitForTimeout(2000);
    await snap(page, 'H12-01-notificaciones-desktop');

    // Tab: Proveedores
    const provTab = page.locator('button:has-text("Proveedores"), [data-testid*="tab-prov"]');
    if (await provTab.first().isVisible().catch(() => false)) {
      await provTab.first().click();
      await page.waitForTimeout(1500);
      await snap(page, 'H12-02-tab-proveedores');
      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasProviderConfig = bodyText.toLowerCase().includes('confirmación') ||
                                 bodyText.toLowerCase().includes('proveedor') ||
                                 bodyText.toLowerCase().includes('recordatorio');
      expect(hasProviderConfig).toBe(true);
    }

    // Tab: Equipo
    const equipoTab = page.locator('button:has-text("Equipo"), [data-testid*="tab-equipo"], [data-testid*="tab-team"]');
    if (await equipoTab.first().isVisible().catch(() => false)) {
      await equipoTab.first().click();
      await page.waitForTimeout(1500);
      await snap(page, 'H12-03-tab-equipo');
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText).toContain(TEST_RECIPIENT);
    }

    // Tab: Registro
    const regTab = page.locator('button:has-text("Registro"), [data-testid*="tab-reg"], [data-testid*="tab-log"]');
    if (await regTab.first().isVisible().catch(() => false)) {
      await regTab.first().click();
      await page.waitForTimeout(1500);
      await snap(page, 'H12-04-tab-registro');
    }

    // Mobile view
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await snap(page, 'H12-05-notificaciones-mobile');
  });

  // Cleanup
  test.afterAll(async ({ request }) => {
    if (!token || !createdProviderId) return;
    try {
      await api(request, token, 'DELETE', `/api/providers/${createdProviderId}`);
    } catch {}
  });
});
