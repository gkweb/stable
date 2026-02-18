import type { LLMProvider } from '@stable/core';
import { LLMError } from '@stable/core';
import type { Config } from '../config/index.js';
import { getEffectiveApiKey } from '../config/index.js';
import { AnthropicProvider } from '@stable/provider-anthropic';
import { OpenAIProvider } from '@stable/provider-openai';
import { GeminiProvider } from '@stable/provider-gemini';
import { OpenRouterProvider } from '@stable/provider-openrouter';

export function createProvider(config: Config): LLMProvider {
  const apiKey = getEffectiveApiKey(config);
  if (!apiKey) {
    throw new LLMError(
      `No API key configured for provider "${config.llmProvider}". ` +
        'Set LLM_API_KEY or the provider-specific key ' +
        '(ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY).',
    );
  }

  switch (config.llmProvider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, config.llmBaseUrl);
    case 'openai':
      return new OpenAIProvider(apiKey, config.llmModel, config.llmBaseUrl);
    case 'gemini':
      return new GeminiProvider(apiKey, config.llmModel);
    case 'openrouter':
      return new OpenRouterProvider(apiKey, config.llmModel);
    default:
      throw new LLMError(`Unknown LLM provider: ${config.llmProvider}`);
  }
}
