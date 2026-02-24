import { randomUUID } from "crypto";
import { prisma } from "../db/client";
import { sendEmail } from "./email-service";
import { sendAppointmentAlert } from "./email-service";
import { formatInTimeZone } from "date-fns-tz";
import { getBaseUrl } from "../utils/base-url";

// --- HTML Templates ---

function wrapHtml(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1e40af;color:#ffffff;padding:20px 24px;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">Centro Hogar Sánchez</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">Gestión de Descargas</p>
    </div>
    <div style="padding:24px;">
      ${bodyContent}
    </div>
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
      Centro Hogar Sánchez — Sistema de Gestión de Citas
    </div>
  </div>
</body>
</html>`;
}

function appointmentSummaryHtml(appt: {
  providerName: string;
  startUtc: Date;
  endUtc: Date;
  goodsType: string | null;
  units: number | null;
  size: string | null;
  workMinutesNeeded: number;
}): string {
  const dateStr = formatInTimeZone(appt.startUtc, "Europe/Madrid", "dd/MM/yyyy");
  const startTime = formatInTimeZone(appt.startUtc, "Europe/Madrid", "HH:mm");
  const endTime = formatInTimeZone(appt.endUtc, "Europe/Madrid", "HH:mm");
  const sizeLabel = appt.size === "S" ? "Pequeña (S)" : appt.size === "M" ? "Mediana (M)" : appt.size === "L" ? "Grande (L)" : "—";

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;width:40%;">Proveedor</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${appt.providerName}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Fecha</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${dateStr}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Horario</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${startTime} — ${endTime}</td></tr>
      ${appt.goodsType ? `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Mercancía</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${appt.goodsType}</td></tr>` : ""}
      ${appt.units != null ? `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Unidades</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${appt.units}</td></tr>` : ""}
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Tamaño</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${sizeLabel}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Duración</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">~${appt.workMinutesNeeded} min</td></tr>
    </table>`;
}

function buildConfirmationEmailHtml(appt: any, confirmUrl: string, extraText: string, contactPhone: string): string {
  const summary = appointmentSummaryHtml(appt);
  const phoneSection = contactPhone ? `<p style="margin:8px 0;font-size:13px;color:#64748b;">Teléfono del almacén: <strong>${contactPhone}</strong></p>` : "";
  const extraSection = extraText ? `<div style="margin:16px 0;padding:12px;background:#fefce8;border:1px solid #fef08a;border-radius:6px;font-size:13px;">${extraText}</div>` : "";

  return wrapHtml("Confirmación de cita — Centro Hogar Sánchez", `
    <p style="margin:0 0 8px;font-size:16px;">Hola <strong>${appt.providerName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;">Tu cita de descarga ha sido registrada con los siguientes datos:</p>
    ${summary}
    ${extraSection}
    <p style="margin:16px 0 8px;color:#475569;">Para confirmar tu asistencia o si necesitas anular, pulsa el botón:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;min-width:200px;">Ver y confirmar mi cita</a>
    </div>
    ${phoneSection}
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Si no solicitaste esta cita, puedes ignorar este email.</p>
  `);
}

function buildReminderEmailHtml(appt: any, confirmUrl: string, isConfirmed: boolean, extraText: string, contactPhone: string): string {
  const summary = appointmentSummaryHtml(appt);
  const phoneSection = contactPhone ? `<p style="margin:8px 0;font-size:13px;color:#64748b;">Teléfono del almacén: <strong>${contactPhone}</strong></p>` : "";
  const extraSection = extraText ? `<div style="margin:16px 0;padding:12px;background:#fefce8;border:1px solid #fef08a;border-radius:6px;font-size:13px;">${extraText}</div>` : "";

  const actionSection = isConfirmed
    ? `<p style="color:#16a34a;font-weight:600;">Tu cita ya está confirmada. Si necesitas hacer algún cambio:</p>
       <div style="text-align:center;margin:24px 0;">
         <a href="${confirmUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Gestionar mi cita</a>
       </div>`
    : `<p style="color:#475569;">Por favor, confirma tu asistencia:</p>
       <div style="text-align:center;margin:24px 0;">
         <a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;margin-right:8px;">Confirmar asistencia</a>
       </div>
       <p style="margin:8px 0;font-size:13px;color:#64748b;text-align:center;">Si no puedes acudir, te pedimos que anules con la máxima antelación posible.</p>`;

  return wrapHtml("Recordatorio de cita — Centro Hogar Sánchez", `
    <p style="margin:0 0 8px;font-size:16px;">Hola <strong>${appt.providerName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;">Te recordamos que tienes una cita de descarga programada:</p>
    ${summary}
    ${extraSection}
    ${actionSection}
    ${phoneSection}
  `);
}

