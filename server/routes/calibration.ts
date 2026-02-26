import { Router } from "express";
import { prisma } from "../db/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { calculateCalibration, applyCalibration } from "../services/calibration-service";
import { logAudit } from "../services/audit-service";

const router = Router();

// POST /api/calibration/calculate
router.post("/api/calibration/calculate", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { category } = req.body;
    if (!category || typeof category !== "string") {
      return res.status(400).json({ error: "El campo 'category' es obligatorio" });
    }

    const result = await calculateCalibration(category);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes("insuficientes") || error.message?.includes("singular")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Calibration calculate error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/calibration/:id/apply
router.post("/api/calibration/:id/apply", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    await applyCalibration(req.params.id, req.user!.email);

    logAudit({
      entityType: "CALIBRATION",
      entityId: req.params.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: { action: "APPLY_CALIBRATION" },
    }).catch(() => {});

    res.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes("no encontrado") || error.message?.includes("ya está")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Calibration apply error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/calibration/history
router.get("/api/calibration/history", authenticateToken, requireRole("ADMIN", "PLANNER"), async (_req: AuthRequest, res) => {
  try {
    const snapshots = await prisma.calibrationSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(snapshots);
  } catch (error) {
    console.error("Calibration history error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
