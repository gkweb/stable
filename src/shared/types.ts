export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RunMode = 'explore' | 'regression';
export type TriggerType = 'manual' | 'webhook' | 'schedule';
export type JourneyStatus = 'in_progress' | 'completed' | 'failed';

export interface RunConfig {
  maxJourneys?: number;
  maxStepsPerJourney?: number;
  maxDurationMinutes?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface RunSummary {
  journeyCount: number;
  stepCount: number;
  errorsFound: number;
  durationMs: number;
}
