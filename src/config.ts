import 'dotenv/config';

/**
 * Reads a required environment variable.
 * Throws a clear error at startup if the variable is missing.
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[CONFIG] Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  /** Port the HTTP server listens on */
  port: parseInt(process.env.ROUTER_PORT || '3000', 10),

  /** Bearer token that protects the router API */
  apiKey: getRequiredEnv('ROUTER_API_KEY'),

  /** Base URL of the upstream g4f service */
  g4fUpstreamUrl: process.env.G4F_UPSTREAM_URL || 'http://g4f:8080',

  /** Interval in ms between provider health checks (default: 5 minutes) */
  healthCheckIntervalMs: parseInt(
    process.env.HEALTH_CHECK_INTERVAL_MS || '300000',
    10
  ),
};