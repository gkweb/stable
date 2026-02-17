import type { ToolDefinition } from '../types.js';

export const selectTool: ToolDefinition = {
  name: 'select',
  description: 'Select a value from a dropdown/combobox element.',
  parameters: {
    type: 'object',
    properties: {
      ref: {
        type: 'string',
        description: 'The element ref ID of the select/combobox',
      },
      value: {
        type: 'string',
        description: 'The value to select',
      },
    },
    required: ['ref', 'value'],
  },
};
