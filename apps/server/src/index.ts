import 'dotenv/config';
import { serve } from '@hono/node-server';
import { loadConfig } from './config/index.js';
import { createLogger } from './shared/logger.js';
import { createServer } from './server/index.js';
import { getDatabase, closeDatabase } from './db/index.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info({ provider: config.llmProvider, model: config.llmModel }, 'Starting Stable');

  // Initialize database
  await getDatabase();
  logger.info('Database initialized (PGlite)');

  // Start HTTP server
  const app = createServer(logger);
  const server = serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  });

  logger.info({ port: config.port, host: config.host }, 'Server listening');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    server.close();
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error:', err);
  process.exit(1);
});
