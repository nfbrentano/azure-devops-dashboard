import { describe, it, expect } from 'vitest';
import { calculateBottlenecks } from './analytics.ts';
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
                    fields: {
                        'System.BoardColumn': 'To Do',
                        'System.State': 'New',
                        'System.ChangedDate': baseTime.toISOString()
                    }
                },
                {
                    fields: {
                        'System.BoardColumn': 'In Progress',
                        'System.State': 'Active',
                        'System.ChangedDate': day2.toISOString()
                    }
                },
                {
                    fields: {
                        'System.BoardColumn': 'Done',
                        'System.State': 'Closed',
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
                    fields: {
                        'System.BoardColumn': 'In Progress',
                        'System.State': 'Active',
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
