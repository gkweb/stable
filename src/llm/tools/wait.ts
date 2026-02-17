import type { ToolDefinition } from '../types.js';

export const waitTool: ToolDefinition = {
  name: 'wait',
  description:
    'Wait for the page to settle after an action. Use this when you expect the page to update (e.g. after a form submission or navigation).',
  parameters: {
    type: 'object',
    properties: {
      duration: {
        type: 'number',
        description: 'Milliseconds to wait (default 1000, max 5000)',
      },
    },
  },
};
