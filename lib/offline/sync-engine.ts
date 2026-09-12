
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SyncOperation<T = unknown> = {
  id: string;
  type: string;
  payload: T;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type SyncTransport = (operations: SyncOperation[]) => Promise<{ acknowledgedIds: string[]; conflicts?: Array<{ id: string; reason: string }> }>;

export class OfflineSyncEngine {
  private readonly queueKey: string;
  private readonly cachePrefix: string;
  private flushing = false;

  constructor(private readonly namespace: string, private readonly transport: SyncTransport) {
    this.queueKey = `minhas:offline:${namespace}:outbox`;
    this.cachePrefix = `minhas:offline:${namespace}:cache:`;
  }

  async read<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(this.cachePrefix + key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async write<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(this.cachePrefix + key, JSON.stringify(value));
  }

  async enqueue<T>(type: string, payload: T): Promise<SyncOperation<T>> {
    const operation: SyncOperation<T> = { id: cryptoRandomId(), type, payload, createdAt: Date.now(), attempts: 0 };
    const queue = await this.readQueue();
    queue.push(operation);
    await this.writeQueue(queue);
    return operation;
  }

  async pendingCount(): Promise<number> {
    return (await this.readQueue()).length;
  }

  async flush(): Promise<{ acknowledged: number; conflicts: number; remaining: number }> {
    if (this.flushing) return { acknowledged: 0, conflicts: 0, remaining: await this.pendingCount() };
    this.flushing = true;
    try {
      const queue = await this.readQueue();
      if (!queue.length) return { acknowledged: 0, conflicts: 0, remaining: 0 };
      let result;
      try {
        result = await this.transport(queue);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        await this.writeQueue(queue.map((op) => ({ ...op, attempts: op.attempts + 1, lastError: message })));
        return { acknowledged: 0, conflicts: 0, remaining: queue.length };
      }
      const acknowledged = new Set(result.acknowledgedIds);
      const conflicts = new Set((result.conflicts ?? []).map((item) => item.id));
      const remaining = queue.filter((op) => !acknowledged.has(op.id) && !conflicts.has(op.id));
      await this.writeQueue(remaining.map((op) => ({ ...op, attempts: op.attempts + 1 })));
      return { acknowledged: acknowledged.size, conflicts: conflicts.size, remaining: remaining.length };
    } finally {
      this.flushing = false;
    }
  }

  async clearNamespace(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const owned = keys.filter((key) => key === this.queueKey || key.startsWith(this.cachePrefix));
    if (owned.length) await AsyncStorage.multiRemove(owned);
  }

  private async readQueue(): Promise<SyncOperation[]> {
    const raw = await AsyncStorage.getItem(this.queueKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeQueue(queue: SyncOperation[]): Promise<void> {
    await AsyncStorage.setItem(this.queueKey, JSON.stringify(queue));
  }
}

function cryptoRandomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}


