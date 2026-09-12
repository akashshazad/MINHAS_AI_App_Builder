
export type ErrorContext = { component?: string; route?: string; userId?: string; projectId?: number | string; extra?: Record<string, unknown> };
export type MonitoringEvent = { error: Error; context?: ErrorContext };

let reporter: ((event: MonitoringEvent) => void) | null = null;

export function configureErrorMonitoring(nextReporter?: (event: MonitoringEvent) => void) {
  reporter = nextReporter ?? null;
}

export function reportError(error: unknown, context?: ErrorContext) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  if (reporter) reporter({ error: normalized, context });
  if (process.env.NODE_ENV !== "production") console.error("[monitoring]", normalized, context);
}

export function createSentryReporter(dsn = process.env.EXPO_PUBLIC_SENTRY_DSN) {
  if (!dsn) return undefined;
  return ({ error, context }: MonitoringEvent) => {
    // Sentry SDK wiring is intentionally adapter-based so the core app has no hard dependency or secret.
    globalThis.__MINHAS_SENTRY_REPORT__?.({ dsn, error, context });
  };
}

declare global {
  // Optional host-provided Sentry bridge. It must never receive secrets.
  var __MINHAS_SENTRY_REPORT__: ((event: { dsn: string; error: Error; context?: ErrorContext }) => void) | undefined;
}


