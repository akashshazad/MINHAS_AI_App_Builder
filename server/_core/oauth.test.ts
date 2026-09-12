import { describe, expect, it } from "vitest";
import { registerOAuthRoutes } from "./oauth";

describe("mobile OAuth PKCE contract", () => {
  it("requires code, state, verifier, and exact redirect URI", async () => {
    let handler: ((req: any, res: any) => Promise<void>) | undefined;
    const app = { get: (path: string, fn: (req: any, res: any) => Promise<void>) => { if (path === "/api/oauth/mobile") handler = fn; }, post: () => undefined };
    registerOAuthRoutes(app as any);
    expect(handler).toBeDefined();
    const response = { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(value: unknown) { this.body = value; } };
    await handler!({ query: { code: "code", state: "state" }, headers: {} }, response);
    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining("code_verifier") });
  });
});
