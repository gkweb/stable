import { z } from 'zod';

export const configSchema = z.object({
  // LLM
  llmProvider: z.enum(['anthropic', 'openai', 'gemini', 'openrouter']).default('anthropic'),
  llmModel: z.string().default('claude-sonnet-4-5-20250929'),
  llmBaseUrl: z.string().url().optional(),
  llmApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  geminiApiKey: z.string().optional(),
  openrouterApiKey: z.string().optional(),

  // Server
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  apiKey: z.string().optional(),

  // Storage
  dataDir: z.string().default('./data'),

  // Agent
  maxJourneys: z.coerce.number().int().min(1).default(10),
  maxStepsPerJourney: z.coerce.number().int().min(1).default(50),
  maxDurationMinutes: z.coerce.number().int().min(1).default(30),

  // Browser
  browserViewportWidth: z.coerce.number().int().min(320).default(1280),
  browserViewportHeight: z.coerce.number().int().min(240).default(720),
  chromiumPath: z.string().optional(),

  // Logging
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof configSchema>;
