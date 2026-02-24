import { Router } from "express";
import bcrypt from "bcryptjs";
import path from "path";
import {
  loginSchema,
  createProviderSchema,
  updateProviderSchema,
  createCapacityShiftSchema,
  updateCapacityShiftSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  upsertAppointmentSchema,
  rawCalendarQuerySchema,
  AuthResponse,
  UserResponse,
  NormalizedCalendarQuery,
  createSlotTemplateSchema,
  updateSlotTemplateSchema,
  createSlotOverrideSchema,
  updateSlotOverrideSchema,
  createEmailRecipientSchema,
  updateEmailRecipientSchema,
  changePasswordSchema,
  confirmAppointmentSchema,
} from "../shared/types";
import { authenticateToken, requireRole, generateToken, generateRefreshToken, saveRefreshToken, validateRefreshToken, clearRefreshToken, authenticateJwtOrApiKey, AuthRequest } from "./middleware/auth";
import { slotCapacityValidator } from "./services/slot-validator";
import { logAudit, computeChanges } from "./services/audit-service";
import { sendAppointmentAlert, sendTestEmail, sendDailySummary } from "./services/email-service";
import { prisma } from "./db/client";
import { formatInTimeZone } from 'date-fns-tz';
import { normalizeCategory, estimateLines, estimateDeliveryNotes, ESTIMATION_RATIOS } from "./config/estimation-ratios";
import { sendAppointmentConfirmation, processAppointmentCancellation } from "./services/provider-email-service";
import { addMinutes, setHours, setMinutes, setSeconds, setMilliseconds, isWeekend, addDays } from 'date-fns';
import type { Request, Response, NextFunction } from "express";

const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY || "";

function authenticateIntegration(req: Request, res: Response, next: NextFunction) {
  if (!INTEGRATION_API_KEY) {
    return res.status(403).json({ success: false, error: "Integration API is disabled. Set INTEGRATION_API_KEY to enable." });
  }
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey || apiKey !== INTEGRATION_API_KEY) {
    return res.status(401).json({ success: false, error: "Invalid or missing API key" });
  }
  next();
}

const integrationRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function integrationRateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = (req.ip || req.headers["x-forwarded-for"] || "unknown") as string;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 50;

  let entry = integrationRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    integrationRateLimitMap.set(key, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return res.status(429).json({ success: false, error: "Too many requests. Limit: 50 req/min for integration endpoints." });
  }

  next();
}

function formatToMadridLocal(date: Date): string {
  return formatInTimeZone(date, 'Europe/Madrid', 'dd/MM/yyyy, HH:mm');
}

function resolveEstimationsForRoute(goodsType: string | null, units: number | null, lines: number | null, deliveryNotesCount: number | null): { lines: number | null; deliveryNotesCount: number | null; estimatedFields: string[] } {
  const estimated: string[] = [];
  let resolvedLines = lines;
  let resolvedDN = deliveryNotesCount;

  if (goodsType && units != null && units > 0) {
    const category = normalizeCategory(goodsType);
    if (category) {
      if (resolvedLines == null) {
        resolvedLines = estimateLines(category, units);
        estimated.push("lines");
      }
      if (resolvedDN == null) {
        resolvedDN = estimateDeliveryNotes(category);
        estimated.push("deliveryNotesCount");
      }
    }
  }

  return { lines: resolvedLines, deliveryNotesCount: resolvedDN, estimatedFields: estimated };
}

async function upsertAppointmentInternal(data: {
  externalRef: string;
  providerId: string | null;
  providerName: string;
  start: string;
  end: string;
  workMinutesNeeded: number;
  forkliftsNeeded: number;
  goodsType: string | null;
  units: number | null;
  lines: number | null;
  deliveryNotesCount: number | null;
  providerEmail?: string | null;
  providerPhone?: string | null;
}) {
  const est = resolveEstimationsForRoute(data.goodsType, data.units, data.lines, data.deliveryNotesCount);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findUnique({
      where: { externalRef: data.externalRef },
    });

    const { size, points: pointsUsed } = slotCapacityValidator.determineSizeAndPoints(data.workMinutesNeeded);
    const startDate = new Date(data.start);
    const slotDate = new Date(startDate);
    slotDate.setHours(0, 0, 0, 0);
    const resolvedSlotStart = await slotCapacityValidator.resolveSlotStartTime(startDate, tx);
    const slotStartTime = resolvedSlotStart || formatInTimeZone(startDate, 'Europe/Madrid', 'HH:mm');

    const slotValidation = await slotCapacityValidator.validateSlotCapacity(
      slotDate,
      slotStartTime,
      pointsUsed,
      existing?.id,
      tx
    );

    if (!slotValidation.valid) {
      return {
        success: false as const,
        conflict: {
          slotStartTime: slotValidation.slotStartTime,
          slotEndTime: slotValidation.slotEndTime || "",
          maxPoints: slotValidation.maxPoints,
          pointsUsed: slotValidation.pointsUsed,
          pointsNeeded: pointsUsed,
          message: slotValidation.error || "Slot sin capacidad disponible",
        },
      };
    }

    if (existing) {
      const appointment = await tx.appointment.update({
        where: { id: existing.id },
        data: {
          providerId: data.providerId,
          providerName: data.providerName,
          startUtc: new Date(data.start),
          endUtc: new Date(data.end),
          workMinutesNeeded: data.workMinutesNeeded,
          forkliftsNeeded: data.forkliftsNeeded,
          goodsType: data.goodsType,
          units: data.units,
          lines: est.lines,
          deliveryNotesCount: est.deliveryNotesCount,
          estimatedFields: est.estimatedFields.length > 0 ? JSON.stringify(est.estimatedFields) : null,
          providerEmail: data.providerEmail ?? undefined,
          providerPhone: data.providerPhone ?? undefined,
          size,
          pointsUsed,
          slotDate,
          slotStartTime: slotValidation.slotStartTime,
        },
      });

      return { success: true as const, action: "updated" as const, appointment };
    }

    const appointment = await tx.appointment.create({
      data: {
        providerId: data.providerId,
        providerName: data.providerName,
        startUtc: new Date(data.start),
        endUtc: new Date(data.end),
        workMinutesNeeded: data.workMinutesNeeded,
        forkliftsNeeded: data.forkliftsNeeded,
        goodsType: data.goodsType,
        units: data.units,
        lines: est.lines,
        deliveryNotesCount: est.deliveryNotesCount,
        estimatedFields: est.estimatedFields.length > 0 ? JSON.stringify(est.estimatedFields) : null,
        providerEmail: data.providerEmail || null,
        providerPhone: data.providerPhone || null,
        externalRef: data.externalRef,
        size,
        pointsUsed,
        slotDate,
        slotStartTime: slotValidation.slotStartTime,
      },
    });

    return { success: true as const, action: "created" as const, appointment };
  }, { isolationLevel: "Serializable" });
}
const router = Router();

router.get("/logo-sanchez.png", (req, res) => {
  res.sendFile(path.join(process.cwd(), "client/public/logo-sanchez.png"));
});

router.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "degraded", database: "disconnected", timestamp: new Date().toISOString() });
  }
});

