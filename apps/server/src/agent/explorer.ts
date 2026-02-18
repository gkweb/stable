import type CDP from 'chrome-remote-interface';
import type { LLMProvider, ChatMessage } from '@stable/core';
import { explorationTools } from '@stable/core';
import { explorationSystemPrompt } from '@stable/core';
import { takeSnapshot, type PageSnapshot } from '../browser/snapshot.js';
import { captureScreenshot } from '../browser/screenshot.js';
import { executeAction } from './action-executor.js';
import { ExplorationMemory } from './memory.js';
import { JourneyRecorder } from './journey-recorder.js';
import type { Database } from '../db/index.js';
import type { Logger } from '../shared/logger.js';
import type { ExplorationResult } from './types.js';
import { join } from 'node:path';
import { getConfig } from '../config/index.js';

export interface ExplorerOptions {
  maxJourneys: number;
  maxStepsPerJourney: number;
  maxDurationMinutes: number;
}

export async function explore(
  client: CDP.Client,
  llm: LLMProvider,
  db: Database,
  runId: string,
  targetUrl: string,
  options: ExplorerOptions,
  logger: Logger,
): Promise<ExplorationResult> {
  const config = getConfig();
  const memory = new ExplorationMemory();
  const recorder = new JourneyRecorder(db, runId);
  const messages: ChatMessage[] = [];
  const startTime = Date.now();
  let totalSteps = 0;
  let journeyCount = 0;
  let summaryText = '';

  const maxDurationMs = options.maxDurationMinutes * 60 * 1000;

  // Take initial snapshot
  let snapshot: PageSnapshot = await takeSnapshot(client);
  memory.recordVisit(snapshot.url, snapshot.text);

  // Start first journey
  await recorder.startJourney('Initial exploration', `Exploring ${targetUrl}`);
  journeyCount = 1;

  // Send initial context to LLM
  messages.push({
    role: 'user',
    content: `I've navigated to ${targetUrl}. Here is the current page snapshot:\n\n${snapshot.text}\n\nPage URL: ${snapshot.url}\nPage Title: ${snapshot.title}\n\nExplore this application and discover user journeys.`,
  });

  // Main exploration loop
  while (
    totalSteps < options.maxJourneys * options.maxStepsPerJourney &&
    journeyCount <= options.maxJourneys &&
    Date.now() - startTime < maxDurationMs
  ) {
    // Get LLM decision
    const response = await llm.chat({
      systemPrompt: explorationSystemPrompt,
      messages,
      tools: explorationTools,
      temperature: 0.3,
      maxTokens: 1024,
    });

    logger.debug(
      {
        toolCalls: response.toolCalls.length,
        stopReason: response.stopReason,
        tokens: response.usage,
      },
      'LLM response',
    );

    // If LLM responded with text only (no tool calls), prompt it to take action
    if (response.toolCalls.length === 0) {
      if (response.content) {
        messages.push({ role: 'assistant', content: response.content });
      }
      messages.push({
        role: 'user',
        content: 'Please take an action using one of the available tools.',
      });
      continue;
    }

    // Process each tool call
    for (const toolCall of response.toolCalls) {
      const stepStart = Date.now();

      // Handle journey lifecycle tools
      if (toolCall.name === 'mark_journey') {
        const name = String(toolCall.input['name']);
        const description = toolCall.input['description']
          ? String(toolCall.input['description'])
          : undefined;

        await recorder.completeJourney();
        journeyCount++;

        if (journeyCount <= options.maxJourneys) {
          await recorder.startJourney(name, description);
          logger.info({ journey: name, count: journeyCount }, 'New journey started');
        }

        messages.push({
          role: 'assistant',
          content: [
            { type: 'tool_use', id: toolCall.id, name: toolCall.name, input: toolCall.input },
          ],
        });
        messages.push({
          role: 'tool',
          content: `Journey "${name}" recorded. Journey ${journeyCount} of ${options.maxJourneys}.`,
          toolCallId: toolCall.id,
        });
        continue;
      }

      if (toolCall.name === 'done') {
        summaryText = String(toolCall.input['summary'] ?? '');
        await recorder.completeJourney();
        logger.info({ summary: summaryText }, 'Exploration complete');
        return buildResult(journeyCount, totalSteps, startTime, summaryText);
      }

      // Execute browser action
      const result = await executeAction(client, toolCall, snapshot, logger);
      totalSteps++;

      // Record step
      const artifactsDir = join(config.dataDir, 'artifacts', runId);
      const screenshotPath = join(artifactsDir, `step-${totalSteps}.png`);
      await captureScreenshot(client, screenshotPath);

      await recorder.recordStep({
        actionType: result.type,
        actionParams: result.params,
        snapshotBefore: snapshot.text,
        pageUrl: snapshot.url,
        pageTitle: snapshot.title,
        screenshotPath,
        durationMs: Date.now() - stepStart,
      });

      memory.recordAction(snapshot.url, toolCall.name, String(toolCall.input['ref'] ?? ''));

      // Re-snapshot after action
      snapshot = await takeSnapshot(client);
      memory.recordVisit(snapshot.url, snapshot.text);

      // Build tool result message
      const toolResultContent = result.success
        ? `Action "${toolCall.name}" completed. Here is the updated page snapshot:\n\n${snapshot.text}\n\nPage URL: ${snapshot.url}\nPage Title: ${snapshot.title}`
        : `Action "${toolCall.name}" failed: ${result.error}\n\nCurrent page snapshot:\n\n${snapshot.text}`;

      messages.push({
        role: 'assistant',
        content: [
          { type: 'tool_use', id: toolCall.id, name: toolCall.name, input: toolCall.input },
        ],
      });
      messages.push({ role: 'tool', content: toolResultContent, toolCallId: toolCall.id });

      // Check if stuck
      if (memory.isStuck()) {
        messages.push({
          role: 'user',
          content:
            'You seem to be seeing the same page state repeatedly. Try navigating to a different section of the app, or call mark_journey if this flow is complete.',
        });
      }
    }
  }

  // Hit limits
  await recorder.completeJourney();
  summaryText = 'Exploration ended (reached time or step limit)';
  logger.info({ totalSteps, journeyCount }, summaryText);

  return buildResult(journeyCount, totalSteps, startTime, summaryText);
}

function buildResult(
  _journeyCount: number,
  totalSteps: number,
  startTime: number,
  summary: string,
): ExplorationResult {
  return {
    journeys: [], // Journeys are stored in DB
    totalSteps,
    durationMs: Date.now() - startTime,
    summary,
  };
}
