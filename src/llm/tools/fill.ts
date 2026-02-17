import type { ToolDefinition } from '../types.js';

export const fillTool: ToolDefinition = {
  name: 'fill',
  description:
    'Fill a text input, textarea, or searchbox with text. Clears existing content first.',
  parameters: {
    type: 'object',
    properties: {
      ref: {
        type: 'string',
        description: 'The element ref ID (e.g. "@e3")',
      },
      text: {
        type: 'string',
        description: 'The text to type into the field',
      },
    },
    required: ['ref', 'text'],
  },
};
