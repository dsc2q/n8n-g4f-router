import 'dotenv/config';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.ROUTER_PORT || '3000', 10),
  apiKey: getEnv('ROUTER_API_KEY'),
  g4fUpstreamUrl: getEnv('G4F_UPSTREAM_URL'),
  healthCheckInterval: parseInt(
    process.env.HEALTH_CHECK_INTERVAL_MS || '300000',
    10
  ),
};