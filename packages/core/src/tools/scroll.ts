import type { ToolDefinition } from '../types.js';

export const scrollTool: ToolDefinition = {
  name: 'scroll',
  description: 'Scroll the page in a given direction to reveal more content.',
  parameters: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        enum: ['up', 'down', 'left', 'right'],
        description: 'Direction to scroll',
      },
      amount: {
        type: 'number',
        description: 'Pixels to scroll (default 400)',
      },
    },
    required: ['direction'],
  },
};
