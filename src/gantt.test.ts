import { describe, it, expect, beforeEach } from 'vitest';
import { getGanttDates, filterTreeByDate, filterTreeForTimeline, isValidDate, renderBaseGantt } from './gantt_base.ts';
import type { WorkItemNode, WorkItemMetadata, GanttContext } from './types.ts';

describe('gantt_base.ts > isValidDate', () => {
    it('should correctly identify valid dates', () => {
        expect(isValidDate(new Date())).toBe(true);
        expect(isValidDate(new Date('2026-06-01'))).toBe(true);
        expect(isValidDate(new Date('invalid'))).toBe(false);
        expect(isValidDate('2026-06-01')).toBe(false);
        expect(isValidDate(null)).toBe(false);
        expect(isValidDate(undefined)).toBe(false);
        expect(isValidDate(123456789)).toBe(false);
    });
});

describe('gantt_base.ts > getGanttDates', () => {
    it('should return correct start and end date for week period', () => {
        const offset = 0;
        const { start, end } = getGanttDates('week', [], offset);

        // Duration of one week is 7 days
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(7);
    });

    it('should calculate dates for month, bimester, trimester, and year periods', () => {
        const month = getGanttDates('month', [], 0);
        expect(month.start.getDate()).toBe(1);
        expect(month.end.getDate()).toBe(1);

        const bimester = getGanttDates('bimester', [], 0);
        expect(bimester.start.getDate()).toBe(1);

        const trimester = getGanttDates('trimester', [], 0);
        expect(trimester.start.getDate()).toBe(1);

        const year = getGanttDates('year', [], 0);
        expect(year.start.getMonth()).toBe(0);
        expect(year.start.getDate()).toBe(1);
        expect(year.end.getMonth()).toBe(0);
        expect(year.end.getDate()).toBe(1);
    });

    it('should calculate custom dates based on items when period is total', () => {
        const items: WorkItemNode[] = [
            {
                id: 1,
                fields: {
                    'System.Id': 1,
                    'System.Title': 'Task 1',
                    'System.State': 'Active',
                    'System.WorkItemType': 'Task',
                    'Microsoft.VSTS.Scheduling.StartDate': '2026-06-01T00:00:00Z',
                    'Microsoft.VSTS.Scheduling.TargetDate': '2026-06-10T00:00:00Z'
                },
                children: []
            }
        ];

        const { start, end } = getGanttDates('total', items, 0);

        expect(start.getTime()).toBeLessThan(new Date('2026-06-01T00:00:00Z').getTime());
        expect(end.getTime()).toBeGreaterThan(new Date('2026-06-10T00:00:00Z').getTime());
    });

    it('should handle period total with single date items', () => {
        const items: WorkItemNode[] = [
            {
                id: 1,
                fields: {
                    'System.Id': 1,
                    'System.CreatedDate': '2026-06-05T00:00:00Z'
                },
                children: []
            }
        ];

        const { start, end } = getGanttDates('total', items, 0);
        expect(isValidDate(start)).toBe(true);
        expect(isValidDate(end)).toBe(true);
        expect(end.getTime()).toBeGreaterThan(start.getTime());
    });
});

