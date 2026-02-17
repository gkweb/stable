import type { MiddlewareHandler } from 'hono';
import { getConfig } from '../../config/index.js';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const config = getConfig();

  // If no API key configured, allow all requests
  if (!config.apiKey) return next();

  const authHeader = c.req.header('authorization');
  if (!authHeader) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token !== config.apiKey) {
    return c.json({ error: 'Invalid API key' }, 403);
  }

  return next();
};
