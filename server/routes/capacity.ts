import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client";
import { createCapacityShiftSchema, updateCapacityShiftSchema } from "../../shared/types";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { slotCapacityValidator } from "../services/slot-validator";
import { logAudit, computeChanges } from "../services/audit-service";
import { getMadridDayOfWeek, getMadridMidnight, getMadridEndOfDay, getMadridDateStr } from "../utils/madrid-date";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";
import { normalizeCategory, estimateLines, estimateDeliveryNotes } from "../config/estimation-ratios";

const router = Router();

// --- Capacity Shifts CRUD ---

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

    slotCapacityValidator.clearCache();
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

    slotCapacityValidator.clearCache();
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

    slotCapacityValidator.clearCache();
    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Capacity shift not found" });
    }
    console.error("Delete capacity shift error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Capacity Analytics ---

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

    let current = getMadridMidnight(new Date(from));
    const end = getMadridEndOfDay(new Date(to));

    const allSlots: Array<{
      date: string;
      startTime: string;
      endTime: string;
      maxPoints: number;
      pointsUsed: number;
      pointsAvailable: number;
      activeDocks: number;
    }> = [];

    let totalMaxPoints = 0;
    let totalPointsUsed = 0;
    let peakSlot: { date: string; startTime: string; percentage: number } | null = null;

    while (current <= end) {
      const dateStr = getMadridDateStr(current);
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
          activeDocks: slot.activeDocks,
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

      // DST-safe: advance 25h then snap to Madrid midnight
      current = getMadridMidnight(new Date(current.getTime() + 25 * 60 * 60 * 1000));
    }

    // Count appointments in range
    const fromStart = getMadridMidnight(new Date(from));
    const toEnd = getMadridEndOfDay(new Date(to));

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
    const midnightTarget = getMadridMidnight(targetDate);

    const dayOfWeek = getMadridDayOfWeek(targetDate);

    // Get templates for this day of week
    const templates = await prisma.slotTemplate.findMany({
      where: { dayOfWeek, active: true },
      orderBy: { startTime: "asc" },
    });

    if (templates.length === 0) {
      return res.status(404).json({ error: "No hay franjas configuradas para este día" });
    }

    const dateStart = midnightTarget;
    const dateEnd = getMadridEndOfDay(targetDate);

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
        entityId: getMadridDateStr(targetDate),
        action: "DELETE",
        actorType: "USER",
        actorId: req.user?.id || null,
        changes: { level: "reset", date: getMadridDateStr(targetDate) },
      });

      return res.json({
        date: getMadridDateStr(targetDate),
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
      entityId: getMadridDateStr(targetDate),
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id || null,
      changes: { level, date: getMadridDateStr(targetDate), adjustedSlots },
    });

    res.json({
      date: getMadridDateStr(targetDate),
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
    const midnightTarget = getMadridMidnight(targetDate);

    const dayOfWeek = getMadridDayOfWeek(targetDate);

    const templates = await prisma.slotTemplate.findMany({
      where: { dayOfWeek, active: true },
      orderBy: { startTime: "asc" },
    });

    const dateStart = midnightTarget;
    const dateEnd = getMadridEndOfDay(targetDate);

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
    const slots = await slotCapacityValidator.getSlotsForDate(midnightTarget);
    const slotsWithUsage = await Promise.all(
      slots.map(async (slot) => {
        const usedPoints = await slotCapacityValidator.getSlotUsage(midnightTarget, slot.startTime);
        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxPoints: slot.maxPoints,
          usedPoints,
          availablePoints: slot.maxPoints - usedPoints,
          activeDocks: slot.activeDocks,
        };
      })
    );

    res.json({
      date: getMadridDateStr(midnightTarget),
      quickAdjustLevel,
      slots: slotsWithUsage,
    });
  } catch (error: any) {
    console.error("Today status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
