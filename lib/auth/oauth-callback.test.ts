import { describe, expect, it } from "vitest";
import { parseOAuthCallback } from "./oauth-callback";

describe("native OAuth callback validation", () => {
  it("extracts code and state from a deep link", () => {
    expect(parseOAuthCallback("manus123://oauth/callback?code=abc_123&state=state-456")).toEqual({
      code: "abc_123",
      state: "state-456",
      error: null,
      sessionToken: null,
    });
  });

  it("rejects unsafe and oversized callback values", () => {
    expect(parseOAuthCallback("manus123://oauth/callback?code=%3Cscript%3E&state=ok").code).toBeNull();
    expect(parseOAuthCallback("", { code: "a".repeat(4097), state: "ok" }).code).toBeNull();
  });
});