// --- Public appointment confirmation (no auth) ---
router.get("/api/appointments/confirm/:token", async (req, res) => {
  try {
    const appt = await prisma.appointment.findFirst({
      where: { confirmationToken: req.params.token },
    });

    const contactPhone = (await prisma.appConfig.findUnique({ where: { key: "provider_email_contact_phone" } }))?.value || "";

    if (!appt) {
      return res.type("html").send(buildConfirmationPage("error", null, contactPhone));
    }

    return res.type("html").send(buildConfirmationPage(appt.confirmationStatus, appt, contactPhone));
  } catch (error) {
    console.error("Confirm page error:", error);
    res.type("html").status(500).send(buildConfirmationPage("error", null, ""));
  }
});

router.post("/api/appointments/confirm", async (req, res) => {
  try {
    const data = confirmAppointmentSchema.parse(req.body);

    const appt = await prisma.appointment.findFirst({
      where: { confirmationToken: data.token },
    });

    if (!appt) {
      return res.status(404).json({ success: false, error: "Token no válido o enlace caducado" });
    }

    if (appt.confirmationStatus === "confirmed" && data.action === "confirm") {
      return res.json({ success: true, status: "confirmed", message: "La cita ya estaba confirmada" });
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

function buildConfirmationPage(status: string, appt: any, contactPhone: string): string {
  const header = `<div style="background:#1e40af;color:#fff;padding:20px;text-align:center;">
    <h1 style="margin:0;font-size:20px;">Centro Hogar Sánchez</h1>
    <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">Gestión de Descargas</p>
  </div>`;
  const footer = `<div style="padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
    ${contactPhone ? `Teléfono de contacto: <strong>${contactPhone}</strong><br>` : ""}
    Centro Hogar Sánchez — Sistema de Gestión de Citas
  </div>`;
  const wrap = (body: string) => `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmar Cita</title></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;"><div style="max-width:500px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">${header}<div style="padding:24px;">${body}</div>${footer}</div></body></html>`;

  if (status === "error" || !appt) {
    return wrap(`<div style="text-align:center;padding:20px 0;"><p style="font-size:18px;color:#dc2626;font-weight:600;">Enlace no válido</p><p style="color:#64748b;">Este enlace no es válido o ha expirado. Si necesitas ayuda, contacta con el almacén.</p></div>`);
  }

  const dateStr = formatInTimeZone(appt.startUtc, "Europe/Madrid", "dd/MM/yyyy");
  const startTime = formatInTimeZone(appt.startUtc, "Europe/Madrid", "HH:mm");
  const endTime = formatInTimeZone(appt.endUtc, "Europe/Madrid", "HH:mm");
  const sizeLabel = appt.size === "S" ? "Pequeña" : appt.size === "M" ? "Mediana" : appt.size === "L" ? "Grande" : "";
  const summary = `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Proveedor</td><td style="padding:10px;border:1px solid #e2e8f0;">${appt.providerName}</td></tr>
    <tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Fecha</td><td style="padding:10px;border:1px solid #e2e8f0;">${dateStr}</td></tr>
    <tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Horario</td><td style="padding:10px;border:1px solid #e2e8f0;">${startTime} — ${endTime}</td></tr>
    ${appt.goodsType ? `<tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Mercancía</td><td style="padding:10px;border:1px solid #e2e8f0;">${appt.goodsType}</td></tr>` : ""}
    ${sizeLabel ? `<tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Tamaño</td><td style="padding:10px;border:1px solid #e2e8f0;">${sizeLabel}</td></tr>` : ""}
  </table>`;

  if (status === "confirmed") {
    const confirmedDate = appt.confirmedAt ? formatInTimeZone(appt.confirmedAt, "Europe/Madrid", "dd/MM/yyyy HH:mm") : "";
    return wrap(`<div style="text-align:center;padding:8px 0;"><p style="font-size:24px;margin:0;">✅</p><p style="font-size:18px;color:#16a34a;font-weight:600;margin:8px 0;">Cita confirmada</p></div>${summary}<p style="text-align:center;color:#16a34a;font-weight:600;">¡Nos vemos el ${dateStr}!</p>${confirmedDate ? `<p style="text-align:center;font-size:12px;color:#94a3b8;">Confirmada el ${confirmedDate}</p>` : ""}`);
  }

  if (status === "cancelled") {
    const cancelledDate = appt.cancelledAt ? formatInTimeZone(appt.cancelledAt, "Europe/Madrid", "dd/MM/yyyy HH:mm") : "";
    return wrap(`<div style="text-align:center;padding:8px 0;"><p style="font-size:24px;margin:0;">❌</p><p style="font-size:18px;color:#dc2626;font-weight:600;margin:8px 0;">Cita anulada</p></div>${summary}${appt.cancellationReason ? `<p style="color:#64748b;font-size:13px;"><strong>Motivo:</strong> ${appt.cancellationReason}</p>` : ""}<p style="text-align:center;color:#64748b;">Si necesitas reprogramar, contacta con el almacén.</p>${cancelledDate ? `<p style="text-align:center;font-size:12px;color:#94a3b8;">Anulada el ${cancelledDate}</p>` : ""}`);
  }

  // Pending — show confirm/cancel buttons
  const token = appt.confirmationToken;
  return wrap(`<p style="font-size:16px;margin:0 0 16px;"><strong>Datos de tu cita:</strong></p>${summary}
    <div id="actions">
      <div style="text-align:center;margin:24px 0;">
        <button onclick="doAction('confirm')" style="display:block;width:100%;background:#16a34a;color:#fff;border:none;padding:16px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:12px;min-height:48px;">✅ Confirmo mi cita</button>
        <button onclick="showCancel()" style="display:block;width:100%;background:#dc2626;color:#fff;border:none;padding:16px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;min-height:48px;">❌ Necesito anular</button>
      </div>
    </div>
    <div id="cancel-form" style="display:none;margin:16px 0;">
      <p style="font-weight:600;margin-bottom:8px;">¿Por qué necesitas anular? (opcional)</p>
      <textarea id="cancel-reason" rows="3" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;box-sizing:border-box;" placeholder="Motivo de la anulación..."></textarea>
      <button onclick="doAction('cancel')" style="display:block;width:100%;background:#dc2626;color:#fff;border:none;padding:14px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:12px;">Confirmar anulación</button>
      <button onclick="hideCancel()" style="display:block;width:100%;background:#e2e8f0;color:#475569;border:none;padding:12px;border-radius:8px;font-size:14px;cursor:pointer;margin-top:8px;">Volver</button>
    </div>
    <div id="result" style="display:none;text-align:center;padding:20px 0;"></div>
    <script>
      function showCancel(){document.getElementById('actions').style.display='none';document.getElementById('cancel-form').style.display='block';}
      function hideCancel(){document.getElementById('actions').style.display='block';document.getElementById('cancel-form').style.display='none';}
      function doAction(action){
        var reason=action==='cancel'?document.getElementById('cancel-reason').value:'';
        document.getElementById('actions').style.display='none';
        document.getElementById('cancel-form').style.display='none';
        document.getElementById('result').style.display='block';
        document.getElementById('result').innerHTML='<p style="color:#64748b;">Procesando...</p>';
        fetch('/api/appointments/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'${token}',action:action,reason:reason||undefined})})
        .then(function(r){return r.json()})
        .then(function(d){
          if(d.success){
            if(action==='confirm'){document.getElementById('result').innerHTML='<p style="font-size:24px;">✅</p><p style="font-size:18px;color:#16a34a;font-weight:600;">¡Cita confirmada!</p><p style="color:#64748b;">Nos vemos el día de la descarga.</p>';}
            else{document.getElementById('result').innerHTML='<p style="font-size:24px;">❌</p><p style="font-size:18px;color:#dc2626;font-weight:600;">Cita anulada</p><p style="color:#64748b;">Hemos informado al almacén.</p>';}
          }else{document.getElementById('result').innerHTML='<p style="color:#dc2626;">'+d.error+'</p>';document.getElementById('actions').style.display='block';}
        })
        .catch(function(){document.getElementById('result').innerHTML='<p style="color:#dc2626;">Error de conexión. Inténtalo de nuevo.</p>';document.getElementById('actions').style.display='block';});
      }
    </script>`);
}

router.post("/api/chat/message", async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId and message are required" });
    }

    const { getBaseUrl } = await import("./utils/base-url");
    const baseUrl = getBaseUrl();
    
    const { AgentOrchestrator } = await import("./agent/orchestrator");
    const orchestrator = new AgentOrchestrator(sessionId, baseUrl);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    for await (const chunk of orchestrator.chat(message)) {
      const data = JSON.stringify(chunk);
      res.write(`data: ${data}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("[CHAT] Error:", error.message);

    // After flushHeaders(), headers are always sent — respond via SSE chunks
    const errorChunk = JSON.stringify({
      type: "error",
      content: "Lo siento, ha ocurrido un error. Inténtalo de nuevo.",
    });
    res.write(`data: ${errorChunk}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// Authentication
router.post("/api/auth/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTk = generateRefreshToken();
    await saveRefreshToken(user.id, refreshTk);

    const response: AuthResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };

    res.json({ ...response, refreshToken: refreshTk });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/auth/me", authenticateToken, (req: AuthRequest, res) => {
  res.json(req.user);
});

router.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const user = await validateRefreshToken(refreshToken);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, newRefreshToken);

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/logout", authenticateToken, async (req: AuthRequest, res) => {
  try {
    await clearRefreshToken(req.user!.id);
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/auth/change-password", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        refreshToken: null,
        refreshTokenExpires: null,
      },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Providers
router.get("/api/providers", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { name: "asc" },
    });
    res.json(providers);
  } catch (error) {
    console.error("Get providers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/providers", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createProviderSchema.parse(req.body);
    
    const provider = await prisma.provider.create({
      data,
    });

    logAudit({
      entityType: "PROVIDER",
      entityId: provider.id,
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: data as Record<string, unknown>,
    }).catch(() => {});

    res.status(201).json(provider);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Provider name already exists" });
    }
    console.error("Create provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/providers/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = updateProviderSchema.parse(req.body);

    const before = await prisma.provider.findUnique({ where: { id: req.params.id } });
    
    const provider = await prisma.provider.update({
      where: { id: req.params.id },
      data,
    });

    logAudit({
      entityType: "PROVIDER",
      entityId: provider.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: before ? computeChanges(before as any, provider as any) : (data as Record<string, unknown>),
    }).catch(() => {});

    res.json(provider);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Provider not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Provider name already exists" });
    }
    console.error("Update provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/providers/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    await prisma.provider.delete({
      where: { id: req.params.id },
    });

    logAudit({
      entityType: "PROVIDER",
      entityId: req.params.id,
      action: "DELETE",
      actorType: "USER",
      actorId: req.user?.id,
    }).catch(() => {});

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Provider not found" });
    }
    console.error("Delete provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Capacity Shifts
router.get("/api/capacity-shifts", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    
    const where: any = {};
    if (from || to) {
      where.AND = [];
      if (from) where.AND.push({ endUtc: { gte: new Date(from as string) } });
      if (to) where.AND.push({ startUtc: { lte: new Date(to as string) } });
    }

    const shifts = await prisma.capacityShift.findMany({
      where,
      orderBy: { startUtc: "asc" },
    });

    res.json(shifts);
  } catch (error) {
    console.error("Get capacity shifts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/capacity-shifts", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createCapacityShiftSchema.parse(req.body);
    
    const shift = await prisma.capacityShift.create({
      data: {
        startUtc: new Date(data.start),
        endUtc: new Date(data.end),
        workers: data.workers,
        forklifts: data.forklifts,
        docks: data.docks,
      },
    });

    res.status(201).json(shift);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create capacity shift error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/capacity-shifts/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = updateCapacityShiftSchema.parse(req.body);
    
    const updateData: any = {};
    if (data.start) updateData.startUtc = new Date(data.start);
    if (data.end) updateData.endUtc = new Date(data.end);
    if (data.workers !== undefined) updateData.workers = data.workers;
    if (data.forklifts !== undefined) updateData.forklifts = data.forklifts;
    if (data.docks !== undefined) updateData.docks = data.docks;

    const shift = await prisma.capacityShift.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(shift);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Capacity shift not found" });
    }
    console.error("Update capacity shift error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/capacity-shifts/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    await prisma.capacityShift.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Capacity shift not found" });
    }
    console.error("Delete capacity shift error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Slot Templates CRUD (ADMIN/PLANNER)
router.get("/api/slot-templates", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const templates = await prisma.slotTemplate.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    res.json(templates);
  } catch (error) {
    console.error("Get slot templates error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/slot-templates", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createSlotTemplateSchema.parse(req.body);

    const template = await prisma.slotTemplate.create({ data });

    logAudit({
      entityType: "SLOT_TEMPLATE",
      entityId: template.id,
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: data as Record<string, unknown>,
    }).catch(() => {});

    res.status(201).json(template);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create slot template error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/slot-templates/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = updateSlotTemplateSchema.parse(req.body);

    const before = await prisma.slotTemplate.findUnique({ where: { id: req.params.id } });

    const template = await prisma.slotTemplate.update({
      where: { id: req.params.id },
      data,
    });

    logAudit({
      entityType: "SLOT_TEMPLATE",
      entityId: template.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: before ? computeChanges(before as any, template as any) : (data as Record<string, unknown>),
    }).catch(() => {});

    res.json(template);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Slot template not found" });
    }
    console.error("Update slot template error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/slot-templates/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    await prisma.slotTemplate.delete({
      where: { id: req.params.id },
    });

    logAudit({
      entityType: "SLOT_TEMPLATE",
      entityId: req.params.id,
      action: "DELETE",
      actorType: "USER",
      actorId: req.user?.id,
    }).catch(() => {});

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Slot template not found" });
    }
    console.error("Delete slot template error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Slot Overrides CRUD (ADMIN/PLANNER)
router.get("/api/slot-overrides", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    let where: any = {};
    if (from || to) {
      // An override overlaps the [from, to] window if:
      //   - Its start date (date) is <= to  AND
      //   - Its effective end date (dateEnd ?? date) is >= from
      const conditions: any[] = [];
      if (to) conditions.push({ date: { lte: new Date(to as string) } });
      if (from) {
        const fromDate = new Date(from as string);
        conditions.push({
          OR: [
            { dateEnd: { gte: fromDate } },       // range override overlaps
            { dateEnd: null, date: { gte: fromDate } }, // single-day override in range
          ],
        });
      }
      if (conditions.length > 0) where.AND = conditions;
    }

    const overrides = await prisma.slotOverride.findMany({
      where,
      orderBy: { date: "asc" },
    });
    res.json(overrides);
  } catch (error) {
    console.error("Get slot overrides error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/slot-overrides", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createSlotOverrideSchema.parse(req.body);

    if (data.dateEnd && new Date(data.dateEnd) < new Date(data.date)) {
      return res.status(400).json({ error: "dateEnd must be >= date" });
    }

    const override = await prisma.slotOverride.create({
      data: {
        date: new Date(data.date),
        dateEnd: data.dateEnd ? new Date(data.dateEnd) : null,
        startTime: data.startTime,
        endTime: data.endTime,
        maxPoints: data.maxPoints,
        reason: data.reason,
      },
    });

    logAudit({
      entityType: "SLOT_OVERRIDE",
      entityId: override.id,
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: data as Record<string, unknown>,
    }).catch(() => {});

    res.status(201).json(override);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create slot override error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/slot-overrides/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = updateSlotOverrideSchema.parse(req.body);

    const before = await prisma.slotOverride.findUnique({ where: { id: req.params.id } });

    const updateData: any = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.dateEnd !== undefined) updateData.dateEnd = new Date(data.dateEnd);
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.maxPoints !== undefined) updateData.maxPoints = data.maxPoints;
    if (data.reason !== undefined) updateData.reason = data.reason;

    // Validate dateEnd >= date when both are being set or one is changing
    const effectiveDate = updateData.date || before?.date;
    const effectiveDateEnd = updateData.dateEnd !== undefined ? updateData.dateEnd : before?.dateEnd;
    if (effectiveDateEnd && effectiveDate && new Date(effectiveDateEnd) < new Date(effectiveDate)) {
      return res.status(400).json({ error: "dateEnd must be >= date" });
    }

    const override = await prisma.slotOverride.update({
      where: { id: req.params.id },
      data: updateData,
    });

    logAudit({
      entityType: "SLOT_OVERRIDE",
      entityId: override.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: before ? computeChanges(before as any, override as any) : (data as Record<string, unknown>),
    }).catch(() => {});

    res.json(override);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Slot override not found" });
    }
    console.error("Update slot override error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/slot-overrides/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    await prisma.slotOverride.delete({
      where: { id: req.params.id },
    });

    logAudit({
      entityType: "SLOT_OVERRIDE",
      entityId: req.params.id,
      action: "DELETE",
      actorType: "USER",
      actorId: req.user?.id,
    }).catch(() => {});

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Slot override not found" });
    }
    console.error("Delete slot override error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Slot availability for a date
router.get("/api/slots/availability", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { date, points } = req.query;
    if (!date) {
      return res.status(400).json({ error: "date parameter is required" });
    }

    const targetDate = new Date(date as string);
    const pointsNeeded = parseInt(points as string) || 1;

    const slots = await slotCapacityValidator.getSlotsForDate(targetDate);
    const result = [];

    for (const slot of slots) {
      const usage = await slotCapacityValidator.getSlotUsage(targetDate, slot.startTime);
      const available = slot.maxPoints - usage;
      result.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxPoints: slot.maxPoints,
        pointsUsed: usage,
        pointsAvailable: available,
        isOverride: slot.isOverride,
        reason: slot.reason || null,
        hasCapacity: available >= pointsNeeded,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Get slot availability error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Slot usage per day for calendar
router.get("/api/slots/usage", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to parameters are required" });
    }

    const startDate = new Date(from as string);
    const endDate = new Date(to as string);
    const results: Array<{ date: string; slots: Array<{ startTime: string; endTime: string; maxPoints: number; pointsUsed: number; pointsAvailable: number }> }> = [];

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      const slots = await slotCapacityValidator.getSlotsForDate(current);
      const daySlots = [];

      for (const slot of slots) {
        const pointsUsed = await slotCapacityValidator.getSlotUsage(current, slot.startTime);
        daySlots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxPoints: slot.maxPoints,
          pointsUsed,
          pointsAvailable: slot.maxPoints - pointsUsed,
        });
      }

      results.push({
        date: current.toISOString().split("T")[0],
        slots: daySlots,
      });

      current.setDate(current.getDate() + 1);
    }

    res.json(results);
  } catch (error) {
    console.error("Get slot usage error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Appointments
router.get("/api/appointments", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { from, to, providerId } = req.query;
    
    const where: any = {};
    if (from || to) {
      where.AND = [];
      if (from) where.AND.push({ endUtc: { gte: new Date(from as string) } });
      if (to) where.AND.push({ startUtc: { lte: new Date(to as string) } });
    }
    if (providerId) {
      where.providerId = providerId as string;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { startUtc: "asc" },
    });

    res.json(appointments);
  } catch (error) {
    console.error("Get appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/appointments", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createAppointmentSchema.parse(req.body);

    const est = resolveEstimationsForRoute(data.goodsType ?? null, data.units ?? null, data.lines ?? null, data.deliveryNotesCount ?? null);

    const { size, points: pointsUsed } = slotCapacityValidator.determineSizeAndPoints(data.workMinutesNeeded);
    const startDate = new Date(data.start);
    const slotDate = new Date(startDate);
    slotDate.setHours(0, 0, 0, 0);

    const result = await prisma.$transaction(async (tx) => {
      const resolvedSlotStart = await slotCapacityValidator.resolveSlotStartTime(startDate, tx);
      const slotStartTime = resolvedSlotStart || formatInTimeZone(startDate, 'Europe/Madrid', 'HH:mm');

      const slotValidation = await slotCapacityValidator.validateSlotCapacity(
        slotDate,
        slotStartTime,
        pointsUsed,
        undefined,
        tx
      );

      if (!slotValidation.valid) {
        return {
          conflict: {
            slotStartTime: slotValidation.slotStartTime,
            slotEndTime: slotValidation.slotEndTime || "",
            maxPoints: slotValidation.maxPoints,
            pointsUsed: slotValidation.pointsUsed,
            pointsNeeded: pointsUsed,
            message: slotValidation.error || "Slot sin capacidad disponible",
          },
        };
      }

      const appointment = await tx.appointment.create({
        data: {
          providerId: data.providerId,
          providerName: data.providerName,
          startUtc: new Date(data.start),
          endUtc: new Date(data.end),
          workMinutesNeeded: data.workMinutesNeeded,
          forkliftsNeeded: data.forkliftsNeeded,
          goodsType: data.goodsType,
          units: data.units,
          lines: est.lines,
          deliveryNotesCount: est.deliveryNotesCount,
          estimatedFields: est.estimatedFields.length > 0 ? JSON.stringify(est.estimatedFields) : null,
          externalRef: data.externalRef,
          providerEmail: data.providerEmail || null,
          providerPhone: data.providerPhone || null,
          size,
          pointsUsed,
          slotDate,
          slotStartTime: slotValidation.slotStartTime,
        },
      });

      return { appointment };
    }, { isolationLevel: "Serializable" });

    if ("conflict" in result) {
      return res.status(409).json({ error: "Slot capacity conflict", conflict: result.conflict });
    }

    // Send confirmation email to provider if email provided
    if (result.appointment.providerEmail) {
      sendAppointmentConfirmation(result.appointment.id).catch((e) =>
        console.error("[EMAIL] Provider confirmation error:", e)
      );
    }

    logAudit({
      entityType: "APPOINTMENT",
      entityId: result.appointment.id,
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: { providerName: data.providerName, start: data.start, end: data.end, size, pointsUsed },
    }).catch(() => {});

    sendAppointmentAlert("new_appointment", {
      providerName: result.appointment.providerName,
      startUtc: result.appointment.startUtc,
      endUtc: result.appointment.endUtc,
      size: result.appointment.size,
      pointsUsed: result.appointment.pointsUsed,
      goodsType: result.appointment.goodsType,
      workMinutesNeeded: result.appointment.workMinutesNeeded,
    }).catch((e) => console.error("[EMAIL] Alert error:", e));

    res.status(201).json(result.appointment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "External reference already exists" });
    }
    console.error("Create appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/appointments/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = updateAppointmentSchema.parse(req.body);
    
    const updateData: any = {};
    if (data.providerId !== undefined) updateData.providerId = data.providerId;
    if (data.providerName !== undefined) updateData.providerName = data.providerName;
    if (data.start) updateData.startUtc = new Date(data.start);
    if (data.end) updateData.endUtc = new Date(data.end);
    if (data.workMinutesNeeded !== undefined) updateData.workMinutesNeeded = data.workMinutesNeeded;
    if (data.forkliftsNeeded !== undefined) updateData.forkliftsNeeded = data.forkliftsNeeded;
    if (data.goodsType !== undefined) updateData.goodsType = data.goodsType;
    if (data.units !== undefined) updateData.units = data.units;
    if (data.lines !== undefined) updateData.lines = data.lines;
    if (data.deliveryNotesCount !== undefined) updateData.deliveryNotesCount = data.deliveryNotesCount;
    if (data.externalRef !== undefined) updateData.externalRef = data.externalRef;
    if (data.providerEmail !== undefined) updateData.providerEmail = data.providerEmail || null;
    if (data.providerPhone !== undefined) updateData.providerPhone = data.providerPhone || null;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findUnique({
        where: { id: req.params.id },
      });

      if (!current) {
        return { notFound: true };
      }

      const effectiveWorkMinutes = updateData.workMinutesNeeded ?? current.workMinutesNeeded;
      const effectiveStart = updateData.startUtc || current.startUtc;

      const { size, points: pointsUsed } = slotCapacityValidator.determineSizeAndPoints(effectiveWorkMinutes);
      const slotDate = new Date(effectiveStart);
      slotDate.setHours(0, 0, 0, 0);
      const resolvedSlotStart = await slotCapacityValidator.resolveSlotStartTime(effectiveStart, tx);
      const slotStartTime = resolvedSlotStart || formatInTimeZone(effectiveStart, 'Europe/Madrid', 'HH:mm');

      const slotValidation = await slotCapacityValidator.validateSlotCapacity(
        slotDate,
        slotStartTime,
        pointsUsed,
        req.params.id,
        tx
      );

      if (!slotValidation.valid) {
        return {
          conflict: {
            slotStartTime: slotValidation.slotStartTime,
            slotEndTime: slotValidation.slotEndTime || "",
            maxPoints: slotValidation.maxPoints,
            pointsUsed: slotValidation.pointsUsed,
            pointsNeeded: pointsUsed,
            message: slotValidation.error || "Slot sin capacidad disponible",
          },
        };
      }

      updateData.size = size;
      updateData.pointsUsed = pointsUsed;
      updateData.slotDate = slotDate;
      updateData.slotStartTime = slotValidation.slotStartTime;

      const appointment = await tx.appointment.update({
        where: { id: req.params.id },
        data: updateData,
      });

      return { appointment, before: current };
    }, { isolationLevel: "Serializable" });

    if ("notFound" in result) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if ("conflict" in result) {
      return res.status(409).json({ error: "Slot capacity conflict", conflict: result.conflict });
    }

    logAudit({
      entityType: "APPOINTMENT",
      entityId: result.appointment.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: result.before ? computeChanges(result.before as any, result.appointment as any) : null,
    }).catch(() => {});

    sendAppointmentAlert("updated_appointment", {
      providerName: result.appointment.providerName,
      startUtc: result.appointment.startUtc,
      endUtc: result.appointment.endUtc,
      size: result.appointment.size,
      pointsUsed: result.appointment.pointsUsed,
      goodsType: result.appointment.goodsType,
      workMinutesNeeded: result.appointment.workMinutesNeeded,
    }).catch((e) => console.error("[EMAIL] Alert error:", e));

    res.json(result.appointment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "External reference already exists" });
    }
    console.error("Update appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/appointments/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    await prisma.appointment.delete({
      where: { id: req.params.id },
    });

    logAudit({
      entityType: "APPOINTMENT",
      entityId: req.params.id,
      action: "DELETE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: { providerName: appointment.providerName, start: appointment.startUtc.toISOString() },
    }).catch(() => {});

    sendAppointmentAlert("deleted_appointment", {
      providerName: appointment.providerName,
      startUtc: appointment.startUtc,
      endUtc: appointment.endUtc,
      size: appointment.size,
      pointsUsed: appointment.pointsUsed,
      goodsType: appointment.goodsType,
      workMinutesNeeded: appointment.workMinutesNeeded,
    }).catch((e) => console.error("[EMAIL] Alert error:", e));

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Appointment not found" });
    }
    console.error("Delete appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get slot capacity for a specific time
router.get("/api/capacity/at-minute", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { minute } = req.query;

    if (!minute) {
      return res.status(400).json({ error: "Minute parameter required" });
    }

    const date = new Date(minute as string);
    const timeHHMM = formatInTimeZone(date, 'Europe/Madrid', 'HH:mm');
    const slot = await slotCapacityValidator.findSlotForTime(date, timeHHMM);

    if (!slot) {
      return res.json({ slotStartTime: null, slotEndTime: null, maxPoints: 0, pointsUsed: 0, pointsAvailable: 0 });
    }

    const pointsUsed = await slotCapacityValidator.getSlotUsage(date, slot.startTime);
    res.json({
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
      maxPoints: slot.maxPoints,
      pointsUsed,
      pointsAvailable: slot.maxPoints - pointsUsed,
    });
  } catch (error) {
    console.error("Get capacity at minute error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get warehouse capacity utilization for a date range (slot-based)
router.get("/api/capacity/utilization", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate parameters required" });
    }

    const from = new Date(startDate as string);
    const to = new Date(endDate as string);

    const current = new Date(from);
    current.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const allSlots: Array<{
      date: string;
      startTime: string;
      endTime: string;
      maxPoints: number;
      pointsUsed: number;
      pointsAvailable: number;
    }> = [];

    let totalMaxPoints = 0;
    let totalPointsUsed = 0;
    let peakSlot: { date: string; startTime: string; percentage: number } | null = null;

    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      const slots = await slotCapacityValidator.getSlotsForDate(current);

      for (const slot of slots) {
        const pointsUsed = await slotCapacityValidator.getSlotUsage(current, slot.startTime);
        const pointsAvailable = slot.maxPoints - pointsUsed;

        allSlots.push({
          date: dateStr,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxPoints: slot.maxPoints,
          pointsUsed,
          pointsAvailable,
        });

        totalMaxPoints += slot.maxPoints;
        totalPointsUsed += pointsUsed;

        if (slot.maxPoints > 0) {
          const pct = (pointsUsed / slot.maxPoints) * 100;
          if (!peakSlot || pct > peakSlot.percentage) {
            peakSlot = { date: dateStr, startTime: slot.startTime, percentage: parseFloat(pct.toFixed(1)) };
          }
        }
      }

      current.setDate(current.getDate() + 1);
    }

    // Count appointments in range
    const fromStart = new Date(from);
    fromStart.setHours(0, 0, 0, 0);
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);

    const appointmentCount = await prisma.appointment.count({
      where: {
        AND: [
          { startUtc: { lt: toEnd } },
          { endUtc: { gt: fromStart } },
        ],
      },
    });

    const utilizationPercentage = totalMaxPoints > 0
      ? parseFloat(((totalPointsUsed / totalMaxPoints) * 100).toFixed(1))
      : 0;

    res.json({
      appointmentCount,
      slots: allSlots,
      totalMaxPoints,
      totalPointsUsed,
      utilizationPercentage,
      peakSlot,
    });
  } catch (error: any) {
    console.error("Capacity utilization error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Quick capacity adjustment — lets warehouse managers adjust day capacity with one click
router.post("/api/capacity/quick-adjust", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const { date, level } = req.body;

    const validLevels = ["slightly_less", "much_less", "minimum", "slightly_more", "reset"] as const;
    if (!level || !validLevels.includes(level)) {
      return res.status(400).json({ error: `level must be one of: ${validLevels.join(", ")}` });
    }

    const targetDate = date ? new Date(date) : new Date();
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    targetDate.setHours(0, 0, 0, 0);

    const dayOfWeek = targetDate.getDay();

    // Get templates for this day of week
    const templates = await prisma.slotTemplate.findMany({
      where: { dayOfWeek, active: true },
      orderBy: { startTime: "asc" },
    });

    if (templates.length === 0) {
      return res.status(404).json({ error: "No hay franjas configuradas para este día" });
    }

    const dateStart = new Date(targetDate);
    const dateEnd = new Date(targetDate);
    dateEnd.setHours(23, 59, 59, 999);

    // Delete previous quick_adjust overrides for this date
    await prisma.slotOverride.deleteMany({
      where: {
        date: { gte: dateStart, lte: dateEnd },
        source: "quick_adjust",
      },
    });

    if (level === "reset") {
      // Clear cache so slot-validator picks up the change
      slotCapacityValidator.clearCache();

      await logAudit({
        entityType: "SLOT_OVERRIDE",
        entityId: targetDate.toISOString().split("T")[0],
        action: "DELETE",
        actorType: "USER",
        actorId: req.user?.id || null,
        changes: { level: "reset", date: targetDate.toISOString().split("T")[0] },
      });

      return res.json({
        date: targetDate.toISOString().split("T")[0],
        level: "reset",
        adjustedSlots: templates.map((t) => ({
          startTime: t.startTime,
          endTime: t.endTime,
          originalPoints: t.maxPoints,
          newPoints: t.maxPoints,
        })),
      });
    }

    const multipliers: Record<string, number> = {
      slightly_less: 0.75,
      much_less: 0.50,
      minimum: 0.25,
      slightly_more: 1.25,
    };

    const multiplier = multipliers[level];
    const adjustedSlots: Array<{ startTime: string; endTime: string; originalPoints: number; newPoints: number }> = [];

    for (const tpl of templates) {
      const newPoints = Math.max(1, Math.round(tpl.maxPoints * multiplier));

      await prisma.slotOverride.create({
        data: {
          date: targetDate,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          maxPoints: newPoints,
          reason: `Ajuste rápido: ${level}`,
          source: "quick_adjust",
        },
      });

      adjustedSlots.push({
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        originalPoints: tpl.maxPoints,
        newPoints,
      });
    }

    // Clear cache so slot-validator picks up the change
    slotCapacityValidator.clearCache();

    await logAudit({
      entityType: "SLOT_OVERRIDE",
      entityId: targetDate.toISOString().split("T")[0],
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id || null,
      changes: { level, date: targetDate.toISOString().split("T")[0], adjustedSlots },
    });

    res.json({
      date: targetDate.toISOString().split("T")[0],
      level,
      adjustedSlots,
    });
  } catch (error: any) {
    console.error("Quick adjust error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get today's capacity status — includes current quick-adjust level
router.get("/api/capacity/today-status", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dateParam = req.query.date as string | undefined;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const dayOfWeek = targetDate.getDay();

    const templates = await prisma.slotTemplate.findMany({
      where: { dayOfWeek, active: true },
      orderBy: { startTime: "asc" },
    });

    const dateStart = new Date(targetDate);
    const dateEnd = new Date(targetDate);
    dateEnd.setHours(23, 59, 59, 999);

    // Check for quick_adjust overrides
    const quickOverrides = await prisma.slotOverride.findMany({
      where: {
        date: { gte: dateStart, lte: dateEnd },
        source: "quick_adjust",
      },
    });

    // Determine the quick adjust level
    let quickAdjustLevel: "normal" | "slightly_less" | "much_less" | "minimum" | "slightly_more" = "normal";

    if (quickOverrides.length > 0 && templates.length > 0) {
      // Calculate average ratio of override maxPoints to template maxPoints
      let totalRatio = 0;
      let matchCount = 0;
      for (const ov of quickOverrides) {
        const tpl = templates.find((t) => t.startTime === ov.startTime);
        if (tpl && tpl.maxPoints > 0) {
          totalRatio += ov.maxPoints / tpl.maxPoints;
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const avgRatio = totalRatio / matchCount;
        // Map to closest level
        if (avgRatio <= 0.375) quickAdjustLevel = "minimum";        // ~0.25
        else if (avgRatio <= 0.625) quickAdjustLevel = "much_less";  // ~0.50
        else if (avgRatio <= 0.875) quickAdjustLevel = "slightly_less"; // ~0.75
        else if (avgRatio > 1.1) quickAdjustLevel = "slightly_more";   // ~1.25
        else quickAdjustLevel = "normal";
      }
    }

    // Get effective slots with usage
    const slots = await slotCapacityValidator.getSlotsForDate(targetDate);
    const slotsWithUsage = await Promise.all(
      slots.map(async (slot) => {
        const usedPoints = await slotCapacityValidator.getSlotUsage(targetDate, slot.startTime);
        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxPoints: slot.maxPoints,
          usedPoints,
          availablePoints: slot.maxPoints - usedPoints,
        };
      })
    );

    res.json({
      date: targetDate.toISOString().split("T")[0],
      quickAdjustLevel,
      slots: slotsWithUsage,
    });
  } catch (error: any) {
    console.error("Today status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Integration endpoints (for n8n, etc.)
router.post("/api/integration/appointments/upsert", integrationRateLimiter, authenticateJwtOrApiKey, async (req: AuthRequest, res) => {
  try {
    const data = upsertAppointmentSchema.parse(req.body);
    
    const result = await upsertAppointmentInternal({
      ...data,
      providerId: data.providerId ?? null,
      goodsType: data.goodsType ?? null,
      units: data.units ?? null,
      lines: data.lines ?? null,
      deliveryNotesCount: data.deliveryNotesCount ?? null,
    });
    
    if (!result.success) {
      return res.status(409).json({ success: false, error: "Capacity conflict", details: result.conflict });
    }

    const statusCode = result.action === "created" ? 201 : 200;
    res.status(statusCode).json({ success: true, data: { action: result.action, appointment: result.appointment } });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: "Invalid input", details: error.errors });
    }
    console.error("Upsert appointment error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/api/integration/calendar/parse", integrationRateLimiter, authenticateIntegration, async (req, res) => {
  try {
    let rawQuery: any;

    if (req.body.query !== undefined) {
      if (typeof req.body.query === "string") {
        try {
          rawQuery = JSON.parse(req.body.query);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: "Invalid JSON in query string",
            details: e instanceof Error ? e.message : "Unknown error"
          });
        }
      } else {
        rawQuery = req.body.query;
      }
    } else {
      rawQuery = req.body;
    }

    const parsed = rawCalendarQuerySchema.parse(rawQuery);

    const action = parsed.action.toLowerCase() === "availability" ? "availability" : "book";

    const normalized: NormalizedCalendarQuery = {
      action,
      from: parsed.from ?? "",
      to: parsed.to ?? "",
      duration_minutes: parsed.duration_minutes ?? 0,
      start: parsed.start ?? "",
      end: parsed.end ?? "",
      providerName: parsed.providerName ?? "",
      goodsType: parsed.goodsType ?? "",
      units: parsed.units ?? 0,
      lines: parsed.lines ?? 0,
      deliveryNotesCount: parsed.deliveryNotesCount ?? 0,
      workMinutesNeeded: parsed.workMinutesNeeded ?? 0,
      forkliftsNeeded: parsed.forkliftsNeeded ?? 0,
    };

    res.json({
      success: true,
      data: normalized
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Invalid calendar query",
        details: error.errors
      });
    }
    
    res.status(400).json({
      success: false,
      error: "Invalid JSON or unknown error",
      details: error.message || "Unknown error"
    });
  }
});

router.post("/api/integration/calendar/availability", integrationRateLimiter, authenticateIntegration, async (req, res) => {
  try {
    let rawQuery: any;
    if (req.body.query !== undefined) {
      if (typeof req.body.query === "string") {
        rawQuery = JSON.parse(req.body.query);
      } else {
        rawQuery = req.body.query;
      }
    } else {
      rawQuery = req.body;
    }

    if (!rawQuery.action) {
      rawQuery.action = "availability";
    }

    const parsed = rawCalendarQuerySchema.parse(rawQuery);
    const normalized: NormalizedCalendarQuery = {
      action: "availability",
      from: parsed.from ?? "",
      to: parsed.to ?? "",
      duration_minutes: parsed.duration_minutes ?? 0,
      start: parsed.start ?? "",
      end: parsed.end ?? "",
      providerName: parsed.providerName ?? "",
      goodsType: parsed.goodsType ?? "",
      units: parsed.units ?? 0,
      lines: parsed.lines ?? 0,
      deliveryNotesCount: parsed.deliveryNotesCount ?? 0,
      workMinutesNeeded: parsed.workMinutesNeeded ?? 0,
      forkliftsNeeded: parsed.forkliftsNeeded ?? 0,
    };

    if (!normalized.from || !normalized.to || !normalized.duration_minutes) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        details: "from, to, and duration_minutes are required"
      });
    }

    const fromDate = new Date(normalized.from);
    const toDate = new Date(normalized.to);
    const durationMinutes = normalized.duration_minutes;

    const size = slotCapacityValidator.determineSizeFromDuration(durationMinutes);
    const pointsNeeded = slotCapacityValidator.getPointsForSize(size);

    const availableSlots = await slotCapacityValidator.findAvailableSlots(fromDate, toDate, pointsNeeded);

    if (availableSlots.length === 0) {
      return res.json({
        success: false,
        error: "No availability",
        details: "No slots found for the given range and duration."
      });
    }

    const formattedSlots: Array<{ date: string; slotStartTime: string; slotEndTime: string; pointsAvailable: number; size: string }> = [];
    for (const day of availableSlots) {
      for (const slot of day.slots) {
        formattedSlots.push({
          date: day.date,
          slotStartTime: slot.startTime,
          slotEndTime: slot.endTime,
          pointsAvailable: slot.pointsAvailable,
          size,
        });
      }
    }

    res.json({
      success: true,
      slotsFound: formattedSlots.length,
      slots: formattedSlots,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Invalid calendar query",
        details: error.errors
      });
    }

    res.status(400).json({
      success: false,
      error: "Invalid request",
      details: error.message || "Unknown error"
    });
  }
});

