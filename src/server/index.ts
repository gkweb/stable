import { Hono } from 'hono';
import { healthRoutes } from './routes/health.js';
import { runRoutes } from './routes/runs.js';
import { authMiddleware } from './middleware/auth.js';
import { StableError } from '../shared/errors.js';
import type { Logger } from '../shared/logger.js';

export function createServer(logger: Logger) {
  const app = new Hono();

  // Global error handler
  app.onError((error, c) => {
    if (error instanceof StableError) {
      return c.json({ error: error.code, message: error.message }, error.statusCode as 400);
    }

    // Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: (error as unknown as { issues: unknown }).issues,
        },
        400,
      );
    }

    logger.error({ error }, 'Unhandled error');
    return c.json({ error: 'INTERNAL_ERROR', message: 'An internal error occurred' }, 500);
  });

  // Auth middleware for API routes
  app.use('/api/*', authMiddleware);

  // Register routes
  app.route('/', healthRoutes);
  app.route('/', runRoutes);

  return app;
}
