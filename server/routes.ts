import { Router } from "express";
import { PrismaClient } from "@prisma/client";
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
} from "../shared/types";
import { authenticateToken, requireRole, generateToken, AuthRequest } from "./middleware/auth";
import { capacityValidator } from "./services/capacity-validator";
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes, setHours, setMinutes, setSeconds, setMilliseconds, isWeekend, addDays } from 'date-fns';

const prisma = new PrismaClient();

// Helper: Format date to Europe/Madrid local string
function formatToMadridLocal(date: Date): string {
  return formatInTimeZone(date, 'Europe/Madrid', 'dd/MM/yyyy, HH:mm');
}

// Helper: Internal upsert logic (reusable)
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
  const existing = await prisma.appointment.findUnique({
    where: { externalRef: data.externalRef },
  });

  if (existing) {
    const conflict = await capacityValidator.validateAppointment({
      id: existing.id,
      startUtc: new Date(data.start),
      endUtc: new Date(data.end),
      workMinutesNeeded: data.workMinutesNeeded,
      forkliftsNeeded: data.forkliftsNeeded,
    });

    if (conflict) {
      return { success: false, conflict };
    }

    const appointment = await prisma.appointment.update({
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
      },
    });

    return { success: true, action: "updated", appointment };
  }

  const conflict = await capacityValidator.validateAppointment({
    startUtc: new Date(data.start),
    endUtc: new Date(data.end),
    workMinutesNeeded: data.workMinutesNeeded,
    forkliftsNeeded: data.forkliftsNeeded,
  });

  if (conflict) {
    return { success: false, conflict };
  }

  const appointment = await prisma.appointment.create({
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
    },
  });

  return { success: true, action: "created", appointment };
}
const router = Router();

// Public routes - NO authentication required
// Serve logo (keep for legacy n8n chat.html if needed)
router.get("/logo-sanchez.png", (req, res) => {
  res.sendFile(path.join(process.cwd(), "client/public/logo-sanchez.png"));
});

