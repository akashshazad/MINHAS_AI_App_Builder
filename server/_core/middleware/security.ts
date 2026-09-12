
import type { NextFunction, Request, Response } from "express";

export function createSecurityMiddleware() {
  const allowedOrigins = new Set((process.env.CORS_ALLOWED_ORIGINS || "http://localhost:8081,http://localhost:3000").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean));
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin.replace(/\/$/, "") : "";
    if (origin && !allowedOrigins.has(origin) && req.method === "OPTIONS") return res.status(403).json({ error: "Origin is not allowed" });
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  };
}


