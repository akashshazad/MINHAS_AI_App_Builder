
import process from "node:process";

let playwright;
try {
  playwright = await import("@playwright/test");
} catch {
  console.error("[E2E BLOCKED] Playwright is not installed. Install @playwright/test in the network-enabled CI/developer environment, then rerun pnpm run e2e.");
  process.exit(2);
}

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:8081";
const apiURL = process.env.E2E_API_URL || "http://127.0.0.1:3000";
const browser = await playwright.chromium.launch({ headless: true });
const page = await browser.newPage();
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
try {
  const live = await page.request.get(`${apiURL}/api/health`);
  if (!live.ok()) throw new Error(`API health returned HTTP ${live.status()}`);
  const body = await live.json();
  if (body?.ok !== true) throw new Error("API health did not report ok=true");
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
  if (failures.length) throw new Error(`Page runtime errors: ${failures.join(" | ")}`);
  console.log("E2E PASS: API health + Expo web shell smoke flow");
} finally {
  await browser.close();
}


