
import { afterEach, describe, expect, it } from "vitest";
import { evaluateProductionGate, getExactRedirectAllowlist } from "./production-gate";

describe("production gate", () => {
  const original = process.env.OAUTH_ALLOWED_REDIRECT_URIS;
  afterEach(() => {
    if (original === undefined) delete process.env.OAUTH_ALLOWED_REDIRECT_URIS;
    else process.env.OAUTH_ALLOWED_REDIRECT_URIS = original;
  });

  it("blocks code-only readiness when runtime evidence is missing", () => {
    process.env.OAUTH_ALLOWED_REDIRECT_URIS = "";
    const result = evaluateProductionGate({ buildStatus: "passed", previewUrl: null, testStatus: "passed", securityStatus: "passed", securityCritical: 0, securityHigh: 0, snapshotCount: 1, artifactCount: 1 });
    expect(result.status).toBe("BLOCKED");
    expect(result.checks.find((check) => check.key === "auth")?.state).toBe("BLOCKED");
  });

  it("rejects wildcard redirect entries", () => {
    process.env.OAUTH_ALLOWED_REDIRECT_URIS = "https://example.com/*,https://example.com/api/oauth/callback";
    expect(getExactRedirectAllowlist()).toEqual(["https://example.com/api/oauth/callback"]);
  });
});


