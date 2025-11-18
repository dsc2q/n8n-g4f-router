import { Router, Request, Response } from 'express';
import axios from 'axios';
import { providerManager } from '../services/providerManager';
import { config } from '../config';

const router = Router();

const apiClient = axios.create({
  baseURL: config.g4fUpstreamUrl,
  timeout: 60000,
});

router.post('/chat/completions', async (req: Request, res: Response) => {
  const originalModel = req.body.model;
  const isStreaming = req.body.stream || false;

  const providerNames = providerManager.getProviderNamesForModel(originalModel);

  if (!providerNames || providerNames.length === 0) {
    return res.status(503).json({
      error: `Model "${originalModel}" is not mapped to any g4f provider.`,
    });
  }

  let lastError: any = null;
  let successful = false;

  for (const providerName of providerNames) {
    const provider = providerManager.getProvider(providerName);

    if (!provider || !provider.healthy) {
      console.log(`[ROUTER] Skipping provider ${providerName} as it is currently unhealthy.`);
      continue;
    }

    const forwardPayload = {
      ...req.body,
      model: providerName,
    };

    try {
      console.log(`[ROUTER] Attempting to proxy request to provider: ${providerName}`);
      
      const g4fResponse = await apiClient.post(
        '/v1/chat/completions',
        forwardPayload,
        {
          responseType: isStreaming ? 'stream' : 'json',
        }
      );

      if (isStreaming) {
        res.setHeader('Content-Type', 'text/event-stream');
        g4fResponse.data.pipe(res);
      } else {
        res.status(g4fResponse.status).json(g4fResponse.data);
      }
      successful = true;
      console.log(`[ROUTER] Successfully proxied request via provider: ${providerName}`);
      break;
      
    } catch (error: any) {
      providerManager.reportFailure(providerName);
      console.error(
        `[ROUTER] Failed to proxy request to provider ${providerName}. Retrying...`,
        error.message || error
      );
      lastError = error;
    }
  }

  if (!successful) {
    let errorStatus = 503;
    let errorMessage = `All providers failed for model: ${originalModel}. Last error: ${
      lastError?.message || 'Unknown error.'
    }`;

    if (lastError?.response) {
      errorStatus = lastError.response.status || 500;
      errorMessage = lastError.response.data?.error || lastError.response.data?.message || lastError.message;
    }

    return res.status(errorStatus).json({
      error: errorMessage,
    });
  }
});

export { router as openAIRouter };