router.post("/api/integration/calendar/book", integrationRateLimiter, authenticateIntegration, async (req, res) => {
  try {
    let rawQuery: any;
    if (req.body.query !== undefined) {
      if (typeof req.body.query === "string") {
        rawQuery = JSON.parse(req.body.query);
      } else {
        rawQuery = req.body.query;
      }
    } else {
      rawQuery = req.body;
    }

    if (!rawQuery.action) {
      rawQuery.action = "book";
    }

    const parsed = rawCalendarQuerySchema.parse(rawQuery);
    const normalized: NormalizedCalendarQuery = {
      action: "book",
      from: parsed.from ?? "",
      to: parsed.to ?? "",
      duration_minutes: parsed.duration_minutes ?? 0,
      start: parsed.start ?? "",
      end: parsed.end ?? "",
      providerName: parsed.providerName ?? "",
      goodsType: parsed.goodsType ?? "",
      units: parsed.units ?? 0,
      lines: parsed.lines ?? 0,
      deliveryNotesCount: parsed.deliveryNotesCount ?? 0,
      workMinutesNeeded: parsed.workMinutesNeeded ?? 0,
      forkliftsNeeded: parsed.forkliftsNeeded ?? 0,
    };

    if (!normalized.start || !normalized.end || !normalized.providerName) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        details: "start, end, and providerName are required"
      });
    }

    let provider = await prisma.provider.findFirst({
      where: { name: normalized.providerName },
    });
    if (!provider) {
      provider = await prisma.provider.create({
        data: { name: normalized.providerName },
      });
      logAudit({
        entityType: "PROVIDER",
        entityId: provider.id,
        action: "CREATE",
        actorType: "INTEGRATION",
        changes: { name: normalized.providerName, source: "calendar-book" },
      }).catch(() => {});
    }

    const externalRef = `n8n-${normalized.providerName}-${normalized.start}-${normalized.units}-${normalized.lines}`;

    const maxAttempts = 3;
    let currentStart = new Date(normalized.start);
    let currentEnd = new Date(normalized.end);
    let lastConflict = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await upsertAppointmentInternal({
        externalRef,
        providerId: provider.id,
        providerName: normalized.providerName,
        start: currentStart.toISOString(),
        end: currentEnd.toISOString(),
        workMinutesNeeded: normalized.workMinutesNeeded,
        forkliftsNeeded: normalized.forkliftsNeeded,
        goodsType: normalized.goodsType || null,
        units: normalized.units || null,
        lines: normalized.lines ? normalized.lines : null,
        deliveryNotesCount: normalized.deliveryNotesCount ? normalized.deliveryNotesCount : null,
      });

      if (result.success) {
        const appointment = result.appointment!;

        logAudit({
          entityType: "APPOINTMENT",
          entityId: appointment.id,
          action: result.action === "created" ? "CREATE" : "UPDATE",
          actorType: "INTEGRATION",
          changes: { providerName: normalized.providerName, start: currentStart.toISOString(), end: currentEnd.toISOString() },
        }).catch(() => {});

        const startLocal = formatToMadridLocal(currentStart);
        const endLocal = formatToMadridLocal(currentEnd);
        const duration = Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000);

        const confirmationHtml = `<b>Cita confirmada</b><br>Proveedor: ${normalized.providerName}<br>Tipo: ${normalized.goodsType}<br>Fecha: ${startLocal.split(',')[0]}<br>Hora: ${startLocal.split(', ')[1]}–${endLocal.split(', ')[1]} (duración: ${duration} min)<br>Muelles/Carretillas: validado`;

        return res.json({
          success: true,
          confirmationHtml,
          providerName: normalized.providerName,
          goodsType: normalized.goodsType,
          startLocal,
          endLocal,
          workMinutesNeeded: normalized.workMinutesNeeded,
          forkliftsNeeded: normalized.forkliftsNeeded,
          externalRef,
          id: appointment.id,
          size: appointment.size,
          pointsUsed: appointment.pointsUsed,
        });
      }

      lastConflict = result.conflict;
      currentStart = addMinutes(currentStart, 30);
      currentEnd = addMinutes(currentEnd, 30);
    }

    return res.status(409).json({
      success: false,
      error: "No availability",
      details: "All attempts resulted in time conflicts",
      lastConflict
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Invalid calendar booking request",
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message || "Unknown error"
    });
  }
});

