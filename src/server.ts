import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authenticateRequest } from './middleware/auth';
import { openAIRouter } from './routes/openAIRouter';
import { providerManager } from './services/providerManager';

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(authenticateRequest);

// ── Public routes (no auth required) ───────────────────────────────────────

/** Root endpoint — basic status info */
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    name: 'n8n-g4f-router',
    version: '2.0.0',
    message: 'Router is online. Use /v1/chat/completions to send requests.',
    docs: 'https://github.com/dsc2q/n8n-g4f-router',
  });
});

/** Health endpoint — used by Docker HEALTHCHECK and monitoring tools */
app.get('/health', (_req, res) => {
  const providers = providerManager.getAllProviders();
  const healthyCount = providers.filter((p) => p.healthy).length;
  const totalCount = providers.length;

  const status = healthyCount > 0 ? 'healthy' : 'degraded';

  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    providers: {
      healthy: healthyCount,
      total: totalCount,
      list: providers.map((p) => ({
        name: p.name,
        healthy: p.healthy,
        failureCount: p.failureCount,
        lastCheck: p.lastCheck > 0
          ? new Date(p.lastCheck).toISOString()
          : 'never',
      })),
    },
    upstreamUrl: config.g4fUpstreamUrl,
    timestamp: new Date().toISOString(),
  });
});

// ── OpenAI-compatible routes ────────────────────────────────────────────────
app.use('/v1', openAIRouter);

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: {
      message: 'Not Found.',
      type: 'invalid_request_error',
      code: 'not_found',
    },
  });
});

// ── Server startup ──────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log(`\n══════════════════════════════════════════════`);
  console.log(`  n8n-g4f-router v2.0.0`);
  console.log(`══════════════════════════════════════════════`);
  console.log(`  Listening on  : http://localhost:${config.port}`);
  console.log(`  g4f upstream  : ${config.g4fUpstreamUrl}`);
  console.log(`  Health checks : every ${config.healthCheckIntervalMs / 1000}s`);
  console.log(`══════════════════════════════════════════════\n`);

  // Start background health checks after server is ready
  providerManager.startHealthChecks();
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
const shutdown = (signal: string) => {
  console.log(`\n[SERVER] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[SERVER] HTTP server closed. Exiting.');
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('[SERVER] Forced exit after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));