import { Router } from "express";
import { prisma } from "../db/client";
import {
  createSlotTemplateSchema,
  updateSlotTemplateSchema,
  createSlotOverrideSchema,
  updateSlotOverrideSchema,
} from "../../shared/types";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { slotCapacityValidator } from "../services/slot-validator";
import { logAudit, computeChanges } from "../services/audit-service";
import {
  getMadridDayOfWeek,
  getMadridMidnight,
  getMadridEndOfDay,
  getMadridDateStr,
} from "../utils/madrid-date";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";
import { findAppointmentsWithDockFallback } from "../helpers/appointment-helpers";

const router = Router();

// ── Slot Templates CRUD ──────────────────────────────────────────────

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

    slotCapacityValidator.clearCache();

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

    slotCapacityValidator.clearCache();

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

    slotCapacityValidator.clearCache();

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

// ── Slot Overrides CRUD (ADMIN/PLANNER) ──────────────────────────────

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

    slotCapacityValidator.clearCache();

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

    slotCapacityValidator.clearCache();

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

    slotCapacityValidator.clearCache();

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

// ── Slot availability for a date ─────────────────────────────────────

router.get("/api/slots/availability", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { date, points } = req.query;
    if (!date) {
      return res.status(400).json({ error: "date parameter is required" });
    }

    const targetDate = new Date(date as string);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
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

// ── Slot usage per day for calendar ──────────────────────────────────

router.get("/api/slots/usage", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to parameters are required" });
    }

    const startDate = new Date(from as string);
    const endDate = new Date(to as string);
    const results: Array<{ date: string; slots: Array<{ startTime: string; endTime: string; maxPoints: number; pointsUsed: number; pointsAvailable: number }> }> = [];

    let current = getMadridMidnight(new Date(from as string));
    const end = getMadridEndOfDay(new Date(to as string));

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
        date: getMadridDateStr(current),
        slots: daySlots,
      });

      // DST-safe: advance 25h then snap to Madrid midnight
      current = getMadridMidnight(new Date(current.getTime() + 25 * 60 * 60 * 1000));
    }

    res.json(results);
  } catch (error) {
    console.error("Get slot usage error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Week view ────────────────────────────────────────────────────────

router.get("/api/slots/week", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dateParam = req.query.date as string | undefined;
    const refDate = dateParam ? new Date(dateParam) : new Date();
    if (isNaN(refDate.getTime())) {
      return res.status(400).json({ error: "Formato de fecha inválido" });
    }

    // Find Monday of the week containing refDate
    const day = getMadridDayOfWeek(refDate); // 0=Sun, 1=Mon, ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(refDate);
    monday.setDate(monday.getDate() + diffToMonday);
    const mondayMidnight = getMadridMidnight(monday);

    // Generate Mon-Sat (6 days) — DST-safe via 25h offset + snap
    const days: Date[] = [];
    for (let i = 0; i < 6; i++) {
      const d = i === 0 ? mondayMidnight : getMadridMidnight(new Date(mondayMidnight.getTime() + i * 25 * 60 * 60 * 1000));
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
      const dateStr = getMadridDateStr(dayDate);
      const slots = await slotCapacityValidator.getSlotsForDate(dayDate);

      const dateStart = getMadridMidnight(dayDate);
      const dateEnd = getMadridEndOfDay(dayDate);

      // Fetch all appointments for this day at once (with dock fallback)
      const dayAppointments = await findAppointmentsWithDockFallback(
        { slotDate: { gte: dateStart, lte: dateEnd } },
        { startUtc: "asc" },
      );

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
          activeDocks: slot.activeDocks,
          appointments: slotAppts.map((a: any) => ({
            id: a.id,
            providerId: a.providerId,
            providerName: a.providerName,
            goodsType: a.goodsType,
            units: a.units,
            lines: a.lines,
            deliveryNotesCount: a.deliveryNotesCount,
            size: a.size,
            pointsUsed: a.pointsUsed,
            workMinutesNeeded: a.workMinutesNeeded,
            forkliftsNeeded: a.forkliftsNeeded,
            startUtc: a.startUtc.toISOString(),
            endUtc: a.endUtc.toISOString(),
            confirmationStatus: a.confirmationStatus,
            providerEmail: a.providerEmail,
            providerPhone: a.providerPhone,
            dockId: a.dockId,
            dockCode: a.dock?.code || null,
            dockName: a.dock?.name || null,
          })),
        });
      }

      result.push({
        date: dateStr,
        dayOfWeek: getMadridDayOfWeek(dayDate),
        dayName: dayNames[getMadridDayOfWeek(dayDate)],
        slots: slotResults,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Get slots/week error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
