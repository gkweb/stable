import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const runs = pgTable('runs', {
  id: text('id').primaryKey(),
  targetUrl: text('target_url').notNull(),
  status: text('status').notNull().default('pending'),
  mode: text('mode').notNull().default('explore'),
  baselineId: text('baseline_id'),
  triggerType: text('trigger_type').notNull().default('manual'),
  config: jsonb('config').$type<Record<string, unknown>>(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  summary: jsonb('summary').$type<Record<string, unknown>>(),
});

export const journeys = pgTable('journeys', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => runs.id),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('in_progress'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const steps = pgTable('steps', {
  id: text('id').primaryKey(),
  journeyId: text('journey_id')
    .notNull()
    .references(() => journeys.id),
  sequence: integer('sequence').notNull(),
  actionType: text('action_type').notNull(),
  actionParams: jsonb('action_params').notNull().$type<Record<string, unknown>>(),
  snapshotBefore: text('snapshot_before'),
  pageUrl: text('page_url').notNull(),
  pageTitle: text('page_title'),
  screenshotPath: text('screenshot_path'),
  consoleLog: jsonb('console_log').$type<Record<string, unknown>[]>(),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
