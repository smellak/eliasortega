import { Router } from "express";
import {
  createEmailRecipientSchema,
  updateEmailRecipientSchema,
} from "../../shared/types";
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from "../middleware/auth";
import { sendTestEmail, sendDailySummary, sendEmail } from "../services/email-service";
import { getConfirmationPreviewHtml, getReminderPreviewHtml } from "../services/provider-email-service";
import { buildDailySummaryHtml, buildAlertHtml } from "../services/email-templates";
import { prisma } from "../db/client";

const router = Router();

router.get("/api/email-recipients", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const recipients = await prisma.emailRecipient.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(recipients);
  } catch (error) {
    console.error("Get email recipients error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/email-recipients", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const data = createEmailRecipientSchema.parse(req.body);
    const recipient = await prisma.emailRecipient.create({
      data: {
        email: data.email,
        name: data.name,
        receivesDailySummary: data.receivesDailySummary,
        receivesAlerts: data.receivesAlerts,
        receivesUrgent: data.receivesUrgent,
        active: data.active,
      },
    });
    res.status(201).json(recipient);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Create email recipient error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/email-recipients/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const data = updateEmailRecipientSchema.parse(req.body);
    const recipient = await prisma.emailRecipient.update({
      where: { id: req.params.id },
      data,
    });
    res.json(recipient);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Recipient not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Update email recipient error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/email-recipients/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    await prisma.emailRecipient.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Recipient not found" });
    }
    console.error("Delete email recipient error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Email Log (ADMIN only)
router.get("/api/email-log", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { limit, offset } = req.query;
    const take = Math.min(parseInt(limit as string) || 50, 200);
    const skip = parseInt(offset as string) || 0;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.emailLog.count(),
    ]);

    res.json({ logs, total, limit: take, offset: skip });
  } catch (error) {
    console.error("Get email log error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send test email (ADMIN only)
router.post("/api/email/test", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Recipient email (to) is required" });
    }

    const success = await sendTestEmail(to);

    if (success) {
      res.json({ success: true, message: "Test email sent successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to send test email. Check SMTP configuration." });
    }
  } catch (error: any) {
    console.error("Send test email error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send daily summary email — defaults to tomorrow, optionally pass a date
router.post("/api/email/send-summary", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { date } = req.body;
    const targetDate = date ? new Date(date) : undefined;

    if (date && isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    const sent = await sendDailySummary(targetDate);
    res.json({ success: true, recipientsSent: sent });
  } catch (error: any) {
    console.error("Send summary error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Email preview (returns raw HTML for iframe rendering)
// Accepts JWT via query param _token for iframe embedding
router.get("/api/email/preview", (req, res, next) => {
  if (req.query._token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query._token}`;
  }
  next();
}, authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { type, extraText, contactPhone } = req.query;
    const extra = (extraText as string) || "";
    const phone = (contactPhone as string) || "";

    let html: string;
    if (type === "reminder") {
      html = getReminderPreviewHtml(extra, phone, false);
    } else if (type === "reminder-confirmed") {
      html = getReminderPreviewHtml(extra, phone, true);
    } else {
      html = getConfirmationPreviewHtml(extra, phone);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("Email preview error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send test confirmation email (ADMIN only)
router.post("/api/email/test-confirmation", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { to, type } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Recipient email (to) is required" });
    }

    const configs = await prisma.appConfig.findMany({
      where: { key: { in: ["provider_email_extra_text", "provider_email_contact_phone"] } },
    });
    const map = Object.fromEntries(configs.map(c => [c.key, c.value]));
    const extraText = map["provider_email_extra_text"] || "";
    const contactPhone = map["provider_email_contact_phone"] || "";

    let html: string;
    let subject: string;
    if (type === "reminder") {
      html = getReminderPreviewHtml(extraText, contactPhone, false);
      subject = "Recordatorio: tu descarga es pasado mañana — Centro Hogar Sánchez (PRUEBA)";
    } else {
      html = getConfirmationPreviewHtml(extraText, contactPhone);
      subject = "Confirmación de cita de descarga — Centro Hogar Sánchez (PRUEBA)";
    }

    const success = await sendEmail(to, subject, html, "ALERT");
    if (success) {
      res.json({ success: true, message: `Email de prueba (${type || "confirmación"}) enviado a ${to}` });
    } else {
      res.status(500).json({ success: false, message: "Error al enviar. Revisa la configuración SMTP." });
    }
  } catch (error: any) {
    console.error("Send test confirmation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Team email preview (returns raw HTML for iframe rendering)
router.get("/api/email/preview/team/:type", (req, res, next) => {
  if (req.query._token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query._token}`;
  }
  next();
}, authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const type = req.params.type as string;
    let html: string;

    if (type === "daily_summary") {
      html = buildDailySummaryHtml({
        date: "03/03/2026",
        totalAppointments: 3,
        appointments: [
          { providerName: "Tapiceria Jaen", startTime: "08:00", endTime: "08:50", size: "S", pointsUsed: 1, goodsType: "Tapiceria", workMinutesNeeded: 50, dockCode: "M2" },
          { providerName: "Jancor", startTime: "10:00", endTime: "13:30", size: "L", pointsUsed: 3, goodsType: "Colchones", workMinutesNeeded: 210, dockCode: "M1" },
          { providerName: "Electro Ruiz", startTime: "14:00", endTime: "15:20", size: "M", pointsUsed: 2, goodsType: "Electro", workMinutesNeeded: 80, dockCode: "M3" },
        ],
      });
    } else {
      const alertTypeMap: Record<string, "new_appointment" | "updated_appointment" | "deleted_appointment"> = {
        new_appointment: "new_appointment",
        updated_appointment: "updated_appointment",
        deleted_appointment: "deleted_appointment",
      };
      const alertType = alertTypeMap[type] || "new_appointment";
      html = buildAlertHtml({
        type: alertType,
        appointment: {
          providerName: "Tapiceria Jaen",
          startTime: "03/03/2026 08:00",
          endTime: "08:50",
          size: "M",
          pointsUsed: 2,
          goodsType: "Tapiceria",
          workMinutesNeeded: 50,
          dockName: "Muelle 2",
        },
      });
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("Team email preview error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Team email toggle status (GET/PUT)
router.get("/api/email/team-toggles", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const keys = [
      "team_email_daily_summary_enabled",
      "team_email_new_appointment_enabled",
      "team_email_updated_appointment_enabled",
      "team_email_deleted_appointment_enabled",
    ];
    const configs = await prisma.appConfig.findMany({ where: { key: { in: keys } } });
    const result: Record<string, boolean> = {};
    for (const k of keys) {
      const found = configs.find((c) => c.key === k);
      result[k] = found ? found.value !== "false" : true;
    }
    res.json(result);
  } catch (error) {
    console.error("Get team toggles error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/email/team-toggles", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const body = req.body as Record<string, boolean>;
    for (const [key, value] of Object.entries(body)) {
      if (key.startsWith("team_email_") && key.endsWith("_enabled")) {
        await prisma.appConfig.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value), description: "" },
        });
      }
    }
    // Return updated state
    const keys = Object.keys(body).filter((k) => k.startsWith("team_email_"));
    const configs = await prisma.appConfig.findMany({ where: { key: { in: keys } } });
    const result: Record<string, boolean> = {};
    for (const c of configs) {
      result[c.key] = c.value !== "false";
    }
    res.json(result);
  } catch (error) {
    console.error("Update team toggles error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
