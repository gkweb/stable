import type { FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../../config/index.js';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const config = getConfig();

  // If no API key configured, allow all requests
  if (!config.apiKey) return;

  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return reply.status(401).send({ error: 'Missing Authorization header' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token !== config.apiKey) {
    return reply.status(403).send({ error: 'Invalid API key' });
  }
}
