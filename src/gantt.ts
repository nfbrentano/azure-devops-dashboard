import type { WorkItemNode } from './types.ts';
import { renderBaseGantt } from './gantt_base.ts';

export type { GanttContext, GanttRenderOptions } from './gantt_base.ts';
export { getGanttDates, filterTreeByDate } from './gantt_base.ts';

/**
 * Hierarchical Gantt chart logic wrapper around the base renderer
 */
export function renderGantt(tree: WorkItemNode[], context: any) {
    renderBaseGantt(tree, context, { isTimeline: false });
}
