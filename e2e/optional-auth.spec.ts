import { test, expect } from "@playwright/test";

test("core MINHAS workspace authentication does not require Manus OAuth", async ({ request }) => {
  const apiURL = process.env.E2E_API_URL || "http://127.0.0.1:3000";
  const response = await request.post(`${apiURL}/api/auth/anonymous`);
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.authMode).toBe("anonymous");
  expect(body.user.loginMethod).toBe("anonymous");
  expect(body.app_session_id).toEqual(expect.any(String));
});

test("optional Manus OAuth rejects incomplete PKCE exchange honestly", async ({ request }) => {
  const apiURL = process.env.E2E_API_URL || "http://127.0.0.1:3000";
  const response = await request.get(`${apiURL}/api/oauth/mobile?code=missing-pkce&state=missing-pkce`);
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain("code_verifier");
});
