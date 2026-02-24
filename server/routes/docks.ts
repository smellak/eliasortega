import { Router } from "express";
import { prisma } from "../db/client";
import { createDockSchema, updateDockSchema, createDockOverrideSchema } from "../../shared/types";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { slotCapacityValidator } from "../services/slot-validator";
import { logAudit, computeChanges } from "../services/audit-service";
import { getMadridMidnight, getMadridEndOfDay, getMadridDateStr } from "../utils/madrid-date";

const router = Router();

// --- Docks CRUD ---

router.get("/api/docks", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const docks = await prisma.dock.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        availabilities: { include: { slotTemplate: true } },
      },
    });
    res.json(docks);
  } catch (error) {
    console.error("Get docks error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/docks", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const data = createDockSchema.parse(req.body);
    const dock = await prisma.dock.create({ data });

    logAudit({
      entityType: "DOCK",
      entityId: dock.id,
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: data as Record<string, unknown>,
    }).catch(() => {});

    res.status(201).json(dock);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Dock code already exists" });
    }
    console.error("Create dock error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/docks/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const data = updateDockSchema.parse(req.body);
    const before = await prisma.dock.findUnique({ where: { id: req.params.id } });
    const dock = await prisma.dock.update({
      where: { id: req.params.id },
      data,
    });

    logAudit({
      entityType: "DOCK",
      entityId: dock.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: before ? computeChanges(before as any, dock as any) : (data as Record<string, unknown>),
    }).catch(() => {});

    // Clear slot validator cache since dock changes affect availability
    slotCapacityValidator.clearCache();

    res.json(dock);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Dock not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Dock code already exists" });
    }
    console.error("Update dock error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/docks/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    await prisma.dock.delete({ where: { id: req.params.id } });

    logAudit({
      entityType: "DOCK",
      entityId: req.params.id,
      action: "DELETE",
      actorType: "USER",
      actorId: req.user?.id,
    }).catch(() => {});

    slotCapacityValidator.clearCache();
    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Dock not found" });
    }
    console.error("Delete dock error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Dock Slot Availability (ADMIN) ---

router.put("/api/docks/:dockId/availability", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { dockId } = req.params;
    const { slotTemplateId, isActive } = req.body;

    if (!slotTemplateId || typeof isActive !== "boolean") {
      return res.status(400).json({ error: "slotTemplateId and isActive are required" });
    }

    const result = await prisma.dockSlotAvailability.upsert({
      where: {
        dockId_slotTemplateId: { dockId, slotTemplateId },
      },
      update: { isActive },
      create: { dockId, slotTemplateId, isActive },
    });

    slotCapacityValidator.clearCache();
    res.json(result);
  } catch (error: any) {
    console.error("Update dock availability error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/docks/:dockId/availability/bulk", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { dockId } = req.params;
    const { updates } = req.body; // Array of { slotTemplateId, isActive }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "updates array is required" });
    }

    const results = await prisma.$transaction(
      updates.map((u: { slotTemplateId: string; isActive: boolean }) =>
        prisma.dockSlotAvailability.upsert({
          where: {
            dockId_slotTemplateId: { dockId, slotTemplateId: u.slotTemplateId },
          },
          update: { isActive: u.isActive },
          create: { dockId, slotTemplateId: u.slotTemplateId, isActive: u.isActive },
        })
      )
    );

    slotCapacityValidator.clearCache();
    res.json({ updated: results.length });
  } catch (error: any) {
    console.error("Bulk update dock availability error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Dock Overrides (ADMIN/PLANNER) ---

router.get("/api/dock-overrides", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { from, to, dockId } = req.query;
    const where: any = {};
    if (dockId) where.dockId = dockId as string;
    if (from || to) {
      const conditions: any[] = [];
      if (to) conditions.push({ date: { lte: new Date(to as string) } });
      if (from) {
        const fromDate = new Date(from as string);
        conditions.push({
          OR: [
            { dateEnd: { gte: fromDate } },
            { dateEnd: null, date: { gte: fromDate } },
          ],
        });
      }
      if (conditions.length > 0) where.AND = conditions;
    }

    const overrides = await prisma.dockOverride.findMany({
      where,
      include: { dock: true },
      orderBy: { date: "asc" },
    });
    res.json(overrides);
  } catch (error) {
    console.error("Get dock overrides error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/dock-overrides", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createDockOverrideSchema.parse(req.body);

    if (data.dateEnd && new Date(data.dateEnd) < new Date(data.date)) {
      return res.status(400).json({ error: "dateEnd must be >= date" });
    }

    const override = await prisma.dockOverride.create({
      data: {
        dockId: data.dockId,
        date: new Date(data.date),
        dateEnd: data.dateEnd ? new Date(data.dateEnd) : null,
        isActive: data.isActive ?? false,
        reason: data.reason || null,
      },
    });

    logAudit({
      entityType: "DOCK_OVERRIDE",
      entityId: override.id,
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: data as Record<string, unknown>,
    }).catch(() => {});

    slotCapacityValidator.clearCache();
    res.status(201).json(override);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create dock override error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/dock-overrides/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    await prisma.dockOverride.delete({ where: { id: req.params.id } });

    logAudit({
      entityType: "DOCK_OVERRIDE",
      entityId: req.params.id,
      action: "DELETE",
      actorType: "USER",
      actorId: req.user?.id,
    }).catch(() => {});

    slotCapacityValidator.clearCache();
    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Dock override not found" });
    }
    console.error("Delete dock override error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Dock Timeline (Gantt view data) ---

router.get("/api/docks/timeline", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dateParam = req.query.date as string | undefined;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const dateStart = getMadridMidnight(targetDate);
    const dateEnd = getMadridEndOfDay(targetDate);

    const docks = await prisma.dock.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });

    const appointments = await prisma.appointment.findMany({
      where: {
        dockId: { not: null },
        slotDate: { gte: dateStart, lte: dateEnd },
      },
      orderBy: { startUtc: "asc" },
    });

    const timeline = docks.map((dock) => ({
      dockId: dock.id,
      dockName: dock.name,
      dockCode: dock.code,
      appointments: appointments
        .filter((a) => a.dockId === dock.id)
        .map((a) => ({
          id: a.id,
          providerName: a.providerName,
          goodsType: a.goodsType,
          startUtc: a.startUtc.toISOString(),
          endUtc: a.endUtc.toISOString(),
          size: a.size,
          pointsUsed: a.pointsUsed,
          confirmationStatus: a.confirmationStatus,
        })),
    }));

    res.json({ date: getMadridDateStr(targetDate), docks: timeline });
  } catch (error) {
    console.error("Get dock timeline error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
