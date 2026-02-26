import { Router } from "express";
import { prisma } from "../db/client";
import {
  createAppointmentSchema,
  updateAppointmentSchema,
} from "../../shared/types";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { slotCapacityValidator } from "../services/slot-validator";
import { logAudit, computeChanges } from "../services/audit-service";
import { sendAppointmentAlert } from "../services/email-service";
import { sendAppointmentConfirmation } from "../services/provider-email-service";
import { getMadridDayOfWeek, getMadridMidnight, getMadridDateStr } from "../utils/madrid-date";
import { formatInTimeZone } from "date-fns-tz";
import { normalizeCategory, estimateLines, estimateDeliveryNotes } from "../config/estimation-ratios";
import {
  resolveEstimationsForRoute,
  findAppointmentsWithDockFallback,
  normalizeAppointmentResponse,
} from "../helpers/appointment-helpers";

const router = Router();

// ── GET /api/appointments ────────────────────────────────────────────

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

    const appointments = await findAppointmentsWithDockFallback(where, { startUtc: "asc" });

    const parsed = appointments.map(normalizeAppointmentResponse);
    res.json(parsed);
  } catch (error) {
    console.error("Get appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/appointments ───────────────────────────────────────────

router.post("/api/appointments", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createAppointmentSchema.parse(req.body);

    const est = resolveEstimationsForRoute(data.goodsType ?? null, data.units ?? null, data.lines ?? null, data.deliveryNotesCount ?? null);

    const { size, points: pointsUsed } = slotCapacityValidator.determineSizeAndPoints(data.workMinutesNeeded);
    const startDate = new Date(data.start);
    if (getMadridDayOfWeek(startDate) === 0) {
      return res.status(400).json({ error: "No se aceptan citas en domingo. El almacén está cerrado." });
    }
    const slotDate = getMadridMidnight(startDate);

    const result = await prisma.$transaction(async (tx) => {
      const resolvedSlotStart = await slotCapacityValidator.resolveSlotStartTime(startDate, tx);
      const slotStartTime = resolvedSlotStart || formatInTimeZone(startDate, 'Europe/Madrid', 'HH:mm');

      const startUtcDate = new Date(data.start);
      const endUtcDate = new Date(data.end);
      const slotValidation = await slotCapacityValidator.validateSlotCapacity(
        slotDate,
        slotStartTime,
        pointsUsed,
        startUtcDate,
        endUtcDate,
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
            reason: slotValidation.reason,
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
          dockId: slotValidation.assignedDock?.id || null,
        },
      });

      return { appointment, assignedDock: slotValidation.assignedDock };
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
      dockName: result.assignedDock?.name || null,
    }).catch((e) => console.error("[EMAIL] Alert error:", e));

    res.status(201).json(normalizeAppointmentResponse(result.appointment));
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

// ── PUT /api/appointments/:id ────────────────────────────────────────

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
      const slotDate = getMadridMidnight(effectiveStart);
      const resolvedSlotStart = await slotCapacityValidator.resolveSlotStartTime(effectiveStart, tx);
      const slotStartTime = resolvedSlotStart || formatInTimeZone(effectiveStart, 'Europe/Madrid', 'HH:mm');

      const effectiveEnd = updateData.endUtc || current.endUtc;
      const slotValidation = await slotCapacityValidator.validateSlotCapacity(
        slotDate,
        slotStartTime,
        pointsUsed,
        effectiveStart,
        effectiveEnd,
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
            reason: slotValidation.reason,
            message: slotValidation.error || "Slot sin capacidad disponible",
          },
        };
      }

      updateData.size = size;
      updateData.pointsUsed = pointsUsed;
      updateData.slotDate = slotDate;
      updateData.slotStartTime = slotValidation.slotStartTime;
      updateData.dockId = slotValidation.assignedDock?.id || null;

      const appointment = await tx.appointment.update({
        where: { id: req.params.id },
        data: updateData,
      });

      return { appointment, before: current, assignedDock: slotValidation.assignedDock };
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
      dockName: result.assignedDock?.name || null,
    }).catch((e) => console.error("[EMAIL] Alert error:", e));

    res.json(normalizeAppointmentResponse(result.appointment));
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

// ── DELETE /api/appointments/:id ─────────────────────────────────────

