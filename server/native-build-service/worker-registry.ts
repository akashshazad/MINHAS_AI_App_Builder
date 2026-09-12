
import crypto from "node:crypto";
import { DurableBuildStore } from "./durable-store";

export type WorkerState = "ready" | "busy" | "draining";

export class WorkerRegistry {
  readonly workerId = `${process.env.HOSTNAME || "worker"}-${crypto.randomUUID()}`;
  constructor(private readonly store = new DurableBuildStore(), private readonly leaseMs = Number(process.env.BUILD_WORKER_LEASE_MS || 120000)) {}
  async start() {
    if (!this.store.configured) return;
    await this.store.ensure();
    await this.store.registerWorker(this.workerId, this.leaseMs);
  }
  async heartbeat(state: WorkerState = "ready") {
    if (!this.store.configured) return;
    await this.store.heartbeatWorker(this.workerId, this.leaseMs, state);
  }
  async list() { return this.store.configured ? this.store.listWorkers() : []; }
  async stop() {
    if (!this.store.configured) return;
    await this.store.removeWorker(this.workerId);
    await this.store.close();
  }
}


