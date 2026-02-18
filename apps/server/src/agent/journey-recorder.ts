import type { Database } from '../db/index.js';
import { journeys, steps } from '../db/schema.js';
import { generateId } from '../shared/id.js';
import type { StepRecord } from './types.js';

export class JourneyRecorder {
  private currentJourneyId: string | null = null;
  private stepSequence = 0;

  constructor(
    private db: Database,
    private runId: string,
  ) {}

  async startJourney(name: string, description?: string): Promise<string> {
    // Complete any existing journey
    if (this.currentJourneyId) {
      await this.completeJourney();
    }

    const id = generateId('journey');
    this.currentJourneyId = id;
    this.stepSequence = 0;

    await this.db.insert(journeys).values({
      id,
      runId: this.runId,
      name,
      description: description ?? null,
      status: 'in_progress',
    });

    return id;
  }

  async recordStep(step: StepRecord): Promise<void> {
    if (!this.currentJourneyId) {
      await this.startJourney('Initial exploration');
    }

    this.stepSequence++;

    await this.db.insert(steps).values({
      id: generateId('step'),
      journeyId: this.currentJourneyId!,
      sequence: this.stepSequence,
      actionType: step.actionType,
      actionParams: step.actionParams,
      snapshotBefore: step.snapshotBefore,
      pageUrl: step.pageUrl,
      pageTitle: step.pageTitle,
      screenshotPath: step.screenshotPath ?? null,
      consoleLog: step.consoleLog ?? null,
      durationMs: step.durationMs,
    });
  }

  async completeJourney(): Promise<void> {
    if (!this.currentJourneyId) return;

    await this.db
      .update(journeys)
      .set({ status: 'completed' })
      .where(
        // Use eq from drizzle-orm
        (await import('drizzle-orm')).eq(journeys.id, this.currentJourneyId),
      );

    this.currentJourneyId = null;
    this.stepSequence = 0;
  }

  getCurrentJourneyId(): string | null {
    return this.currentJourneyId;
  }
}
