import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

interface Provider {
  name: string;
  healthy: boolean;
  lastCheck: number;
}

class ProviderManager {
  private apiClient: AxiosInstance;
  private providers: Map<string, Provider> = new Map();

  private allProviderNames: string[] = [
    'Gemini',
    'Gpt4freePro',
    'Groq',
    'HuggingFace',
    'Nvidia',
    'Ollama',
    'OpenRouter',
    'DeepInfra',
    'Anondrop',
    'Airforce',
    'MetaAI',
    'Phind',
    'You',
    'Bing',
    'Pi',
    'GeekGpt',
    'Liaobots',
    'Raycast',
    'Pollinations',
  ];

  private modelToProvidersMap: Record<string, string[]> = {
    'gpt-5-nano': ['Gpt4freePro', 'OpenRouter', 'Liaobots'],
    'gpt-5-mini': ['Gpt4freePro', 'OpenRouter', 'Liaobots'],
    'gpt-5-chat': ['Gpt4freePro', 'OpenRouter', 'Liaobots'],
    'grok-4': ['Gpt4freePro', 'OpenRouter'],
    'grok-3-mini': ['Gpt4freePro', 'OpenRouter'],
    'deepseek-v3': ['Gpt4freePro', 'DeepInfra', 'OpenRouter'],
    'mistral-small-3.1-24b': ['Gpt4freePro', 'DeepInfra', 'OpenRouter'],
    'gemini-2.5-flash-lite': ['Gemini', 'Gpt4freePro'],
    'gpt-4': ['Bing', 'Gpt4freePro', 'You', 'Phind', 'GeekGpt', 'Liaobots', 'Raycast'],
    'gpt-4o': ['Gpt4freePro', 'OpenRouter'],
    'gpt-4-turbo': ['Bing', 'Gpt4freePro', 'OpenRouter'],
    'gpt-3.5-turbo': ['Gpt4freePro', 'ChatBase', 'DeepInfra', 'GeekGpt', 'Liaobots'],
    'llama-3-70b': ['Groq', 'MetaAI', 'OpenRouter'],
    'llama-3-8b': ['Groq', 'MetaAI', 'HuggingFace'],
    'gemini-pro': ['Gemini'],
    'mixtral-8x7b': ['Groq', 'HuggingFace'],
    'pi': ['Pi'],
    'default': ['Gpt4freePro', 'MetaAI', 'Phind', 'Groq', 'Gemini', 'Pollinations'],
  };

  constructor() {
    this.apiClient = axios.create({
      baseURL: config.g4fUpstreamUrl,
      timeout: 10000,
    });

    this.allProviderNames.forEach((name) => {
      this.providers.set(name, {
        name,
        healthy: false,
        lastCheck: 0,
      });
    });
  }

  public startHealthChecks() {
    console.log('[MANAGER] Starting initial health checks...');
    this.runAllHealthChecks();

    setInterval(
      () => this.runAllHealthChecks(),
      config.healthCheckInterval
    );
  }

  private async runAllHealthChecks() {
    console.log('[MANAGER] Running periodic health checks...');
    const checks = this.allProviderNames.map((name) =>
      this.checkProvider(name)
    );
    await Promise.allSettled(checks);
  }

  private async checkProvider(name: string) {
    const provider = this.providers.get(name)!;
    try {
      const testPayload = {
        model: name,
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      };

      await this.apiClient.post('/v1/chat/completions', testPayload);

      if (!provider.healthy) {
        console.log(`[MANAGER] Provider ${name} is now HEALTHY.`);
      }
      provider.healthy = true;
    } catch (error) {
      if (provider.healthy) {
        console.warn(`[MANAGER] Provider ${name} is now UNHEALTHY.`);
      }
      provider.healthy = false;
    } finally {
      provider.lastCheck = Date.now();
    }
  }

  private _getProviderNamesForModel(modelName: string): string[] {
    let providerList = this.modelToProvidersMap[modelName];

    if (!providerList) {
      const sortedKeys = Object.keys(this.modelToProvidersMap)
        .filter((key) => key !== 'default')
        .sort((a, b) => b.length - a.length);

      const matchingKey = sortedKeys.find(
        (key) => modelName.startsWith(key)
      );

      if (matchingKey) {
        console.log(
          `[MANAGER] Partial match found: "${modelName}" will use map for "${matchingKey}".`
        );
        providerList = this.modelToProvidersMap[matchingKey];
      }
    }

    if (!providerList) {
      console.warn(
        `[MANAGER] Model "${modelName}" not in map, using default providers.`
      );
      providerList = this.modelToProvidersMap['default'];
    }

    return providerList || [];
  }

  public getProvider(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  public getProviderNamesForModel(modelName: string): string[] {
    return this._getProviderNamesForModel(modelName);
  }

  public getHealthyProviderForModel(modelName: string): Provider | undefined {
    const providerList = this._getProviderNamesForModel(modelName);

    for (const providerName of providerList) {
      const provider = this.getProvider(providerName);
      if (provider && provider.healthy) {
        console.log(
          `[MANAGER] Found healthy provider "${providerName}" for model "${modelName}".`
        );
        return provider;
      }
    }

    console.error(
      `[MANAGER] No healthy provider found for model "${modelName}".`
    );
    return undefined;
  }

  public reportFailure(name: string) {
    const provider = this.providers.get(name);
    if (provider) {
      console.warn(
        `[MANAGER] Reporting immediate failure for ${name}. Marking as UNHEALTHY.`
      );
      provider.healthy = false;
      provider.lastCheck = Date.now();
    }
  }
}

export const providerManager = new ProviderManager();