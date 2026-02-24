import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY || "";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function authenticateIntegration(req: Request, res: Response, next: NextFunction) {
  if (!INTEGRATION_API_KEY) {
    return res.status(403).json({ success: false, error: "Integration API is disabled. Set INTEGRATION_API_KEY to enable." });
  }
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey || !timingSafeEqual(apiKey, INTEGRATION_API_KEY)) {
    return res.status(401).json({ success: false, error: "Invalid or missing API key" });
  }
  next();
}

const publicRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function publicRateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = (req.ip || req.headers["x-forwarded-for"] || "unknown") as string;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 30;

  let entry = publicRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    publicRateLimitMap.set(key, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return res.status(429).json({ success: false, error: "Demasiadas peticiones. Inténtalo en 15 minutos." });
  }

  next();
}

const integrationRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function integrationRateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = (req.ip || req.headers["x-forwarded-for"] || "unknown") as string;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 50;

  let entry = integrationRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    integrationRateLimitMap.set(key, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return res.status(429).json({ success: false, error: "Too many requests. Limit: 50 req/min for integration endpoints." });
  }

  next();
}
