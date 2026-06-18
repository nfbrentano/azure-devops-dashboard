import type { WorkItemNode } from './types.ts';
import { renderBaseGantt } from './gantt_base.ts';
import type { GanttContext } from './gantt_base.ts';

export { filterTreeForTimeline } from './gantt_base.ts';

/**
 * Timeline specific rendering logic wrapper around the base renderer
 */
export function renderTimeline(tree: WorkItemNode[], context: GanttContext) {
    renderBaseGantt(tree, context, {
        isTimeline: true,
        periodLabelId: context.periodLabelId || 'timeline-gantt-period-label',
        activeTypes: context.activeTypes || [],
        activeStates: context.activeStates || []
    });
}
