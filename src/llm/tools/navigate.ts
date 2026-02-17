import type { ToolDefinition } from '../types.js';

export const navigateTool: ToolDefinition = {
  name: 'navigate',
  description:
    'Navigate directly to a URL. Use this to go to a specific page, or to enter a URL that was discovered in the page content.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to navigate to (absolute or relative)',
      },
    },
    required: ['url'],
  },
};