router.delete("/api/appointments/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    let appointment: any;
    try {
      appointment = await prisma.appointment.findUnique({ where: { id: req.params.id }, include: { dock: true } });
    } catch {
      appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    }

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
      dockName: appointment.dock?.name || null,
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

// ── POST /api/appointments/:id/resend-confirmation ───────────────────

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

// ── POST /api/appointments/:id/reactivate ────────────────────────────

router.post("/api/appointments/:id/reactivate", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (appt.confirmationStatus !== "cancelled") return res.status(400).json({ error: "Only cancelled appointments can be reactivated" });

    let updated: any;
    try {
      updated = await prisma.appointment.update({
        where: { id: appt.id },
        data: { confirmationStatus: "pending", cancelledAt: null, cancellationReason: null },
        include: { dock: true },
      });
    } catch {
      updated = await prisma.appointment.update({
        where: { id: appt.id },
        data: { confirmationStatus: "pending", cancelledAt: null, cancellationReason: null },
      });
    }

    logAudit({
      entityType: "APPOINTMENT",
      entityId: appt.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: { confirmationStatus: { from: "cancelled", to: "pending" } },
    }).catch(() => {});

    res.json(normalizeAppointmentResponse(updated));
  } catch (error) {
    console.error("Reactivate appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/appointments/:id/check-in ──────────────────────────────

router.post("/api/appointments/:id/check-in", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    if (appointment.actualStartUtc) {
      return res.status(400).json({ error: "Appointment already checked in" });
    }

    if (appointment.cancelledAt) {
      return res.status(400).json({ error: "Cannot check in a cancelled appointment" });
    }

    // Validate appointment date is today ±1 day (Madrid timezone)
    const now = new Date();
    const todayMadrid = getMadridDateStr(now);
    const appointmentDateMadrid = getMadridDateStr(appointment.startUtc);
    const todayDate = new Date(todayMadrid + "T12:00:00Z");
    const apptDate = new Date(appointmentDateMadrid + "T12:00:00Z");
    const diffDays = Math.abs((todayDate.getTime() - apptDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      return res.status(400).json({ error: "Check-in only allowed for today's appointments (±1 day)" });
    }

    let updated: any;
    try {
      updated = await prisma.appointment.update({
        where: { id: req.params.id },
        data: { actualStartUtc: now, checkedInBy: req.user!.email },
        include: { dock: true },
      });
    } catch {
      updated = await prisma.appointment.update({
        where: { id: req.params.id },
        data: { actualStartUtc: now, checkedInBy: req.user!.email },
      });
    }

    logAudit({
      entityType: "APPOINTMENT",
      entityId: req.params.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: { action: "CHECK_IN", checkedInBy: req.user!.email },
    }).catch(() => {});

    res.json({ success: true, appointment: normalizeAppointmentResponse(updated) });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/appointments/:id/check-out ─────────────────────────────

router.post("/api/appointments/:id/check-out", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    if (!appointment.actualStartUtc) {
      return res.status(400).json({ error: "Appointment has not been checked in yet" });
    }
    if (appointment.actualEndUtc) {
      return res.status(400).json({ error: "Appointment already checked out" });
    }

    const now = new Date();
    const actualDurationMin = (now.getTime() - appointment.actualStartUtc.getTime()) / 60000;
    const predictionErrorMin = actualDurationMin - appointment.workMinutesNeeded;

    const updateData: any = {
      actualEndUtc: now,
      checkedOutBy: req.user!.email,
      actualDurationMin: Math.round(actualDurationMin * 100) / 100,
      predictionErrorMin: Math.round(predictionErrorMin * 100) / 100,
    };

    if (req.body.actualUnits !== undefined && req.body.actualUnits !== null) {
      updateData.actualUnits = req.body.actualUnits;
    }

    let updated: any;
    try {
      updated = await prisma.appointment.update({
        where: { id: req.params.id },
        data: updateData,
        include: { dock: true },
      });
    } catch {
      updated = await prisma.appointment.update({
        where: { id: req.params.id },
        data: updateData,
      });
    }

    logAudit({
      entityType: "APPOINTMENT",
      entityId: req.params.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: {
        action: "CHECK_OUT",
        checkedOutBy: req.user!.email,
        actualDurationMin: updateData.actualDurationMin,
        predictionErrorMin: updateData.predictionErrorMin,
      },
    }).catch(() => {});

    // Alert if prediction error > 60 minutes
    if (Math.abs(updateData.predictionErrorMin) > 60) {
      logAudit({
        entityType: "APPOINTMENT",
        entityId: req.params.id,
        action: "UPDATE",
        actorType: "SYSTEM",
        actorId: null,
        changes: {
          type: "PREDICTION_DEVIATION",
          predicted: appointment.workMinutesNeeded,
          actual: updateData.actualDurationMin,
          errorMin: updateData.predictionErrorMin,
          goodsType: appointment.goodsType,
          providerName: appointment.providerName,
        },
      }).catch(() => {});
    }

    res.json({
      success: true,
      appointment: normalizeAppointmentResponse(updated),
      actualDurationMin: updateData.actualDurationMin,
      predictionErrorMin: updateData.predictionErrorMin,
    });
  } catch (error) {
    console.error("Check-out error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/appointments/:id/undo-check-in ────────────────────────

router.post("/api/appointments/:id/undo-check-in", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    if (!appointment.actualStartUtc) {
      return res.status(400).json({ error: "Appointment has not been checked in" });
    }

    let updated: any;
    try {
      updated = await prisma.appointment.update({
        where: { id: req.params.id },
        data: {
          actualStartUtc: null,
          actualEndUtc: null,
          actualUnits: null,
          checkedInBy: null,
          checkedOutBy: null,
          actualDurationMin: null,
          predictionErrorMin: null,
        },
        include: { dock: true },
      });
    } catch {
      updated = await prisma.appointment.update({
        where: { id: req.params.id },
        data: {
          actualStartUtc: null,
          actualEndUtc: null,
          actualUnits: null,
          checkedInBy: null,
          checkedOutBy: null,
          actualDurationMin: null,
          predictionErrorMin: null,
        },
      });
    }

    logAudit({
      entityType: "APPOINTMENT",
      entityId: req.params.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: { action: "UNDO_CHECK_IN" },
    }).catch(() => {});

    res.json({ success: true, appointment: normalizeAppointmentResponse(updated) });
  } catch (error) {
    console.error("Undo check-in error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
