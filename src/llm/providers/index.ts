import type { LLMProvider } from '../types.js';
import type { Config } from '../../config/index.js';
import { getEffectiveApiKey } from '../../config/index.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { LLMError } from '../../shared/errors.js';

export function createProvider(config: Config): LLMProvider {
  const apiKey = getEffectiveApiKey(config);
  if (!apiKey) {
    throw new LLMError(
      `No API key configured for provider "${config.llmProvider}". ` +
        'Set LLM_API_KEY or the provider-specific key (ANTHROPIC_API_KEY / OPENAI_API_KEY).',
    );
  }

  switch (config.llmProvider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, config.llmBaseUrl);
    case 'openai':
      return new OpenAIProvider(apiKey, config.llmModel, config.llmBaseUrl);
    default:
      throw new LLMError(`Unknown LLM provider: ${config.llmProvider}`);
  }
}
