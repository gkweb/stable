import { configSchema, type Config } from './schema.js';

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;

  const raw = {
    llmProvider: process.env['LLM_PROVIDER'],
    llmModel: process.env['LLM_MODEL'],
    llmBaseUrl: process.env['LLM_BASE_URL'] || undefined,
    llmApiKey: process.env['LLM_API_KEY'] || undefined,
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'] || undefined,
    openaiApiKey: process.env['OPENAI_API_KEY'] || undefined,
    geminiApiKey: process.env['GEMINI_API_KEY'] || undefined,
    port: process.env['PORT'],
    host: process.env['HOST'],
    apiKey: process.env['API_KEY'] || undefined,
    dataDir: process.env['DATA_DIR'],
    maxJourneys: process.env['MAX_JOURNEYS'],
    maxStepsPerJourney: process.env['MAX_STEPS_PER_JOURNEY'],
    maxDurationMinutes: process.env['MAX_DURATION_MINUTES'],
    browserViewportWidth: process.env['BROWSER_VIEWPORT_WIDTH'],
    browserViewportHeight: process.env['BROWSER_VIEWPORT_HEIGHT'],
    chromiumPath: process.env['CHROMIUM_PATH'] || undefined,
    logLevel: process.env['LOG_LEVEL'],
  };

  _config = configSchema.parse(raw);
  return _config;
}

export function getConfig(): Config {
  if (!_config) return loadConfig();
  return _config;
}

export function getEffectiveApiKey(config: Config): string | undefined {
  if (config.llmApiKey) return config.llmApiKey;
  if (config.llmProvider === 'anthropic') return config.anthropicApiKey;
  if (config.llmProvider === 'openai') return config.openaiApiKey;
  if (config.llmProvider === 'gemini') return config.geminiApiKey;
  return undefined;
}

export type { Config };
