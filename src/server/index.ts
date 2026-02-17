import Fastify from 'fastify';
import { healthRoutes } from './routes/health.js';
import { runRoutes } from './routes/runs.js';
import { authMiddleware } from './middleware/auth.js';
import { StableError } from '../shared/errors.js';
import type { Logger } from '../shared/logger.js';

export async function createServer(logger: Logger) {
  const app = Fastify({
    logger: false, // We use our own pino logger
  });

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof StableError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    // Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: (error as unknown as { issues: unknown }).issues,
      });
    }

    logger.error({ error }, 'Unhandled error');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
  });

  // Auth middleware for API routes
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      await authMiddleware(request, reply);
    }
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(runRoutes);

  return app;
}
