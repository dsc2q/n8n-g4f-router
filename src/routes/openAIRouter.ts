import { Router, Request, Response } from 'express';
import axios from 'axios';
import { providerManager } from '../services/providerManager';
import { config } from '../config';

const router = Router();

const apiClient = axios.create({
  baseURL: config.g4fUpstreamUrl,
  timeout: 60000, // 60 second timeout for AI responses
});

router.post('/chat/completions', async (req: Request, res: Response) => {
  const originalModel = req.body.model;
  const isStreaming = req.body.stream || false;

  const provider = providerManager.getHealthyProviderForModel(originalModel);

  if (!provider) {
    return res.status(503).json({
      error: `No healthy provider found for model: ${originalModel}`,
    });
  }

  const forwardPayload = {
    ...req.body,
    model: provider.name,
  };

  try {
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
  } catch (error) {
    providerManager.reportFailure(provider.name);
    console.error(
      `[ROUTER] Failed to proxy request to provider ${provider.name}`,
      error
    );
    return res.status(500).json({
      error: `Request failed after routing to provider: ${provider.name}`,
    });
  }
});

export { router as openAIRouter };