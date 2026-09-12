
import { describe, expect, it, vi } from "vitest";
import { OfflineSyncEngine } from "./sync-engine";

const memory = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => void memory.set(key, value),
    getAllKeys: async () => [...memory.keys()],
    multiRemove: async (keys: string[]) => keys.forEach((key) => memory.delete(key)),
  },
}));

describe("OfflineSyncEngine", () => {
  it("persists mutations while offline and acknowledges them after reconnect", async () => {
    const transport = vi.fn(async (ops: any[]) => ({ acknowledgedIds: ops.map((op) => op.id) }));
    const engine = new OfflineSyncEngine("test", transport);
    await engine.write("project", { id: 7, name: "MINHAS" });
    await engine.enqueue("project.update", { projectId: 7, name: "MINHAS AI" });
    expect(await engine.read("project")).toEqual({ id: 7, name: "MINHAS" });
    expect(await engine.pendingCount()).toBe(1);
    expect((await engine.flush()).acknowledged).toBe(1);
    expect(await engine.pendingCount()).toBe(0);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("retains operations on transport failure for retry", async () => {
    const transport = vi.fn(async () => { throw new Error("offline"); });
    const engine = new OfflineSyncEngine("retry", transport);
    await engine.enqueue("file.update", { path: "app.tsx" });
    const result = await engine.flush();
    expect(result.remaining).toBe(1);
    expect(await engine.pendingCount()).toBe(1);
  });
});


