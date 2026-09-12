
export async function getHAHealth(queue: { durable: boolean; workers: () => Promise<any[]> }) {
  const workers = await queue.workers();
  const ready = workers.filter((w) => w.status === "ready").length;
  const busy = workers.filter((w) => w.status === "busy").length;
  const draining = workers.filter((w) => w.status === "draining").length;
  return { workerCount: workers.length, ready, busy, draining, healthy: queue.durable && workers.length > 0, workers };
}


