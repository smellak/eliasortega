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
} from "../shared/types";
import { authenticateToken, requireRole, generateToken, generateRefreshToken, saveRefreshToken, validateRefreshToken, clearRefreshToken, AuthRequest } from "./middleware/auth";
import { capacityValidator } from "./services/capacity-validator";
import { slotCapacityValidator } from "./services/slot-validator";
import { logAudit, computeChanges } from "./services/audit-service";
import { sendAppointmentAlert, sendTestEmail } from "./services/email-service";
import { prisma } from "./db/client";
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes, setHours, setMinutes, setSeconds, setMilliseconds, isWeekend, addDays } from 'date-fns';
import type { Request, Response, NextFunction } from "express";

const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY || "";

function authenticateIntegration(req: Request, res: Response, next: NextFunction) {
  if (!INTEGRATION_API_KEY) {
    return res.status(403).json({ error: "Integration API is disabled. Set INTEGRATION_API_KEY to enable." });
  }
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey || apiKey !== INTEGRATION_API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
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
    return res.status(429).json({ error: "Too many requests. Limit: 50 req/min for integration endpoints." });
  }

  next();
}

function formatToMadridLocal(date: Date): string {
  return formatInTimeZone(date, 'Europe/Madrid', 'dd/MM/yyyy, HH:mm');
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
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findUnique({
      where: { externalRef: data.externalRef },
    });

    const size = slotCapacityValidator.determineSizeFromDuration(data.workMinutesNeeded);
    const pointsUsed = slotCapacityValidator.getPointsForSize(size);
    const startDate = new Date(data.start);
    const slotDate = new Date(startDate);
    slotDate.setHours(0, 0, 0, 0);
    const slotStartTime = formatInTimeZone(startDate, 'Europe/Madrid', 'HH:mm');

    if (existing) {
      const conflict = await capacityValidator.validateAppointment({
        id: existing.id,
        startUtc: new Date(data.start),
        endUtc: new Date(data.end),
        workMinutesNeeded: data.workMinutesNeeded,
        forkliftsNeeded: data.forkliftsNeeded,
      }, tx);

      if (conflict) {
        return { success: false as const, conflict };
      }

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
          lines: data.lines,
          deliveryNotesCount: data.deliveryNotesCount,
          size,
          pointsUsed,
          slotDate,
          slotStartTime,
        },
      });

      return { success: true as const, action: "updated" as const, appointment };
    }

    const conflict = await capacityValidator.validateAppointment({
      startUtc: new Date(data.start),
      endUtc: new Date(data.end),
      workMinutesNeeded: data.workMinutesNeeded,
      forkliftsNeeded: data.forkliftsNeeded,
    }, tx);

    if (conflict) {
      return { success: false as const, conflict };
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
        lines: data.lines,
        deliveryNotesCount: data.deliveryNotesCount,
        externalRef: data.externalRef,
        size,
        pointsUsed,
        slotDate,
        slotStartTime,
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

router.post("/api/chat/message", async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId and message are required" });
    }

    const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
    
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
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      const errorChunk = JSON.stringify({
        type: "error",
        content: "Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.",
      });
      res.write(`data: ${errorChunk}\n\n`);
      res.end();
    }
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
    const where: any = {};
    if (from || to) {
      where.AND = [];
      if (from) where.AND.push({ date: { gte: new Date(from as string) } });
      if (to) where.AND.push({ date: { lte: new Date(to as string) } });
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

    const override = await prisma.slotOverride.create({
      data: {
        date: new Date(data.date),
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
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.maxPoints !== undefined) updateData.maxPoints = data.maxPoints;
    if (data.reason !== undefined) updateData.reason = data.reason;

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

    const size = slotCapacityValidator.determineSizeFromDuration(data.workMinutesNeeded);
    const pointsUsed = slotCapacityValidator.getPointsForSize(size);
    const startDate = new Date(data.start);
    const slotDate = new Date(startDate);
    slotDate.setHours(0, 0, 0, 0);
    const slotStartTime = formatInTimeZone(startDate, 'Europe/Madrid', 'HH:mm');
    
    const result = await prisma.$transaction(async (tx) => {
      const conflict = await capacityValidator.validateAppointment({
        startUtc: new Date(data.start),
        endUtc: new Date(data.end),
        workMinutesNeeded: data.workMinutesNeeded,
        forkliftsNeeded: data.forkliftsNeeded,
      }, tx);

      if (conflict) {
        return { conflict };
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
          lines: data.lines,
          deliveryNotesCount: data.deliveryNotesCount,
          externalRef: data.externalRef,
          size,
          pointsUsed,
          slotDate,
          slotStartTime,
        },
      });

      return { appointment };
    }, { isolationLevel: "Serializable" });

    if ("conflict" in result) {
      return res.status(409).json({ error: "Capacity conflict", conflict: result.conflict });
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

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findUnique({
        where: { id: req.params.id },
      });

      if (!current) {
        return { notFound: true };
      }

      const effectiveWorkMinutes = updateData.workMinutesNeeded ?? current.workMinutesNeeded;
      const effectiveStart = updateData.startUtc || current.startUtc;

      const size = slotCapacityValidator.determineSizeFromDuration(effectiveWorkMinutes);
      const pointsUsed = slotCapacityValidator.getPointsForSize(size);
      const slotDate = new Date(effectiveStart);
      slotDate.setHours(0, 0, 0, 0);
      const slotStartTime = formatInTimeZone(effectiveStart, 'Europe/Madrid', 'HH:mm');

      updateData.size = size;
      updateData.pointsUsed = pointsUsed;
      updateData.slotDate = slotDate;
      updateData.slotStartTime = slotStartTime;

      const conflict = await capacityValidator.validateAppointment({
        id: req.params.id,
        startUtc: updateData.startUtc || current.startUtc,
        endUtc: updateData.endUtc || current.endUtc,
        workMinutesNeeded: updateData.workMinutesNeeded ?? current.workMinutesNeeded,
        forkliftsNeeded: updateData.forkliftsNeeded ?? current.forkliftsNeeded,
      }, tx);

      if (conflict) {
        return { conflict };
      }

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
      return res.status(409).json({ error: "Capacity conflict", conflict: result.conflict });
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

// Get real-time capacity for a specific minute
router.get("/api/capacity/at-minute", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { minute } = req.query;
    
    if (!minute) {
      return res.status(400).json({ error: "Minute parameter required" });
    }

    const capacity = await capacityValidator.getCapacityAtMinute(new Date(minute as string));
    res.json(capacity);
  } catch (error) {
    console.error("Get capacity at minute error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get warehouse capacity utilization for a date range
router.get("/api/capacity/utilization", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate parameters required" });
    }

    const utilization = await capacityValidator.calculateUtilization(
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json(utilization);
  } catch (error: any) {
    console.error("Capacity utilization error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Integration endpoints (for n8n, etc.)
router.post("/api/integration/appointments/upsert", authenticateToken, async (req: AuthRequest, res) => {
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
      return res.status(409).json({ error: "Capacity conflict", conflict: result.conflict });
    }
    
    const statusCode = result.action === "created" ? 201 : 200;
    res.status(statusCode).json({ action: result.action, appointment: result.appointment });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Upsert appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
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
        lines: normalized.lines || null,
        deliveryNotesCount: normalized.deliveryNotesCount || null,
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
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json(appointment);
  } catch (error) {
    console.error("Get appointment by external ref error:", error);
    res.status(500).json({ error: "Internal server error" });
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
    const { email, name, receivesDailySummary, receivesAlerts, receivesUrgent } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "email and name are required" });
    }
    const recipient = await prisma.emailRecipient.create({
      data: {
        email,
        name,
        receivesDailySummary: receivesDailySummary ?? true,
        receivesAlerts: receivesAlerts ?? true,
        receivesUrgent: receivesUrgent ?? true,
      },
    });
    res.status(201).json(recipient);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Create email recipient error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/email-recipients/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { email, name, receivesDailySummary, receivesAlerts, receivesUrgent, active } = req.body;
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (receivesDailySummary !== undefined) updateData.receivesDailySummary = receivesDailySummary;
    if (receivesAlerts !== undefined) updateData.receivesAlerts = receivesAlerts;
    if (receivesUrgent !== undefined) updateData.receivesUrgent = receivesUrgent;
    if (active !== undefined) updateData.active = active;

    const recipient = await prisma.emailRecipient.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(recipient);
  } catch (error: any) {
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

export default router;
