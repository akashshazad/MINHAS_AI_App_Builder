
import { describe, expect, it } from "vitest";
import { createNativeBuildService } from "./service";
import http from "node:http";

function request(app: ReturnType<typeof createNativeBuildService>, options: { method: string; path: string; body?: unknown; token?: string }) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address(); if (!address || typeof address === "string") return reject(new Error("No address"));
      const body = options.body === undefined ? "" : JSON.stringify(options.body);
      const req = http.request({ hostname: "127.0.0.1", port: address.port, path: options.path, method: options.method, headers: { "content-type": "application/json", ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) } }, (res) => {
        let data = ""; res.setEncoding("utf8"); res.on("data", (chunk) => data += chunk); res.on("end", () => { server.close(); resolve({ status: res.statusCode || 0, body: data ? JSON.parse(data) : {} }); });
      });
      req.on("error", reject); if (body) req.write(body); req.end();
    });
  });
}

describe("native build service", () => {
  it("rejects protected endpoints without authentication", async () => {
    process.env.BUILD_SERVICE_TOKEN = "test-token";
    const app = createNativeBuildService();
    const result = await request(app, { method: "GET", path: "/v1/builds/nope" });
    expect(result.status).toBe(401);
  });
  it("validates the native worker contract before queueing", async () => {
    process.env.BUILD_SERVICE_TOKEN = "test-token";
    const app = createNativeBuildService();
    const result = await request(app, { method: "POST", path: "/v1/builds", token: "test-token", body: { engine: "native" } });
    expect(result.status).toBe(400);
  });
});


