import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserRole } from "../../shared/types";
import { prisma } from "../db/client";

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required but not set");
  console.error("Please set a strong random secret in your .env file:");
  console.error("JWT_SECRET=your-secure-random-string-here");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = "24h";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: UserRole;
    };
    req.user = decoded;
    next();
  } catch (error: any) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

export function generateToken(user: { id: string; email: string; role: UserRole }): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

export async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const expires = new Date();
  expires.setDate(expires.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshToken,
      refreshTokenExpires: expires,
    },
  });
}

export async function validateRefreshToken(
  refreshToken: string
): Promise<{ id: string; email: string; role: UserRole } | null> {
  const user = await prisma.user.findFirst({
    where: {
      refreshToken,
      refreshTokenExpires: { gt: new Date() },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

export async function clearRefreshToken(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshToken: null,
      refreshTokenExpires: null,
    },
  });
}