router.get("/api/integration/appointments/by-external-ref/:externalRef", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { externalRef: req.params.externalRef },
    });

    if (!appointment) {
      return res.status(404).json({ success: false, error: "Appointment not found" });
    }

    res.json({ success: true, data: appointment });
  } catch (error) {
    console.error("Get appointment by external ref error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Users (admin only)
router.get("/api/users", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { email: "asc" },
    });

    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/users", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: "Email, password, and role are required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logAudit({
      entityType: "USER",
      entityId: user.id,
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: { email, role },
    }).catch(() => {});

    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/users/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { email, role } = req.body;

    const updateData: any = {};
    if (email) updateData.email = email;
    if (role) updateData.role = role;

    const before = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, role: true },
    });

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logAudit({
      entityType: "USER",
      entityId: user.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: before ? computeChanges(before as any, user as any) : updateData,
    }).catch(() => {});

    res.json(user);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/users/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    logAudit({
      entityType: "USER",
      entityId: req.params.id,
      action: "DELETE",
      actorType: "USER",
      actorId: req.user?.id,
    }).catch(() => {});

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Email Recipients CRUD (ADMIN only)
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

// Audit Log (ADMIN/PLANNER)
router.get("/api/audit-log", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const { entityType, action, actorType, from, to, limit, offset } = req.query;
    const take = Math.min(parseInt(limit as string) || 50, 200);
    const skip = parseInt(offset as string) || 0;

    const where: any = {};
    if (entityType) where.entityType = entityType as string;
    if (action) where.action = action as string;
    if (actorType) where.actorType = actorType as string;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, limit: take, offset: skip });
  } catch (error) {
    console.error("Get audit log error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Weekly slots with appointments — feeds the slot-based calendar
router.get("/api/slots/week", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dateParam = req.query.date as string | undefined;
    const refDate = dateParam ? new Date(dateParam) : new Date();
    if (isNaN(refDate.getTime())) {
      return res.status(400).json({ error: "Formato de fecha inválido" });
    }

    // Find Monday of the week containing refDate
    const day = refDate.getDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(refDate);
    monday.setDate(monday.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    // Generate Mon-Sat (6 days)
    const days: Date[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    const result: Array<{
      date: string;
      dayOfWeek: number;
      dayName: string;
      slots: Array<{
        startTime: string;
        endTime: string;
        maxPoints: number;
        usedPoints: number;
        availablePoints: number;
        appointments: Array<{
          id: string;
          providerName: string;
          goodsType: string | null;
          units: number | null;
          lines: number | null;
          deliveryNotesCount: number | null;
          size: string | null;
          pointsUsed: number | null;
          workMinutesNeeded: number;
          startUtc: string;
          endUtc: string;
          confirmationStatus: string;
          providerEmail: string | null;
          providerPhone: string | null;
        }>;
      }>;
    }> = [];

    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    for (const dayDate of days) {
      const dateStr = dayDate.toISOString().split("T")[0];
      const slots = await slotCapacityValidator.getSlotsForDate(dayDate);

      const dateStart = new Date(dayDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(dayDate);
      dateEnd.setHours(23, 59, 59, 999);

      // Fetch all appointments for this day at once
      const dayAppointments = await prisma.appointment.findMany({
        where: {
          slotDate: { gte: dateStart, lte: dateEnd },
        },
        orderBy: { startUtc: "asc" },
      });

      const slotResults = [];
      for (const slot of slots) {
        const slotAppts = dayAppointments.filter(
          (a) => a.slotStartTime === slot.startTime
        );
        const usedPoints = slotAppts.reduce((sum, a) => sum + (a.pointsUsed || 0), 0);

        slotResults.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxPoints: slot.maxPoints,
          usedPoints,
          availablePoints: slot.maxPoints - usedPoints,
          appointments: slotAppts.map((a) => ({
            id: a.id,
            providerName: a.providerName,
            goodsType: a.goodsType,
            units: a.units,
            lines: a.lines,
            deliveryNotesCount: a.deliveryNotesCount,
            size: a.size,
            pointsUsed: a.pointsUsed,
            workMinutesNeeded: a.workMinutesNeeded,
            startUtc: a.startUtc.toISOString(),
            endUtc: a.endUtc.toISOString(),
            confirmationStatus: a.confirmationStatus,
            providerEmail: a.providerEmail,
            providerPhone: a.providerPhone,
          })),
        });
      }

      result.push({
        date: dateStr,
        dayOfWeek: dayDate.getDay(),
        dayName: dayNames[dayDate.getDay()],
        slots: slotResults,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Get slots/week error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Estimation ratios config (read-only)
router.get("/api/config/estimation-ratios", authenticateToken, requireRole("ADMIN"), async (_req: AuthRequest, res) => {
  res.json(ESTIMATION_RATIOS);
});

// Provider email config
router.get("/api/config/provider-emails", authenticateToken, requireRole("ADMIN"), async (_req: AuthRequest, res) => {
  try {
    const keys = ["confirmation_email_enabled", "reminder_email_enabled", "provider_email_extra_text", "provider_email_contact_phone"];
    const configs = await prisma.appConfig.findMany({ where: { key: { in: keys } } });
    const result: Record<string, string> = {};
    for (const k of keys) {
      const found = configs.find(c => c.key === k);
      result[k] = found?.value ?? "";
    }
    res.json(result);
  } catch (error) {
    console.error("Get provider email config error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/config/provider-emails", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const allowedKeys = ["confirmation_email_enabled", "reminder_email_enabled", "provider_email_extra_text", "provider_email_contact_phone"];
    const updates: Array<{ key: string; value: string }> = [];
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updates.push({ key, value: String(req.body[key]) });
      }
    }
    for (const { key, value } of updates) {
      await prisma.appConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Update provider email config error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Resend confirmation email
router.post("/api/appointments/:id/resend-confirmation", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (!appt.providerEmail) return res.status(400).json({ error: "No provider email on this appointment" });

    const sent = await sendAppointmentConfirmation(appt.id);
    if (sent) {
      res.json({ success: true, sentTo: appt.providerEmail });
    } else {
      res.status(500).json({ error: "Failed to send email" });
    }
  } catch (error) {
    console.error("Resend confirmation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reactivate cancelled appointment
router.post("/api/appointments/:id/reactivate", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (appt.confirmationStatus !== "cancelled") return res.status(400).json({ error: "Only cancelled appointments can be reactivated" });

    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: { confirmationStatus: "pending", cancelledAt: null, cancellationReason: null },
    });

    logAudit({
      entityType: "APPOINTMENT",
      entityId: appt.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: { confirmationStatus: { from: "cancelled", to: "pending" } },
    }).catch(() => {});

    res.json(updated);
  } catch (error) {
    console.error("Reactivate appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
