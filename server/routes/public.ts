import { Router } from "express";
import { prisma } from "../db/client";
import { confirmAppointmentSchema } from "../../shared/types";
import { publicRateLimiter } from "../middleware/rate-limiting";
import { buildConfirmationPage } from "../helpers/appointment-helpers";
import { processAppointmentCancellation } from "../services/provider-email-service";

const router = Router();

router.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "degraded", database: "disconnected", timestamp: new Date().toISOString() });
  }
});

// --- Public appointment confirmation (no auth) ---
router.get("/api/appointments/confirm/:token", publicRateLimiter, async (req, res) => {
  try {
    let appt: any;
    try {
      appt = await prisma.appointment.findUnique({ where: { confirmationToken: req.params.token }, include: { dock: true } });
    } catch {
      appt = await prisma.appointment.findUnique({ where: { confirmationToken: req.params.token } });
    }

    let contactPhone = "";
    try { contactPhone = (await prisma.appConfig.findUnique({ where: { key: "provider_email_contact_phone" } }))?.value || ""; } catch { /* appConfig may not exist */ }

    if (!appt) {
      return res.type("html").send(buildConfirmationPage("error", null, contactPhone));
    }

    return res.type("html").send(buildConfirmationPage(appt.confirmationStatus, appt, contactPhone));
  } catch (error) {
    console.error("Confirm page error:", error);
    res.type("html").status(500).send(buildConfirmationPage("error", null, ""));
  }
});

router.post("/api/appointments/confirm", publicRateLimiter, async (req, res) => {
  try {
    const data = confirmAppointmentSchema.parse(req.body);

    const appt = await prisma.appointment.findUnique({
      where: { confirmationToken: data.token },
    });

    if (!appt) {
      return res.status(404).json({ success: false, error: "Token no válido o enlace caducado" });
    }

    if (appt.confirmationStatus === "confirmed" && data.action === "confirm") {
      return res.status(409).json({ success: true, status: "already_confirmed", message: "La cita ya estaba confirmada" });
    }

    if (appt.confirmationStatus === "cancelled") {
      return res.status(400).json({ success: false, error: "Esta cita ya fue anulada" });
    }

    if (data.action === "confirm") {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { confirmationStatus: "confirmed", confirmedAt: new Date() },
      });
      return res.json({ success: true, status: "confirmed", message: "Cita confirmada correctamente" });
    }

    // Design decision: A confirmed appointment CAN be cancelled by the provider.
    // This is intentional — a provider who confirmed may later need to cancel.
    // Valid transitions: pending→confirmed, pending→cancelled, confirmed→cancelled.
    if (data.action === "cancel") {
      await processAppointmentCancellation(appt.id, data.reason);
      return res.json({ success: true, status: "cancelled", message: "Cita anulada correctamente" });
    }

    return res.status(400).json({ success: false, error: "Acción no válida" });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: "Datos no válidos", details: error.errors });
    }
    console.error("Confirm action error:", error);
    res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
});

router.post("/api/chat/message", publicRateLimiter, async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId and message are required" });
  }

  // Set SSE headers early so error handler can always send SSE responses
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const { getBaseUrl } = await import("../utils/base-url");
    const baseUrl = getBaseUrl();

    const { AgentOrchestrator } = await import("../agent/orchestrator");
    const orchestrator = new AgentOrchestrator(sessionId, baseUrl);

    for await (const chunk of orchestrator.chat(message)) {
      const data = JSON.stringify(chunk);
      res.write(`data: ${data}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("[CHAT] Error:", error.message);

    const errorChunk = JSON.stringify({
      type: "error",
      content: "Lo siento, ha ocurrido un error. Inténtalo de nuevo.",
    });
    res.write(`data: ${errorChunk}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

export default router;
