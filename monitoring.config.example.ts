
/**
 * Monitoring configuration contract. Keep DSNs/keys in environment variables only.
 * Install @sentry/react-native (or an approved equivalent) in the deployment profile
 * when live error ingestion is enabled; never commit credentials here.
 */
export const monitoringConfig = {
  provider: process.env.EXPO_PUBLIC_ERROR_MONITORING_PROVIDER || "none",
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
  environment: process.env.EXPO_PUBLIC_APP_ENV || process.env.NODE_ENV || "development",
  release: process.env.EXPO_PUBLIC_APP_RELEASE || "MINHAS-AI-App-Builder@4.3.0",
};


