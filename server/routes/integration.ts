import { Router } from "express";
import { prisma } from "../db/client";
import {
  upsertAppointmentSchema,
  rawCalendarQuerySchema,
  NormalizedCalendarQuery,
} from "../../shared/types";
import { authenticateToken, authenticateJwtOrApiKey, AuthRequest } from "../middleware/auth";
import { authenticateIntegration, integrationRateLimiter } from "../middleware/rate-limiting";
import { slotCapacityValidator } from "../services/slot-validator";
import { logAudit } from "../services/audit-service";
import { sendAppointmentConfirmation } from "../services/provider-email-service";
import { getMadridDayOfWeek, getMadridMidnight, getMadridDateStr } from "../utils/madrid-date";
import { formatInTimeZone } from "date-fns-tz";
import { addMinutes, setHours, setMinutes, setSeconds, setMilliseconds, isWeekend, addDays } from "date-fns";
import { normalizeCategory, estimateLines, estimateDeliveryNotes } from "../config/estimation-ratios";
import {
  upsertAppointmentInternal,
  normalizeAppointmentResponse,
  resolveEstimationsForRoute,
  findAppointmentsWithDockFallback,
  formatToMadridLocal,
} from "../helpers/appointment-helpers";

const router = Router();

// ── POST /api/integration/appointments/upsert ────────────────────────

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
    res.status(statusCode).json({ success: true, data: { action: result.action, appointment: normalizeAppointmentResponse(result.appointment) } });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: "Invalid input", details: error.errors });
    }
    console.error("Upsert appointment error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ── POST /api/integration/calendar/parse ─────────────────────────────

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
      providerEmail: parsed.providerEmail ?? "",
      providerPhone: parsed.providerPhone ?? "",
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

// ── POST /api/integration/calendar/availability ──────────────────────

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
      providerEmail: parsed.providerEmail ?? "",
      providerPhone: parsed.providerPhone ?? "",
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

    const formattedSlots: Array<{ date: string; slotStartTime: string; slotEndTime: string; pointsAvailable: number; docksAvailable: number; size: string }> = [];
    for (const day of availableSlots) {
      for (const slot of day.slots) {
        formattedSlots.push({
          date: day.date,
          slotStartTime: slot.startTime,
          slotEndTime: slot.endTime,
          pointsAvailable: slot.pointsAvailable,
          docksAvailable: slot.docksAvailable,
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

// ── POST /api/integration/calendar/book ──────────────────────────────

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
      providerEmail: parsed.providerEmail ?? "",
      providerPhone: parsed.providerPhone ?? "",
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
        providerEmail: normalized.providerEmail || null,
        providerPhone: normalized.providerPhone || null,
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

        // Send confirmation email if provider email was provided
        if (appointment.providerEmail) {
          sendAppointmentConfirmation(appointment.id).catch((e) =>
            console.error("[EMAIL] Provider confirmation error (integration):", e)
          );
        }

        const startLocal = formatToMadridLocal(currentStart);
        const endLocal = formatToMadridLocal(currentEnd);
        const duration = Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000);

        const dockLabel = result.assignedDock ? `Muelle: ${result.assignedDock.name}` : "Muelle: asignado";
        const confirmationHtml = `<b>Cita confirmada</b><br>Proveedor: ${normalized.providerName}<br>Tipo: ${normalized.goodsType}<br>Fecha: ${startLocal.split(',')[0]}<br>Hora: ${startLocal.split(', ')[1]}–${endLocal.split(', ')[1]} (duración: ${duration} min)<br>${dockLabel}`;

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
          dockId: appointment.dockId,
          dockName: result.assignedDock?.name || null,
          dockCode: result.assignedDock?.code || null,
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

// ── GET /api/integration/appointments/by-external-ref/:externalRef ───

router.get("/api/integration/appointments/by-external-ref/:externalRef", authenticateToken, async (req: AuthRequest, res) => {
  try {
    let appointment: any;
    try {
      appointment = await prisma.appointment.findUnique({ where: { externalRef: req.params.externalRef }, include: { dock: true } });
    } catch {
      appointment = await prisma.appointment.findUnique({ where: { externalRef: req.params.externalRef } });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, error: "Appointment not found" });
    }

    res.json({ success: true, data: normalizeAppointmentResponse(appointment) });
  } catch (error) {
    console.error("Get appointment by external ref error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
