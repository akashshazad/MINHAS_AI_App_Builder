
import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

describe("session cookie options", () => {
  it("shares the cookie across preview subdomains with same-site protection", () => {
    const options = getSessionCookieOptions({ hostname: "3000-example.us1.manus.computer", protocol: "http", headers: { "x-forwarded-proto": "https" } } as any);
    expect(options).toMatchObject({ domain: ".manus.computer", sameSite: "lax", secure: true, httpOnly: true, path: "/" });
  });

  it("does not set an invalid Domain attribute for localhost", () => {
    const options = getSessionCookieOptions({ hostname: "localhost", protocol: "http", headers: {} } as any);
    expect(options.domain).toBeUndefined();
    expect(options.secure).toBe(false);
  });
});


