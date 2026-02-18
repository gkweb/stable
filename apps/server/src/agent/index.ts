import { launchBrowser, navigateTo } from '../browser/index.js';
import { createProvider } from '../llm/factory.js';
import { getDatabase } from '../db/index.js';
import { runs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getConfig } from '../config/index.js';
import { explore } from './explorer.js';
import type { ExplorationResult } from './types.js';
import type { Logger } from '../shared/logger.js';

export async function runExploration(
  runId: string,
  targetUrl: string,
  logger: Logger,
): Promise<ExplorationResult> {
  const config = getConfig();
  const db = await getDatabase();
  const llm = createProvider(config);

  // Mark run as started
  await db.update(runs).set({ status: 'running', startedAt: new Date() }).where(eq(runs.id, runId));

  const browser = await launchBrowser(logger);

  try {
    // Navigate to target
    await navigateTo(browser.client, targetUrl, logger);

    // Run exploration
    const result = await explore(
      browser.client,
      llm,
      db,
      runId,
      targetUrl,
      {
        maxJourneys: config.maxJourneys,
        maxStepsPerJourney: config.maxStepsPerJourney,
        maxDurationMinutes: config.maxDurationMinutes,
      },
      logger,
    );

    // Mark run as completed
    await db
      .update(runs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        summary: {
          journeyCount: result.journeys.length,
          stepCount: result.totalSteps,
          durationMs: result.durationMs,
          summary: result.summary,
        },
      })
      .where(eq(runs.id, runId));

    return result;
  } catch (err) {
    // Mark run as failed
    await db
      .update(runs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        summary: { error: err instanceof Error ? err.message : String(err) },
      })
      .where(eq(runs.id, runId));

    throw err;
  } finally {
    await browser.close();
  }
}