// --- Service Functions ---

async function getProviderEmailConfig(): Promise<{ extraText: string; contactPhone: string; confirmationEnabled: boolean; reminderEnabled: boolean }> {
  const configs = await prisma.appConfig.findMany({
    where: { key: { in: ["confirmation_email_enabled", "reminder_email_enabled", "provider_email_extra_text", "provider_email_contact_phone"] } },
  });
  const map = Object.fromEntries(configs.map(c => [c.key, c.value]));
  return {
    confirmationEnabled: map["confirmation_email_enabled"] !== "false",
    reminderEnabled: map["reminder_email_enabled"] !== "false",
    extraText: map["provider_email_extra_text"] || "",
    contactPhone: map["provider_email_contact_phone"] || "",
  };
}

export async function sendAppointmentConfirmation(appointmentId: string): Promise<boolean> {
  try {
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt || !appt.providerEmail) {
      console.warn("[PROVIDER-EMAIL] No email for appointment", appointmentId);
      return false;
    }

    const config = await getProviderEmailConfig();
    if (!config.confirmationEnabled) {
      console.log("[PROVIDER-EMAIL] Confirmation emails disabled");
      return false;
    }

    const token = randomUUID();
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { confirmationToken: token, confirmationSentAt: new Date() },
    });

    const baseUrl = getBaseUrl();
    const confirmUrl = `${baseUrl}/api/appointments/confirm/${token}`;
    const html = buildConfirmationEmailHtml(appt, confirmUrl, config.extraText, config.contactPhone);
    const subject = "Confirmación de cita de descarga — Centro Hogar Sánchez";

    const sent = await sendEmail(appt.providerEmail, subject, html, "ALERT");
    if (sent) {
      console.log(`[PROVIDER-EMAIL] Confirmation sent to ${appt.providerEmail} for appointment ${appointmentId}`);
    }
    return sent;
  } catch (err: any) {
    console.error("[PROVIDER-EMAIL] Failed to send confirmation:", err.message);
    return false;
  }
}

export async function sendAppointmentReminder(appointmentId: string): Promise<boolean> {
  try {
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt || !appt.providerEmail) return false;
    if (appt.confirmationStatus === "cancelled") return false;
    if (appt.reminderSentAt) return false;

    const config = await getProviderEmailConfig();
    if (!config.reminderEnabled) return false;

    // Ensure there's a token
    let token = appt.confirmationToken;
    if (!token) {
      token = randomUUID();
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { confirmationToken: token },
      });
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { reminderSentAt: new Date() },
    });

    const baseUrl = getBaseUrl();
    const confirmUrl = `${baseUrl}/api/appointments/confirm/${token}`;
    const isConfirmed = appt.confirmationStatus === "confirmed";
    const html = buildReminderEmailHtml(appt, confirmUrl, isConfirmed, config.extraText, config.contactPhone);
    const subject = "Recordatorio: tu descarga es pasado mañana — Centro Hogar Sánchez";

    const sent = await sendEmail(appt.providerEmail, subject, html, "ALERT");
    if (sent) {
      console.log(`[PROVIDER-EMAIL] Reminder sent to ${appt.providerEmail} for appointment ${appointmentId}`);
    }
    return sent;
  } catch (err: any) {
    console.error("[PROVIDER-EMAIL] Failed to send reminder:", err.message);
    return false;
  }
}

export async function processAppointmentCancellation(appointmentId: string, reason?: string): Promise<void> {
  const appt = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      confirmationStatus: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: reason || null,
    },
  });

  // Alert admin recipients
  sendAppointmentAlert("deleted_appointment", {
    providerName: appt.providerName,
    startUtc: appt.startUtc,
    endUtc: appt.endUtc,
    size: appt.size,
    pointsUsed: appt.pointsUsed,
    goodsType: appt.goodsType,
    workMinutesNeeded: appt.workMinutesNeeded,
  }).catch((e) => console.error("[PROVIDER-EMAIL] Alert error:", e));
}

export async function runReminderCheck(): Promise<number> {
  const now = new Date();
  const reminderWindowStart = new Date(now.getTime() + 46 * 60 * 60 * 1000); // 46h
  const reminderWindowEnd = new Date(now.getTime() + 50 * 60 * 60 * 1000);   // 50h

  const appointments = await prisma.appointment.findMany({
    where: {
      confirmationStatus: { not: "cancelled" },
      providerEmail: { not: null },
      reminderSentAt: null,
      startUtc: { gte: reminderWindowStart, lte: reminderWindowEnd },
    },
  });

  let sent = 0;
  for (const appt of appointments) {
    const ok = await sendAppointmentReminder(appt.id);
    if (ok) sent++;
  }
  return sent;
}
