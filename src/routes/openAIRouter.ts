import { Router, Request, Response } from 'express';
import axios from 'axios';
import { providerManager } from '../services/providerManager';
import { config } from '../config';

const router = Router();

const apiClient = axios.create({
  baseURL: config.g4fUpstreamUrl,
  timeout: 120000, // 2 minutes — large models can be slow
});

/**
 * GET /v1/models
 * Returns the list of supported models in OpenAI format.
 * Required by n8n's OpenAI node to populate the model selector.
 */
router.get('/models', (_req: Request, res: Response) => {
  const models = providerManager.getSupportedModels().map((id) => ({
    id,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'g4f',
  }));

  res.status(200).json({
    object: 'list',
    data: models,
  });
});

/**
 * POST /v1/chat/completions
 * Main completion endpoint — proxies the request to the first healthy
 * g4f provider that supports the requested model, with automatic failover.
 */
router.post('/chat/completions', async (req: Request, res: Response) => {
  const originalModel = req.body.model;
  const isStreaming = req.body.stream === true;

  if (!originalModel) {
    res.status(400).json({
      error: {
        message: 'Bad Request: "model" field is required.',
        type: 'invalid_request_error',
        code: 'missing_model',
      },
    });
    return;
  }

  const providerNames = providerManager.getProviderNamesForModel(originalModel);

  if (!providerNames || providerNames.length === 0) {
    res.status(503).json({
      error: {
        message: `Model "${originalModel}" is not mapped to any g4f provider.`,
        type: 'service_unavailable',
        code: 'model_not_supported',
      },
    });
    return;
  }

  let lastError: unknown = null;

  for (const providerName of providerNames) {
    const provider = providerManager.getProvider(providerName);

    if (!provider || !provider.healthy) {
      console.log(
        `[ROUTER] Skipping provider ${providerName} — currently unhealthy.`
      );
      continue;
    }

    // Build the payload: replace the model name with the provider name
    // (g4f uses provider names in the model field)
    const forwardPayload = {
      ...req.body,
      model: providerName,
    };

    try {
      console.log(
        `[ROUTER] Attempting provider: ${providerName} (model: ${originalModel})`
      );

      if (isStreaming) {
        // ---- Streaming response ----
        const upstreamResponse = await apiClient.post(
          '/v1/chat/completions',
          forwardPayload,
          { responseType: 'stream', timeout: 120000 }
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-G4F-Provider', providerName);
        res.status(200);

        upstreamResponse.data.pipe(res);

        upstreamResponse.data.on('error', (err: Error) => {
          console.error(`[ROUTER] Stream error from ${providerName}:`, err.message);
          providerManager.markUnhealthy(providerName);
          if (!res.headersSent) {
            res.status(502).json({
              error: {
                message: 'Stream error from upstream provider.',
                type: 'upstream_error',
                code: 'stream_error',
              },
            });
          }
        });

        return;
      } else {
        // ---- Non-streaming response ----
        const upstreamResponse = await apiClient.post(
          '/v1/chat/completions',
          forwardPayload,
          { timeout: 120000 }
        );

        console.log(
          `[ROUTER] ✅ Success via provider: ${providerName}`
        );

        res.setHeader('X-G4F-Provider', providerName);
        res.status(200).json(upstreamResponse.data);
        return;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[ROUTER] ❌ Provider ${providerName} failed: ${errMsg}. Trying next...`
      );
      providerManager.markUnhealthy(providerName);
      lastError = err;
      continue;
    }
  }

  // All providers failed
  console.error(
    `[ROUTER] All providers exhausted for model "${originalModel}".`
  );
  const errMessage =
    lastError instanceof Error ? lastError.message : 'All providers failed.';

  res.status(503).json({
    error: {
      message: `All providers for model "${originalModel}" are currently unavailable. Last error: ${errMessage}`,
      type: 'service_unavailable',
      code: 'all_providers_failed',
    },
  });
});

export { router as openAIRouter };