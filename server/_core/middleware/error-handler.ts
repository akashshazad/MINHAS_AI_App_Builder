
import type { ErrorRequestHandler } from "express";
import { reportError } from "../../../lib/monitoring";

export const createErrorHandler = (): ErrorRequestHandler => (error, req, res, _next) => {
  const requestId = String(res.locals.requestId || "unknown");
  reportError(error, { route: req.originalUrl, extra: { requestId, method: req.method } });
  const production = process.env.NODE_ENV === "production";
  res.status(500).json({
    ok: false,
    error: production ? "Internal server error" : error instanceof Error ? error.message : String(error),
    requestId,
  });
};


