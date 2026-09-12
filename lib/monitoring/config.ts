
import { configureErrorMonitoring, createSentryReporter } from ".";

export function initializeMonitoring() {
  configureErrorMonitoring(createSentryReporter());
}


