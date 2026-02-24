import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "../db/client";
import {
  buildDailySummaryHtml,
  buildDailySummarySubject,
  buildAlertHtml,
  buildAlertSubject,
} from "./email-templates";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";
import { getMadridMidnight, getMadridEndOfDay } from "../utils/madrid-date";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[EMAIL] SMTP not configured — email sending disabled");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

function getFromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@centrohogar.es";
}

async function logEmail(
  recipientEmail: string,
  type: "DAILY_SUMMARY" | "ALERT",
  subject: string,
  status: "SENT" | "FAILED",
  error?: string
) {
  try {
    await prisma.emailLog.create({
      data: {
        recipientEmail,
        type,
        subject,
        status,
        sentAt: status === "SENT" ? new Date() : undefined,
        error: error || undefined,
      },
    });
  } catch (e) {
    console.error("[EMAIL] Failed to log email:", e);
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  type: "DAILY_SUMMARY" | "ALERT"
): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    await logEmail(to, type, subject, "FAILED", "SMTP not configured");
    return false;
  }

  try {
    await t.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html,
    });
    await logEmail(to, type, subject, "SENT");
    return true;
  } catch (err: any) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err.message);
    await logEmail(to, type, subject, "FAILED", err.message);
    return false;
  }
}

/**
 * Send daily summary email for a given date.
 * By default (no targetDate), sends the summary for TOMORROW (addDays +1).
 * This is intentional: the cron job runs in the evening to prepare staff
 * for the next day's appointments.
 */
export async function sendDailySummary(targetDate?: Date): Promise<number> {
  const date = targetDate || addDays(new Date(), 1);
  const dateStr = formatInTimeZone(date, "Europe/Madrid", "dd/MM/yyyy");
  const dayStart = getMadridMidnight(date);
  const dayEnd = getMadridEndOfDay(date);

  const appointments = await prisma.appointment.findMany({
    where: {
      startUtc: { gte: dayStart, lte: dayEnd },
    },
    include: { dock: true },
    orderBy: { startUtc: "asc" },
  });

  const recipients = await prisma.emailRecipient.findMany({
    where: { active: true, receivesDailySummary: true },
  });

  if (recipients.length === 0) {
    console.log("[EMAIL] No daily summary recipients configured");
    return 0;
  }

  const appointmentData = appointments.map((a) => ({
    providerName: a.providerName,
    startTime: formatInTimeZone(a.startUtc, "Europe/Madrid", "HH:mm"),
    endTime: formatInTimeZone(a.endUtc, "Europe/Madrid", "HH:mm"),
    size: a.size,
    pointsUsed: a.pointsUsed,
    slotStartTime: a.slotStartTime,
    goodsType: a.goodsType,
    workMinutesNeeded: a.workMinutesNeeded,
    dockCode: a.dock?.code ?? null,
  }));

  const html = buildDailySummaryHtml({
    date: dateStr,
    totalAppointments: appointments.length,
    appointments: appointmentData,
  });

  const subject = buildDailySummarySubject(dateStr, appointments.length);

  let sent = 0;
  for (const r of recipients) {
    const ok = await sendEmail(r.email, subject, html, "DAILY_SUMMARY");
    if (ok) sent++;
  }

  console.log(`[EMAIL] Daily summary sent to ${sent}/${recipients.length} recipients`);
  return sent;
}

export async function sendAppointmentAlert(
  type: "new_appointment" | "updated_appointment" | "deleted_appointment",
  appointment: {
    providerName: string;
    startUtc: Date;
    endUtc: Date;
    size?: string | null;
    pointsUsed?: number | null;
    goodsType?: string | null;
    workMinutesNeeded: number;
    dockName?: string | null;
  }
): Promise<number> {
  const recipients = await prisma.emailRecipient.findMany({
    where: { active: true, receivesAlerts: true },
  });

  if (recipients.length === 0) return 0;

  const alertData = {
    type,
    appointment: {
      providerName: appointment.providerName,
      startTime: formatInTimeZone(appointment.startUtc, "Europe/Madrid", "dd/MM/yyyy HH:mm"),
      endTime: formatInTimeZone(appointment.endUtc, "Europe/Madrid", "HH:mm"),
      size: appointment.size,
      pointsUsed: appointment.pointsUsed,
      goodsType: appointment.goodsType,
      workMinutesNeeded: appointment.workMinutesNeeded,
      dockName: appointment.dockName,
    },
  };

  const html = buildAlertHtml(alertData);
  const subject = buildAlertSubject(type, appointment.providerName);

  let sent = 0;
  for (const r of recipients) {
    const ok = await sendEmail(r.email, subject, html, "ALERT");
    if (ok) sent++;
  }

  return sent;
}

export async function sendTestEmail(to: string): Promise<boolean> {
  const html = buildAlertHtml({
    type: "new_appointment",
    message: "Este es un correo de prueba del sistema de notificaciones.",
    appointment: {
      providerName: "Proveedor de Prueba",
      startTime: "09:00",
      endTime: "10:30",
      size: "M",
      pointsUsed: 2,
      goodsType: "General",
      workMinutesNeeded: 60,
      dockName: "Muelle 1",
    },
  });

  return sendEmail(to, "Correo de prueba - Centro Hogar Sanchez", html, "ALERT");
}
