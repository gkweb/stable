import type CDP from 'chrome-remote-interface';
import type { PageSnapshot } from '../browser/snapshot.js';
import type { ToolCall } from '@stable/core';
import { clickElement, fillElement, selectElement, scrollPage } from '../browser/actions.js';
import { navigateTo, waitForNetworkIdle } from '../browser/index.js';
import { BrowserError } from '../shared/errors.js';
import type { Logger } from '../shared/logger.js';
import type { ActionType } from './types.js';

export interface ActionResult {
  type: ActionType;
  params: Record<string, unknown>;
  success: boolean;
  error?: string;
}

export async function executeAction(
  client: CDP.Client,
  toolCall: ToolCall,
  snapshot: PageSnapshot,
  logger: Logger,
): Promise<ActionResult> {
  const { name, input } = toolCall;
  const type = name as ActionType;
  const params = input;

  try {
    switch (name) {
      case 'click': {
        const ref = String(input['ref']);
        const element = snapshot.refs.get(ref);
        if (!element) throw new BrowserError(`Unknown ref: ${ref}`);
        logger.debug({ ref, element: element.name }, 'Clicking element');
        await clickElement(client, element);
        break;
      }

      case 'fill': {
        const ref = String(input['ref']);
        const text = String(input['text']);
        const element = snapshot.refs.get(ref);
        if (!element) throw new BrowserError(`Unknown ref: ${ref}`);
        logger.debug({ ref, text: text.slice(0, 50) }, 'Filling element');
        await fillElement(client, element, text);
        break;
      }

      case 'select': {
        const ref = String(input['ref']);
        const value = String(input['value']);
        const element = snapshot.refs.get(ref);
        if (!element) throw new BrowserError(`Unknown ref: ${ref}`);
        logger.debug({ ref, value }, 'Selecting value');
        await selectElement(client, element, value);
        break;
      }

      case 'scroll': {
        const direction = String(input['direction']) as 'up' | 'down' | 'left' | 'right';
        const amount = input['amount'] ? Number(input['amount']) : undefined;
        logger.debug({ direction, amount }, 'Scrolling');
        await scrollPage(client, direction, amount);
        break;
      }

      case 'navigate': {
        const url = String(input['url']);
        logger.debug({ url }, 'Navigating');
        await navigateTo(client, url, logger);
        break;
      }

      case 'wait': {
        const duration = Math.min(Number(input['duration'] ?? 1000), 5000);
        logger.debug({ duration }, 'Waiting');
        await new Promise((resolve) => setTimeout(resolve, duration));
        await waitForNetworkIdle(client, 2000);
        break;
      }

      case 'mark_journey':
      case 'done':
        // These are handled by the explorer, not the action executor
        break;

      default:
        throw new BrowserError(`Unknown action: ${name}`);
    }

    return { type, params, success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn({ action: name, error }, 'Action failed');
    return { type, params, success: false, error };
  }
}
