
export type RefreshState = string | null | undefined;

export function adaptiveRefetchInterval(
  state: RefreshState,
  options: { activeMs?: number; maxMs?: number; idleMs?: number } = {},
): number | false {
  const { activeMs = 4000, maxMs = 30000, idleMs = 0 } = options;
  if (!state) return false;
  const normalized = state.toLowerCase();
  const terminal = ["passed", "failed", "cancelled", "canceled", "completed", "verified", "published", "rolled_back", "stopped", "error"];
  if (terminal.some((value) => normalized.includes(value))) return false;
  if (idleMs > 0 && ["queued", "starting", "pending"].includes(normalized)) return Math.min(activeMs * 2, maxMs);
  return Math.min(activeMs, maxMs);
}


