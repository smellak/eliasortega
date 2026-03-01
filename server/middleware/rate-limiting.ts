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

// --- Public rate limiter (for non-chat public endpoints) ---
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

// --- Chat rate limiter (rolling window, per IP) ---
const CHAT_LIMIT_PER_HOUR = 10;
const CHAT_LIMIT_PER_DAY = 30;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const chatRateLimitMap = new Map<string, number[]>();

// Cleanup stale entries every hour
setInterval(() => {
  const cutoff = Date.now() - DAY_MS;
  for (const [key, timestamps] of chatRateLimitMap.entries()) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      chatRateLimitMap.delete(key);
    } else {
      chatRateLimitMap.set(key, filtered);
    }
  }
}, HOUR_MS);

export function chatRateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = (req.ip || req.headers["x-forwarded-for"] || "unknown") as string;
  const now = Date.now();

  let timestamps = chatRateLimitMap.get(key);
  if (!timestamps) {
    timestamps = [];
    chatRateLimitMap.set(key, timestamps);
  }

  // Remove entries older than 24h
  const cutoff24h = now - DAY_MS;
  while (timestamps.length > 0 && timestamps[0] <= cutoff24h) {
    timestamps.shift();
  }

  // Count messages in last hour
  const cutoff1h = now - HOUR_MS;
  const messagesLastHour = timestamps.filter((t) => t > cutoff1h).length;

  // Count messages in last 24h (all remaining after cleanup)
  const messagesLastDay = timestamps.length;

  // Check hourly limit first
  if (messagesLastHour >= CHAT_LIMIT_PER_HOUR) {
    const oldestInHour = timestamps.find((t) => t > cutoff1h)!;
    const retryAfter = Math.ceil((oldestInHour + HOUR_MS - now) / 1000);
    res.setHeader("X-RateLimit-Limit", String(CHAT_LIMIT_PER_DAY));
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader("X-RateLimit-Reset", String(Math.ceil((oldestInHour + HOUR_MS) / 1000)));
    return res.status(429).json({
      error: "rate_limited",
      message: "Has alcanzado el límite de mensajes por hora. Por favor, inténtalo más tarde o llama al almacén.",
      retryAfter,
    });
  }

  // Check daily limit
  if (messagesLastDay >= CHAT_LIMIT_PER_DAY) {
    const oldestTimestamp = timestamps[0];
    const retryAfter = Math.ceil((oldestTimestamp + DAY_MS - now) / 1000);
    res.setHeader("X-RateLimit-Limit", String(CHAT_LIMIT_PER_DAY));
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader("X-RateLimit-Reset", String(Math.ceil((oldestTimestamp + DAY_MS) / 1000)));
    return res.status(429).json({
      error: "rate_limited",
      message: "Has alcanzado el límite de mensajes por hoy. Por favor, inténtalo más tarde o llama al almacén.",
      retryAfter,
    });
  }

  // Record this request
  timestamps.push(now);

  // Set informational headers
  const remaining = CHAT_LIMIT_PER_DAY - timestamps.length;
  const oldestTs = timestamps[0];
  const resetTimestamp = Math.ceil((oldestTs + DAY_MS) / 1000);
  res.setHeader("X-RateLimit-Limit", String(CHAT_LIMIT_PER_DAY));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(resetTimestamp));

  next();
}

// --- Integration rate limiter ---
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
