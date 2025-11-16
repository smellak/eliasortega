import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../../shared/types";

// Require JWT_SECRET in environment - fail if not provided
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required but not set");
  console.error("Please set a strong random secret in your .env file:");
  console.error("JWT_SECRET=your-secure-random-string-here");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

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

  // Debug logging for production troubleshooting
  console.log("[AUTH] Headers received:", {
    authorization: authHeader ? `${authHeader.substring(0, 20)}...` : "MISSING",
    hasToken: !!token,
    path: req.path,
    method: req.method,
  });

  if (!token) {
    console.log("[AUTH] No token found in request");
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: UserRole;
    };
    req.user = decoded;
    console.log("[AUTH] Token verified successfully for user:", decoded.email);
    next();
  } catch (error: any) {
    console.log("[AUTH] Token verification failed:", {
      name: error.name,
      message: error.message,
      tokenPreview: token.substring(0, 20) + "...",
    });
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
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}
