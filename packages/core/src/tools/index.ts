import type { ToolDefinition } from '../types.js';
import { clickTool } from './click.js';
import { fillTool } from './fill.js';
import { selectTool } from './select.js';
import { scrollTool } from './scroll.js';
import { navigateTool } from './navigate.js';
import { waitTool } from './wait.js';
import { markJourneyTool } from './mark-journey.js';
import { doneTool } from './done.js';

export const explorationTools: ToolDefinition[] = [
  clickTool,
  fillTool,
  selectTool,
  scrollTool,
  navigateTool,
  waitTool,
  markJourneyTool,
  doneTool,
];

export {
  clickTool,
  fillTool,
  selectTool,
  scrollTool,
  navigateTool,
  waitTool,
  markJourneyTool,
  doneTool,
};
