import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../../db/index.js';
import { runs, journeys, steps } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { generateId } from '../../shared/id.js';
import { NotFoundError } from '../../shared/errors.js';
import { runExploration } from '../../agent/index.js';
import { createLogger } from '../../shared/logger.js';
import { getConfig } from '../../config/index.js';

const createRunSchema = z.object({
  targetUrl: z.string().url(),
  config: z
    .object({
      maxJourneys: z.number().int().min(1).optional(),
      maxStepsPerJourney: z.number().int().min(1).optional(),
      maxDurationMinutes: z.number().int().min(1).optional(),
    })
    .optional(),
});

export async function runRoutes(app: FastifyInstance) {
  // POST /api/v1/runs - Create and start an exploration run
  app.post('/api/v1/runs', async (request, reply) => {
    const body = createRunSchema.parse(request.body);
    const db = await getDatabase();
    const config = getConfig();
    const logger = createLogger(config.logLevel);

    const id = generateId('run');

    await db.insert(runs).values({
      id,
      targetUrl: body.targetUrl,
      status: 'pending',
      mode: 'explore',
      triggerType: 'manual',
      config: body.config ?? null,
    });

    // Start exploration in background (don't await)
    runExploration(id, body.targetUrl, logger).catch((err) => {
      logger.error({ runId: id, error: err }, 'Exploration failed');
    });

    return reply.status(202).send({
      id,
      targetUrl: body.targetUrl,
      status: 'pending',
    });
  });

  // GET /api/v1/runs - List runs
  app.get('/api/v1/runs', async () => {
    const db = await getDatabase();
    const result = await db.select().from(runs).orderBy(desc(runs.createdAt)).limit(50);
    return { runs: result };
  });

  // GET /api/v1/runs/:id - Get run details with journeys and steps
  app.get<{ Params: { id: string } }>('/api/v1/runs/:id', async (request) => {
    const db = await getDatabase();
    const { id } = request.params;

    const run = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    if (run.length === 0) {
      throw new NotFoundError('Run', id);
    }

    const runJourneys = await db.select().from(journeys).where(eq(journeys.runId, id));

    const journeyIds = runJourneys.map((j) => j.id);
    const allSteps =
      journeyIds.length > 0
        ? await db.select().from(steps).where(
            // Get steps for all journeys in this run
            // Using a simple approach: query per journey
            eq(steps.journeyId, journeyIds[0]!),
          )
        : [];

    // For multiple journeys, gather all steps
    const stepsByJourney = new Map<string, typeof allSteps>();
    for (const journeyId of journeyIds) {
      const journeySteps = await db
        .select()
        .from(steps)
        .where(eq(steps.journeyId, journeyId))
        .orderBy(steps.sequence);
      stepsByJourney.set(journeyId, journeySteps);
    }

    return {
      ...run[0],
      journeys: runJourneys.map((j) => ({
        ...j,
        steps: stepsByJourney.get(j.id) ?? [],
      })),
    };
  });
}
