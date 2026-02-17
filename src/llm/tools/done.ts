import type { ToolDefinition } from '../types.js';

export const doneTool: ToolDefinition = {
  name: 'done',
  description:
    'Signal that exploration is complete. Call this when you have thoroughly explored the application ' +
    'and identified the major user journeys, or when you have reached the maximum number of journeys.',
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'A brief summary of what was explored and any issues found',
      },
    },
    required: ['summary'],
  },
};
