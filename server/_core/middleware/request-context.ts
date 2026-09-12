
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export function createRequestContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : "";
    const requestId = REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.locals.requestId = requestId;
    next();
  };
}


