import type { ToolDefinition } from '../types.js';

export const markJourneyTool: ToolDefinition = {
  name: 'mark_journey',
  description:
    'Mark the current user journey as complete and optionally start a new one. ' +
    'Call this when you have finished exploring a distinct user flow (e.g. "Login flow", "Create project", "Search and filter").',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'A short name for the completed journey (e.g. "Login flow")',
      },
      description: {
        type: 'string',
        description: 'A brief description of what the journey covers',
      },
    },
    required: ['name'],
  },
};