describe('gantt_base.ts > filterTreeByDate and filterTreeForTimeline', () => {
    const mockMetadata = {
        states: {
            active: { category: 'InProgress', color: '#0078d4' },
            new: { category: 'Proposed', color: '#b2b2b2' }
        }
    } as unknown as WorkItemMetadata;

    it('should filter items that overlap with the start and end dates', () => {
        const tree: WorkItemNode[] = [
            {
                id: 1,
                fields: {
                    'System.Id': 1,
                    'System.Title': 'Within Date Range',
                    'System.State': 'Active',
                    'System.WorkItemType': 'Task',
                    'Microsoft.VSTS.Scheduling.StartDate': '2026-06-05T00:00:00Z',
                    'Microsoft.VSTS.Scheduling.TargetDate': '2026-06-07T00:00:00Z'
                },
                children: []
            },
            {
                id: 2,
                fields: {
                    'System.Id': 2,
                    'System.Title': 'Outside Date Range',
                    'System.State': 'Active',
                    'System.WorkItemType': 'Task',
                    'Microsoft.VSTS.Scheduling.StartDate': '2026-05-01T00:00:00Z',
                    'Microsoft.VSTS.Scheduling.TargetDate': '2026-05-10T00:00:00Z'
                },
                children: []
            }
        ];

        const start = new Date('2026-06-01T00:00:00Z');
        const end = new Date('2026-06-15T00:00:00Z');

        const result = filterTreeByDate(tree, start, end, null, null, mockMetadata);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
    });

    it('should filter by activeStates and activeItemTypes', () => {
        const tree: WorkItemNode[] = [
            {
                id: 1,
                fields: {
                    'System.Id': 1,
                    'System.State': 'Active',
                    'System.WorkItemType': 'Bug',
                    'System.CreatedDate': '2026-06-05T00:00:00Z'
                },
                children: []
            },
            {
                id: 2,
                fields: {
                    'System.Id': 2,
                    'System.State': 'Closed',
                    'System.WorkItemType': 'Task',
                    'System.CreatedDate': '2026-06-05T00:00:00Z'
                },
                children: []
            }
        ];

        const start = new Date('2026-06-01T00:00:00Z');
        const end = new Date('2026-06-15T00:00:00Z');

        const result = filterTreeByDate(tree, start, end, null, ['Bug'], mockMetadata, ['Active']);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
    });

    it('should filter tree for timeline by active types and states', () => {
        const tree: WorkItemNode[] = [
            {
                id: 1,
                fields: { 'System.WorkItemType': 'Epic', 'System.State': 'Active' },
                children: [
                    {
                        id: 2,
                        fields: { 'System.WorkItemType': 'Feature', 'System.State': 'Active' },
                        children: []
                    }
                ]
            },
            {
                id: 3,
                fields: { 'System.WorkItemType': 'Task', 'System.State': 'Closed' },
                children: []
            }
        ];

        const result = filterTreeForTimeline(tree, ['Epic', 'Feature'], ['Active']);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
        expect(result[0].children).toHaveLength(1);
        expect(result[0].children[0].id).toBe(2);
    });
});

describe('gantt_base.ts > renderBaseGantt', () => {
    const mockMetadata = {
        types: { task: { name: 'Task', color: '#0078d4' } },
        states: { active: { name: 'Active', category: 'InProgress', color: '#0078d4' } },
        backlogs: []
    } as unknown as WorkItemMetadata;

    const translations = {
        en: {
            'msg-gantt-empty': 'No items to display in this period',
            'label-load-more': 'Load More'
        }
    };

    let container: HTMLElement;
    let labelEl: HTMLElement;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="gantt-current-period-label"></div>
            <div id="gantt-container"></div>
        `;
        container = document.getElementById('gantt-container')!;
        labelEl = document.getElementById('gantt-current-period-label')!;
    });

    it('should render empty state message when no items match', () => {
        const context: GanttContext = {
            ganttPeriod: { value: 'week' } as HTMLSelectElement,
            currentData: { items: [], tree: [] },
            ganttOffset: 0,
            currentLanguage: 'en',
            translations,
            workItemMetadata: mockMetadata,
            ganttContainer: container,
            azureConfig: null
        };

        renderBaseGantt([], context, { isTimeline: false });

        expect(labelEl.textContent).not.toBe('');
        expect(container.innerHTML).toContain('No items to display');
    });

    it('should render gantt timeline header and items when tree has matching items', () => {
        const item: WorkItemNode = {
            id: 10,
            fields: {
                'System.Id': 10,
                'System.Title': 'Gantt Item 10',
                'System.WorkItemType': 'Task',
                'System.State': 'Active',
                'Microsoft.VSTS.Scheduling.StartDate': new Date().toISOString(),
                'Microsoft.VSTS.Scheduling.TargetDate': new Date(Date.now() + 86400000).toISOString()
            },
            children: []
        };

        const context: GanttContext = {
            ganttPeriod: { value: 'week' } as HTMLSelectElement,
            currentData: { items: [item], tree: [item] },
            ganttOffset: 0,
            currentLanguage: 'en',
            translations,
            workItemMetadata: mockMetadata,
            ganttContainer: container,
            azureConfig: null
        };

        renderBaseGantt([item], context, { isTimeline: true, activeTypes: [], activeStates: [] });

        expect(container.querySelector('.gantt-header')).not.toBeNull();
        expect(container.querySelector('.timeline-milestone')).not.toBeNull();
    });
});
