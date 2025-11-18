import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authenticateRequest } from './middleware/auth';
import { openAIRouter } from './routes/openAIRouter';
import { providerManager } from './services/providerManager';

const app = express();

app.use(cors());
app.use(express.json());
app.use(authenticateRequest);

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'n8n-g4f-router is online.',
  });
});

app.use('/v1', openAIRouter);

const startServer = () => {
  app.listen(config.port, () => {
    console.log(`[SERVER] n8n-g4f-router started on port ${config.port}`);
    console.log(`[SERVER] Connecting to g4f at: ${config.g4fUpstreamUrl}`);
    
    providerManager.startHealthChecks();
  });
};

startServer();