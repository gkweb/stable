export type ActionType =
  | 'click'
  | 'fill'
  | 'select'
  | 'scroll'
  | 'navigate'
  | 'wait'
  | 'mark_journey'
  | 'done';

export interface AgentAction {
  type: ActionType;
  params: Record<string, unknown>;
  timestamp: number;
}

export interface StepRecord {
  actionType: ActionType;
  actionParams: Record<string, unknown>;
  snapshotBefore: string;
  pageUrl: string;
  pageTitle: string;
  screenshotPath?: string;
  consoleLog?: Record<string, unknown>[];
  durationMs: number;
}

export interface JourneyRecord {
  name: string;
  description?: string;
  steps: StepRecord[];
}

export interface ExplorationResult {
  journeys: JourneyRecord[];
  totalSteps: number;
  durationMs: number;
  summary: string;
}
