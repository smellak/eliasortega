import { Router } from "express";
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from "../middleware/auth";
import { prisma } from "../db/client";
import { ESTIMATION_RATIOS } from "../config/estimation-ratios";

const router = Router();

// Audit Log
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

// Estimation ratios config
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

export default router;
