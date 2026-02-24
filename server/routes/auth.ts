import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  loginSchema,
  changePasswordSchema,
  AuthResponse,
  UserResponse,
} from "../../shared/types";
import {
  authenticateToken,
  requireRole,
  generateToken,
  generateRefreshToken,
  saveRefreshToken,
  validateRefreshToken,
  clearRefreshToken,
  AuthRequest,
} from "../middleware/auth";
import { logAudit, computeChanges } from "../services/audit-service";
import { prisma } from "../db/client";

const router = Router();

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
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);

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

router.post("/api/auth/logout", authenticateToken, async (req: AuthRequest, res) => {
  try {
    await clearRefreshToken(req.user!.id);
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/auth/change-password", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        refreshToken: null,
        refreshTokenExpires: null,
      },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
