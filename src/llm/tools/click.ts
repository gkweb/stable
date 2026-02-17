import type { ToolDefinition } from '../types.js';

export const clickTool: ToolDefinition = {
  name: 'click',
  description:
    'Click on an interactive element by its ref ID. Use this to click buttons, links, checkboxes, radio buttons, tabs, etc.',
  parameters: {
    type: 'object',
    properties: {
      ref: {
        type: 'string',
        description: 'The element ref ID (e.g. "@e1", "@e5")',
      },
    },
    required: ['ref'],
  },
};
