
import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

/**
 * Extract parent domain for cookie sharing across subdomains.
 * e.g., "3000-xxx.manuspre.computer" -> ".manuspre.computer"
 * This allows cookies set by 3000-xxx to be read by 8081-xxx
 */
function getConfiguredCookieDomain(hostname: string) {
  const configured = process.env.SESSION_COOKIE_DOMAIN?.trim() || (hostname.endsWith(".manus.computer") ? "manus.computer" : undefined);
  if (!configured) return undefined;
  const domain = configured.replace(/^\\./, "").toLowerCase();
  if (!domain || domain.includes("/") || domain.includes(":") || domain.includes("..")) return undefined;
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) return undefined;
  if (hostname !== domain && !hostname.endsWith(`.${domain}`)) return undefined;
  return `.${domain}`;
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const forwardedHost = req.headers["x-forwarded-host"];
  const requestHost = req.headers.host;
  const hostname = String(req.hostname ?? (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost ?? requestHost ?? "localhost")).split(",")[0].split(":")[0] || "localhost";
  const domain = getConfiguredCookieDomain(hostname);

  return {
    domain,
    httpOnly: true,
    path: "/",
    // The Expo web client and API use sibling subdomains, which are same-site.
    // Lax avoids browsers rejecting the session as an unnecessary third-party cookie.
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}

