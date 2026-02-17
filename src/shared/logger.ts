import pino from 'pino';

export function createLogger(level = 'info') {
  return pino({
    level,
    transport:
      process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
}

export type Logger = pino.Logger;