// Health check
router.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Chat API - Public endpoint with SSE streaming
router.post("/api/chat/message", async (req, res) => {
  console.log("[CHAT API] Received request:", { sessionId: req.body.sessionId, hasMessage: !!req.body.message });
  
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
      console.log("[CHAT API] Missing required fields");
      return res.status(400).json({ error: "sessionId and message are required" });
    }

    // Always use localhost for internal API calls to avoid routing issues
    const baseUrl = "http://localhost:5000";
    console.log("[CHAT API] Base URL:", baseUrl);
    
    console.log("[CHAT API] Importing AgentOrchestrator...");
    const { AgentOrchestrator } = await import("./agent/orchestrator");
    console.log("[CHAT API] Creating orchestrator instance...");
    const orchestrator = new AgentOrchestrator(sessionId, baseUrl);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    console.log("[CHAT API] Starting chat stream...");
    let chunkCount = 0;
    for await (const chunk of orchestrator.chat(message)) {
      chunkCount++;
      console.log(`[CHAT API] Chunk ${chunkCount}:`, chunk.type);
      const data = JSON.stringify(chunk);
      res.write(`data: ${data}\n\n`);
    }

    console.log(`[CHAT API] Chat completed. Total chunks: ${chunkCount}`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("[CHAT API] Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error", details: error.message });
    } else {
      const errorChunk = JSON.stringify({
        type: "error",
        content: `Error: ${error.message}`,
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

    // Debug logging for production troubleshooting
    console.log("[LOGIN] Token generated successfully for user:", {
      email: user.email,
      role: user.role,
      tokenPreview: token.substring(0, 20) + "...",
      tokenLength: token.length,
    });

    const response: AuthResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };

    res.json(response);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user
router.get("/api/auth/me", authenticateToken, (req: AuthRequest, res) => {
  res.json(req.user);
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
    
    const provider = await prisma.provider.update({
      where: { id: req.params.id },
      data,
    });

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
    console.log("[DEBUG] Received capacity-shift request body:", JSON.stringify(req.body, null, 2));
    const data = createCapacityShiftSchema.parse(req.body);
    console.log("[DEBUG] Parsed successfully:", JSON.stringify(data, null, 2));
    
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
      console.log("[DEBUG] Zod validation error:", JSON.stringify(error.errors, null, 2));
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
    console.log("[DEBUG] Received appointment request body:", JSON.stringify(req.body, null, 2));
    const data = createAppointmentSchema.parse(req.body);
    console.log("[DEBUG] Parsed successfully:", JSON.stringify(data, null, 2));
    
    // Validate capacity
    const conflict = await capacityValidator.validateAppointment({
      startUtc: new Date(data.start),
      endUtc: new Date(data.end),
      workMinutesNeeded: data.workMinutesNeeded,
      forkliftsNeeded: data.forkliftsNeeded,
    });

    if (conflict) {
      return res.status(409).json({ error: "Capacity conflict", conflict });
    }

    const appointment = await prisma.appointment.create({
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
      },
    });

    res.status(201).json(appointment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      console.log("[DEBUG] Zod validation error:", JSON.stringify(error.errors, null, 2));
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
    
    // Build update data
    const updateData: any = {};
    if (data.providerId !== undefined) updateData.providerId = data.providerId;
    if (data.providerName) updateData.providerName = data.providerName;
    if (data.start) updateData.startUtc = new Date(data.start);
    if (data.end) updateData.endUtc = new Date(data.end);
    if (data.workMinutesNeeded !== undefined) updateData.workMinutesNeeded = data.workMinutesNeeded;
    if (data.forkliftsNeeded !== undefined) updateData.forkliftsNeeded = data.forkliftsNeeded;
    if (data.goodsType !== undefined) updateData.goodsType = data.goodsType;
    if (data.units !== undefined) updateData.units = data.units;
    if (data.lines !== undefined) updateData.lines = data.lines;
    if (data.deliveryNotesCount !== undefined) updateData.deliveryNotesCount = data.deliveryNotesCount;
    if (data.externalRef !== undefined) updateData.externalRef = data.externalRef;

    // Get current appointment to merge with updates for validation
    const current = await prisma.appointment.findUnique({
      where: { id: req.params.id },
    });

    if (!current) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Validate capacity with updated values
    const conflict = await capacityValidator.validateAppointment({
      id: req.params.id,
      startUtc: updateData.startUtc || current.startUtc,
      endUtc: updateData.endUtc || current.endUtc,
      workMinutesNeeded: updateData.workMinutesNeeded ?? current.workMinutesNeeded,
      forkliftsNeeded: updateData.forkliftsNeeded ?? current.forkliftsNeeded,
    });

    if (conflict) {
      return res.status(409).json({ error: "Capacity conflict", conflict });
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(appointment);
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
    await prisma.appointment.delete({
      where: { id: req.params.id },
    });

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

// Integration endpoints (for n8n, etc.)
router.post("/api/integration/appointments/upsert", authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log("[UPSERT] Received request body:", JSON.stringify(req.body, null, 2));
    const data = upsertAppointmentSchema.parse(req.body);
    console.log("[UPSERT] Parsed successfully:", JSON.stringify(data, null, 2));
    
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
      console.log("[UPSERT] Zod validation error:", JSON.stringify(error.errors, null, 2));
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Upsert appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Calendar parse endpoint (for n8n calendar subagent) - PUBLIC, no auth required
router.post("/api/integration/calendar/parse", async (req, res) => {
  try {
    // Parse the incoming body - handle both query wrapper and direct object
    let rawQuery: any;

    if (req.body.query !== undefined) {
      // Case 1: { query: "..." } or { query: {...} }
      if (typeof req.body.query === "string") {
        // String JSON - parse it
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
        // Already an object
        rawQuery = req.body.query;
      }
    } else {
      // Case 2: Direct object without query wrapper
      rawQuery = req.body;
    }

    // Validate with Zod
    const parsed = rawCalendarQuerySchema.parse(rawQuery);

    // Normalize the data
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

// Calendar availability endpoint - PUBLIC, no auth required
router.post("/api/integration/calendar/availability", async (req, res) => {
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

    // Ensure action field is present
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

    const slots: Array<{
      start: string;
      end: string;
      startLocal: string;
      endLocal: string;
    }> = [];

    let currentDate = new Date(fromDate);

    // Search for slots up to 3 days from fromDate
    const maxSearchDays = 3;
    let daysSearched = 0;

    while (slots.length < 3 && daysSearched < maxSearchDays) {
      if (!isWeekend(currentDate)) {
        // Operating hours: 08:00-14:00 Europe/Madrid
        let workDayStart = setMilliseconds(setSeconds(setMinutes(setHours(currentDate, 8), 0), 0), 0);
        const workDayEnd = setMilliseconds(setSeconds(setMinutes(setHours(currentDate, 14), 0), 0), 0);

        while (workDayStart.getTime() + durationMinutes * 60 * 1000 <= workDayEnd.getTime()) {
          const slotEnd = addMinutes(workDayStart, durationMinutes);

          // Check capacity for this slot
          const conflict = await capacityValidator.validateAppointment({
            startUtc: workDayStart,
            endUtc: slotEnd,
            workMinutesNeeded: normalized.workMinutesNeeded || durationMinutes,
            forkliftsNeeded: normalized.forkliftsNeeded || 1,
          });

          if (!conflict) {
            slots.push({
              start: workDayStart.toISOString(),
              end: slotEnd.toISOString(),
              startLocal: formatToMadridLocal(workDayStart),
              endLocal: formatToMadridLocal(slotEnd),
            });

            if (slots.length >= 3) break;
          }

          workDayStart = addMinutes(workDayStart, 15);
        }
      }

      currentDate = addDays(currentDate, 1);
      daysSearched++;
    }

    if (slots.length === 0) {
      return res.json({
        success: false,
        error: "No availability",
        details: "No slots found for the given range and duration."
      });
    }

    res.json({
      success: true,
      slotsFound: slots.length,
      slots
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

// Calendar book endpoint - PUBLIC, no auth required
router.post("/api/integration/calendar/book", async (req, res) => {
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

    // Ensure action field is present
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

    // Generate deterministic externalRef
    const externalRef = `n8n-${normalized.providerName}-${normalized.start}-${normalized.units}-${normalized.lines}`;

    // Retry logic: 3 attempts with 30-minute increments
    const maxAttempts = 3;
    let currentStart = new Date(normalized.start);
    let currentEnd = new Date(normalized.end);
    let lastConflict = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await upsertAppointmentInternal({
        externalRef,
        providerId: null,
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
        const startLocal = formatToMadridLocal(currentStart);
        const endLocal = formatToMadridLocal(currentEnd);
        const duration = Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000);

        const confirmationHtml = `<b>Cita confirmada</b><br>Proveedor: ${normalized.providerName}<br>Tipo: ${normalized.goodsType}<br>Fecha: ${startLocal.split(',')[0]}<br>Hora: ${startLocal.split(', ')[1]}–${endLocal.split(', ')[1]} (duración: ${duration} min)<br>Muelles/Carretillas: validado ✅`;

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

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
