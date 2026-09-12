
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { getAllowedOAuthRedirectUris, sdk } from "./sdk";
import { randomUUID } from "node:crypto";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getFrontendUrl(req: Request) {
  const explicit = process.env.PUBLIC_APP_URL || process.env.EXPO_PUBLIC_WEB_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") {
    const preview = process.env.EXPO_WEB_PREVIEW_URL || process.env.EXPO_PACKAGER_PROXY_URL;
    if (preview) return preview.replace(/\/$/, "");
    const forwardedHost = req.headers["x-forwarded-host"];
    const host = typeof forwardedHost === "string" ? forwardedHost.split(",")[0]?.trim() : req.get("host");
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0]?.trim() : req.protocol;
    return host ? `${protocol || "https"}://${host}` : "http://localhost:8081";
  }
  const exactWebCallback = getAllowedOAuthRedirectUris().find((uri) => uri.endsWith("/api/oauth/callback"));
  if (!exactWebCallback) throw new Error("PUBLIC_APP_URL or an exact web OAuth redirect URI is required in production.");
  return exactWebCallback.slice(0, -"/api/oauth/callback".length);
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod ?? null,
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | null;
      },
) {
  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/anonymous", async (req: Request, res: Response) => {
    const requestId = String(res.locals.requestId ?? req.headers["x-request-id"] ?? "anonymous-auth");
    try {
      if (!process.env.JWT_SECRET) {
        res.status(503).json({ error: "MINHAS session signing is unavailable", requestId });
        return;
      }
      const openId = `minhas_guest_${randomUUID()}`;
      const user = await syncUser({ openId, name: "Guest workspace", loginMethod: "anonymous" });
      const sessionToken = await sdk.createSessionToken(openId, { name: "Guest workspace", expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.status(201).json({ app_session_id: sessionToken, user: buildUserResponse(user), authMode: "anonymous" });
    } catch (error) {
      console.error("[Auth] Anonymous session failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
      res.status(503).json({ error: "MINHAS anonymous session unavailable", requestId });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to the frontend URL (Expo web on port 8081)
      // Cookie is set with parent domain so it works across both 3000 and 8081 subdomains
      const frontendUrl = getFrontendUrl(req);
      res.redirect(302, frontendUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const codeVerifier = getQueryParam(req, "code_verifier");
    const redirectUri = getQueryParam(req, "redirect_uri");
    const requestId = String(req.headers["x-request-id"] ?? "oauth-mobile");

    if (!code || !state || !codeVerifier || !redirectUri) {
      res.status(400).json({ error: "code, state, code_verifier, and redirect_uri are required", requestId });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state, codeVerifier, redirectUri);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);

      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
      res.status(502).json({ error: "OAuth mobile exchange failed", requestId });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session cookie from Bearer token
  // Used by iframe preview: frontend receives token via postMessage, then calls this endpoint
  // to get a proper Set-Cookie response from the backend (3000-xxx domain)
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      // Authenticate using Bearer token from Authorization header
      const user = await sdk.authenticateRequest(req);

      // Get the token from the Authorization header to set as cookie
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      // Set cookie for this domain (3000-xxx)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
