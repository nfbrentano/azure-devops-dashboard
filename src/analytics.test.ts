import { describe, it, expect } from 'vitest';
import { calculateBottlenecks, computeMetrics } from './analytics.ts';
import type { WorkItemNode, WorkItemMetadata } from './types.ts';

describe('analytics.ts > calculateBottlenecks', () => {
    const mockMetadata = {
        states: {
            done: { category: 'Completed', color: '#10b981' },
            closed: { category: 'Completed', color: '#10b981' },
            resolved: { category: 'InProgress', color: '#0078d4' },
            active: { category: 'InProgress', color: '#0078d4' },
            new: { category: 'Proposed', color: '#b2b2b2' }
        }
    } as unknown as WorkItemMetadata;

    it('should return empty list if no items or revisions are passed', () => {
        const result = calculateBottlenecks([], {}, mockMetadata);
        expect(result).toEqual([]);
    });

    it('should compute average column times correctly based on revisions', () => {
        // Create dates
        const baseTime = new Date('2026-06-01T00:00:00Z');
        const day2 = new Date('2026-06-02T00:00:00Z');
        const day4 = new Date('2026-06-04T00:00:00Z');

        const items: WorkItemNode[] = [
            {
                id: 1,
                fields: {
                    'System.Id': 1,
                    'System.Title': 'Task 1',
                    'System.State': 'Closed',
                    'System.WorkItemType': 'Task'
                },
                children: []
            }
        ];

        const revisionsData = {
            1: [
                {
                    id: 1,
                    fields: {
                        'System.Id': 1,
                        'System.Title': 'Task 1',
                        'System.BoardColumn': 'To Do',
                        'System.State': 'New',
                        'System.WorkItemType': 'Task',
                        'System.ChangedDate': baseTime.toISOString()
                    }
                },
                {
                    id: 1,
                    fields: {
                        'System.Id': 1,
                        'System.Title': 'Task 1',
                        'System.BoardColumn': 'In Progress',
                        'System.State': 'Active',
                        'System.WorkItemType': 'Task',
                        'System.ChangedDate': day2.toISOString()
                    }
                },
                {
                    id: 1,
                    fields: {
                        'System.Id': 1,
                        'System.Title': 'Task 1',
                        'System.BoardColumn': 'Done',
                        'System.State': 'Closed',
                        'System.WorkItemType': 'Task',
                        'System.ChangedDate': day4.toISOString()
                    }
                }
            ]
        };

        const result = calculateBottlenecks(items, revisionsData, mockMetadata);
        
        // Duration in To Do is 1 day (day2 - baseTime)
        // Duration in In Progress is 2 days (day4 - day2)
        // Duration in Done is ignored since Done is 'Completed' and it is the last state
        expect(result).toHaveLength(2);
        
        const inProgress = result.find(r => r.column === 'In Progress');
        const toDo = result.find(r => r.column === 'To Do');

        expect(inProgress).toBeDefined();
        expect(inProgress?.avgDays).toBe(2);

        expect(toDo).toBeDefined();
        expect(toDo?.avgDays).toBe(1);
    });

    it('should calculate active time in the last state if item is not Done or Removed', () => {
        const baseTime = new Date();
        // Set last changed date to 2 days ago
        baseTime.setDate(baseTime.getDate() - 2);

        const items: WorkItemNode[] = [
            {
                id: 2,
                fields: {
                    'System.Id': 2,
                    'System.Title': 'Task 2',
                    'System.State': 'Active',
                    'System.WorkItemType': 'Task'
                },
                children: []
            }
        ];

        const revisionsData = {
            2: [
                {
                    id: 2,
                    fields: {
                        'System.Id': 2,
                        'System.Title': 'Task 2',
                        'System.BoardColumn': 'In Progress',
                        'System.State': 'Active',
                        'System.WorkItemType': 'Task',
                        'System.ChangedDate': baseTime.toISOString()
                    }
                }
            ]
        };

        const result = calculateBottlenecks(items, revisionsData, mockMetadata);
        expect(result).toHaveLength(1);
        expect(result[0].column).toBe('In Progress');
        // It should be around 2 days
        expect(result[0].avgDays).toBeGreaterThanOrEqual(1.9);
        expect(result[0].avgDays).toBeLessThanOrEqual(2.1);
    });
});

describe('analytics.ts > computeMetrics and calculateAnomalies', () => {
    const mockMetadata = {
        types: {
            'user story': { name: 'User Story', color: '#0078d4', iconData: null, states: {} },
            epic: { name: 'Epic', color: '#e11d48', iconData: null, states: {} }
        },
        states: {
            done: { name: 'Done', category: 'Completed', color: '#10b981' },
            active: { name: 'Active', category: 'InProgress', color: '#0078d4' },
            new: { name: 'New', category: 'Proposed', color: '#b2b2b2' }
        },
        backlogs: [
            { name: 'Epics', type: 'portfolio', workItemTypes: ['epic'] },
            { name: 'Requirement Backlog', type: 'requirement', workItemTypes: ['user story'] }
        ]
    } as unknown as WorkItemMetadata;

    it('should compute metrics and respect custom CFD period length', () => {
        const items: WorkItemNode[] = [
            {
                id: 10,
                fields: {
                    'System.Id': 10,
                    'System.Title': 'Story 10',
                    'System.State': 'Active',
                    'System.WorkItemType': 'User Story',
                    'System.CreatedDate': '2026-06-01T00:00:00Z',
                    'System.ChangedDate': '2026-06-10T00:00:00Z'
                },
                children: []
            }
        ];

        const metrics30 = computeMetrics(items, undefined, mockMetadata, 'en', 30);
        expect(metrics30.cfdSeries).toHaveLength(30);

        const metrics90 = computeMetrics(items, undefined, mockMetadata, 'en', 90);
        expect(metrics90.cfdSeries).toHaveLength(90);

        const metrics180 = computeMetrics(items, undefined, mockMetadata, 'en', 180);
        expect(metrics180.cfdSeries).toHaveLength(180);
    });

    it('should generate anomaly alerts for stale items and WIP overload', () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 20); // 20 days ago

        const items: WorkItemNode[] = Array.from({ length: 9 }, (_, i) => ({
            id: i + 1,
            fields: {
                'System.Id': i + 1,
                'System.Title': `Stale Task ${i + 1}`,
                'System.State': 'Active',
                'System.BoardColumn': 'Doing',
                'System.WorkItemType': 'User Story',
                'System.CreatedDate': oldDate.toISOString(),
                'System.ChangedDate': oldDate.toISOString()
            },
            children: []
        }));

        const metrics = computeMetrics(items, undefined, mockMetadata, 'en');
        expect(metrics.anomalies.length).toBeGreaterThan(0);

        const staleAlert = metrics.anomalies.find((a) => a.type === 'warning');
        expect(staleAlert).toBeDefined();

        const wipAlert = metrics.anomalies.find((a) => a.type === 'error');
        expect(wipAlert).toBeDefined();
    });
});
