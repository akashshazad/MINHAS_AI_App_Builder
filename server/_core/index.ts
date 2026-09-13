
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import fs from "node:fs";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createSecurityMiddleware } from "./middleware/security";
import { createApiRateLimitMiddleware } from "./middleware/rate-limit";
import { createRequestContextMiddleware } from "./middleware/request-context";
import { createErrorHandler } from "./middleware/error-handler";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  // WebDev runs behind an HTTPS reverse proxy. Trust its forwarded host/proto
  // so OAuth redirects and session-cookie security reflect the public URL.
  app.set("trust proxy", process.env.NODE_ENV === "production" ? Number(process.env.TRUST_PROXY_HOPS || 1) : false);
  const server = createServer(app);

  app.use(createRequestContextMiddleware());
  app.use(createSecurityMiddleware());
  app.use("/api", createApiRateLimitMiddleware());
  app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || "10mb" }));
  app.use(express.urlencoded({ limit: process.env.REQUEST_BODY_LIMIT || "10mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, status: "healthy", timestamp: Date.now() });
  });
  app.get("/api/health/ready", async (_req, res) => {
    const checks = {
      database: Boolean(process.env.DATABASE_URL),
      auth: Boolean(process.env.OAUTH_SERVER_URL && process.env.JWT_SECRET),
    };
    const ready = Object.values(checks).every(Boolean);
    res.status(ready ? 200 : 503).json({ ok: ready, status: ready ? "ready" : "not_ready", checks, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (process.env.NODE_ENV === "production") {
    const clientDist = path.resolve(process.cwd(), "dist/client");
    const indexFile = path.join(clientDist, "index.html");
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) return next();
        return fs.existsSync(indexFile) ? res.sendFile(indexFile) : next();
      });
    }
  }

  // Keep the error boundary last so every downstream failure gets a request ID.
  app.use(createErrorHandler());

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = process.env.NODE_ENV === "production" ? preferredPort : await findAvailablePort(preferredPort);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolve());
  });
  console.log(`[api] server listening on port ${port}`);
  const shutdown = (signal: string) => {
    console.log(`[api] received ${signal}; shutting down gracefully`);
    server.close((error) => { if (error) { console.error(error); process.exitCode = 1; } });
    (setTimeout(() => process.exit(1), 10000) as unknown as NodeJS.Timeout).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch(console.error);
