import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from "../middleware/auth";
import { logAudit, computeChanges } from "../services/audit-service";
import { prisma } from "../db/client";

const router = Router();

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

export default router;
