import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

interface Provider {
  name: string;
  healthy: boolean;
  lastCheck: number;
  failureCount: number;
}

class ProviderManager {
  private apiClient: AxiosInstance;
  private providers: Map<string, Provider> = new Map();

  /**
   * Full list of g4f providers to health-check.
   * Updated for g4f 2025/2026 — only providers that are stable and active.
   */
  private allProviderNames: string[] = [
    'Blackbox',
    'DeepInfra',
    'DDG',
    'FreeGpt',
    'Gemini',
    'Groq',
    'HuggingFace',
    'Ollama',
    'OpenRouter',
    'PerplexityLabs',
    'Pizzagpt',
    'Pollinations',
    'PollinationsAI',
    'You',
  ];

  /**
   * Maps OpenAI-compatible model names to the g4f providers that support them.
   * Providers are ordered by preference (first = highest priority).
   * Updated for 2025/2026 with current model names.
   */
  private modelToProvidersMap: Record<string, string[]> = {
    // GPT-4o family
    'gpt-4o': ['Blackbox', 'OpenRouter', 'DDG'],
    'gpt-4o-mini': ['Blackbox', 'DDG', 'OpenRouter', 'Pollinations'],

    // GPT-4 family
    'gpt-4': ['Blackbox', 'OpenRouter', 'You'],
    'gpt-4-turbo': ['Blackbox', 'OpenRouter'],

    // GPT-3.5
    'gpt-3.5-turbo': ['Blackbox', 'DDG', 'FreeGpt', 'Pizzagpt', 'OpenRouter'],

    // Gemini family
    'gemini-1.5-flash': ['Gemini', 'Pollinations'],
    'gemini-1.5-pro': ['Gemini'],
    'gemini-2.0-flash': ['Gemini', 'PollinationsAI'],
    'gemini-2.5-flash': ['Gemini'],

    // Claude family
    'claude-3-haiku': ['OpenRouter', 'DDG'],
    'claude-3-sonnet': ['OpenRouter'],
    'claude-3-opus': ['OpenRouter'],
    'claude-3-5-sonnet': ['OpenRouter'],
    'claude-3-7-sonnet': ['OpenRouter'],

    // Llama family
    'llama-3.1-8b': ['Groq', 'HuggingFace', 'OpenRouter', 'PerplexityLabs'],
    'llama-3.1-70b': ['Groq', 'OpenRouter', 'PerplexityLabs'],
    'llama-3.3-70b': ['Groq', 'OpenRouter'],
    'llama-3-8b': ['Groq', 'HuggingFace'],
    'llama-3-70b': ['Groq', 'OpenRouter'],

    // DeepSeek family
    'deepseek-v3': ['DeepInfra', 'OpenRouter', 'Blackbox'],
    'deepseek-r1': ['DeepInfra', 'OpenRouter', 'Blackbox'],
    'deepseek-chat': ['DeepInfra', 'OpenRouter'],

    // Mistral family
    'mixtral-8x7b': ['Groq', 'HuggingFace', 'DeepInfra'],
    'mistral-7b': ['HuggingFace', 'DeepInfra', 'OpenRouter'],
    'mistral-small': ['DeepInfra', 'OpenRouter'],

    // Qwen family
    'qwen-2.5-72b': ['HuggingFace', 'OpenRouter'],
    'qwen-2-72b': ['HuggingFace', 'OpenRouter'],

    // Blackbox specific
    'blackboxai': ['Blackbox'],
    'blackboxai-pro': ['Blackbox'],

    // Local / Ollama
    'ollama': ['Ollama'],

    // Default fallback for unknown models
    'default': ['Blackbox', 'DDG', 'OpenRouter', 'Pollinations', 'Groq', 'Gemini'],
  };

  constructor() {
    this.apiClient = axios.create({
      baseURL: config.g4fUpstreamUrl,
      timeout: 15000,
    });

    // Initialize all providers as unhealthy (will be updated by health checks)
    this.allProviderNames.forEach((name) => {
      this.providers.set(name, {
        name,
        healthy: false,
        lastCheck: 0,
        failureCount: 0,
      });
    });
  }

  /**
   * Starts the periodic health check loop.
   * Runs immediately on startup, then on the configured interval.
   */
  public startHealthChecks(): void {
    console.log('[MANAGER] Starting initial health checks...');
    this.runAllHealthChecks();

    setInterval(
      () => this.runAllHealthChecks(),
      config.healthCheckIntervalMs
    );
  }

  /**
   * Runs health checks for all registered providers in parallel.
   */
  private async runAllHealthChecks(): Promise<void> {
    console.log(`[MANAGER] Running health checks for ${this.allProviderNames.length} providers...`);

    const checks = this.allProviderNames.map((name) =>
      this.checkProviderHealth(name)
    );

    await Promise.allSettled(checks);

    const healthy = [...this.providers.values()].filter((p) => p.healthy);
    console.log(
      `[MANAGER] Health check complete: ${healthy.length}/${this.allProviderNames.length} providers healthy.`
    );
    if (healthy.length > 0) {
      console.log(`[MANAGER] Healthy: ${healthy.map((p) => p.name).join(', ')}`);
    }
  }

  /**
   * Health-checks a single provider by querying the g4f /v1/models endpoint.
   * Using /v1/models is cheap — no token generation needed.
   */
  private async checkProviderHealth(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    if (!provider) return;

    try {
      // Try GET /v1/models first (cheapest check)
      await this.apiClient.get('/v1/models', {
        params: { provider: providerName },
        timeout: 10000,
      });

      if (!provider.healthy) {
        console.log(`[MANAGER] ✅ Provider ${providerName} is now HEALTHY.`);
      }
      provider.healthy = true;
      provider.failureCount = 0;
    } catch {
      // Fallback: try a minimal chat completion to verify the provider works
      try {
        await this.apiClient.post(
          '/v1/chat/completions',
          {
            model: providerName,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5,
            stream: false,
          },
          { timeout: 12000 }
        );

        if (!provider.healthy) {
          console.log(`[MANAGER] ✅ Provider ${providerName} is now HEALTHY (via completion check).`);
        }
        provider.healthy = true;
        provider.failureCount = 0;
      } catch {
        provider.failureCount += 1;
        if (provider.healthy || provider.failureCount === 1) {
          console.warn(
            `[MANAGER] ❌ Provider ${providerName} is UNHEALTHY (failures: ${provider.failureCount}).`
          );
        }
        provider.healthy = false;
      }
    }

    provider.lastCheck = Date.now();
  }

  /**
   * Returns the provider names mapped to a given model.
   * Falls back to 'default' if no specific mapping exists.
   */
  public getProviderNamesForModel(model: string): string[] {
    return (
      this.modelToProvidersMap[model] ||
      this.modelToProvidersMap['default'] ||
      []
    );
  }

  /**
   * Returns a specific provider by name.
   */
  public getProvider(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  /**
   * Returns a snapshot of all providers and their status.
   */
  public getAllProviders(): Provider[] {
    return [...this.providers.values()];
  }

  /**
   * Returns all unique model names that this router supports.
   */
  public getSupportedModels(): string[] {
    return Object.keys(this.modelToProvidersMap).filter(
      (m) => m !== 'default'
    );
  }

  /**
   * Marks a provider as unhealthy immediately (called on request failure).
   */
  public markUnhealthy(name: string): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.healthy = false;
      provider.failureCount += 1;
      console.warn(`[MANAGER] Provider ${name} marked unhealthy after request failure.`);
    }
  }
}

// Singleton instance shared across the application
export const providerManager = new ProviderManager();