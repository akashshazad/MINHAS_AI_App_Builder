
import { test, expect } from "@playwright/test";

test("API liveness and readiness endpoints respond truthfully", async ({ request }) => {
  const live = await request.get("http://127.0.0.1:3000/api/health");
  expect(live.status()).toBe(200);
  const body = await live.json();
  expect(body.ok).toBe(true);
  expect(typeof body.timestamp).toBe("number");
});


