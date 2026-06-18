import { describe, it, expect } from 'vitest';
import { getGanttDates, filterTreeByDate } from './gantt_base.ts';
import type { WorkItemNode, WorkItemMetadata } from './types.ts';

describe('gantt_base.ts > getGanttDates', () => {
    it('should return correct start and end date for week period', () => {
        const offset = 0;
        const { start, end } = getGanttDates('week', [], offset);
        
        // Duration of one week is 7 days
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(7);
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
        
        // Min date is 2026-06-01, Max date is 2026-06-10.
        // Difference is 9 days.
        // Range expands by 5% on each side.
        // 9 days * 0.05 = 0.45 days.
        // start should be before 2026-06-01, end should be after 2026-06-10.
        expect(start.getTime()).toBeLessThan(new Date('2026-06-01T00:00:00Z').getTime());
        expect(end.getTime()).toBeGreaterThan(new Date('2026-06-10T00:00:00Z').getTime());
    });
});

describe('gantt_base.ts > filterTreeByDate', () => {
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
});
