import { Hono } from 'hono';
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

export const runRoutes = new Hono()
  // POST /api/v1/runs - Create and start an exploration run
  .post('/api/v1/runs', async (c) => {
    const body = createRunSchema.parse(await c.req.json());
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
      logger.error({ runId: id, error: { code: err?.code, message: err?.message ?? String(err) } }, 'Exploration failed');
    });

    return c.json(
      {
        id,
        targetUrl: body.targetUrl,
        status: 'pending',
      },
      202,
    );
  })

  // GET /api/v1/runs - List runs
  .get('/api/v1/runs', async (c) => {
    const db = await getDatabase();
    const result = await db.select().from(runs).orderBy(desc(runs.createdAt)).limit(50);
    return c.json({ runs: result });
  })

  // GET /api/v1/runs/:id - Get run details with journeys and steps
  .get('/api/v1/runs/:id', async (c) => {
    const db = await getDatabase();
    const id = c.req.param('id');

    const run = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    if (run.length === 0) {
      throw new NotFoundError('Run', id);
    }

    const runJourneys = await db.select().from(journeys).where(eq(journeys.runId, id));

    const journeyIds = runJourneys.map((j) => j.id);

    // For multiple journeys, gather all steps
    type StepRow = typeof steps.$inferSelect;
    const stepsByJourney = new Map<string, StepRow[]>();
    for (const journeyId of journeyIds) {
      const journeySteps = await db
        .select()
        .from(steps)
        .where(eq(steps.journeyId, journeyId))
        .orderBy(steps.sequence);
      stepsByJourney.set(journeyId, journeySteps);
    }

    return c.json({
      ...run[0],
      journeys: runJourneys.map((j) => ({
        ...j,
        steps: stepsByJourney.get(j.id) ?? [],
      })),
    });
  });
