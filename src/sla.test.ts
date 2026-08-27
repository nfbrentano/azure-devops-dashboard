import { describe, it, expect } from 'vitest';
import { calculateSLACompliance, isItemBreachingSLA, DEFAULT_SLA_CONFIG } from './sla.ts';
import type { WorkItemNode } from './types.ts';

describe('sla.ts', () => {
    it('should compute SLA compliance for completed items', () => {
        const now = new Date();
        const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

        const mockItems: WorkItemNode[] = [
            // Bug met SLA (2 days <= 5 days target)
            {
                id: 1,
                fields: {
                    'System.Id': 1,
                    'System.Title': 'Bug A',
                    'System.WorkItemType': 'Bug',
                    'System.State': 'Closed',
                    'System.CreatedDate': fourDaysAgo,
                    'Microsoft.VSTS.Common.ActivatedDate': fourDaysAgo,
                    'Microsoft.VSTS.Common.ClosedDate': twoDaysAgo
                },
                children: []
            },
            // Bug breached SLA (8 days > 5 days target)
            {
                id: 2,
                fields: {
                    'System.Id': 2,
                    'System.Title': 'Bug B',
                    'System.WorkItemType': 'Bug',
                    'System.State': 'Closed',
                    'System.CreatedDate': tenDaysAgo,
                    'Microsoft.VSTS.Common.ActivatedDate': tenDaysAgo,
                    'Microsoft.VSTS.Common.ClosedDate': twoDaysAgo
                },
                children: []
            }
        ];

        const results = calculateSLACompliance(mockItems, undefined, DEFAULT_SLA_CONFIG);
        const bugResult = results.find((r) => r.workItemType.toLowerCase() === 'bug');

        expect(bugResult).toBeDefined();
        expect(bugResult?.total).toBe(2);
        expect(bugResult?.met).toBe(1);
        expect(bugResult?.breached).toBe(1);
        expect(bugResult?.compliancePct).toBe(50);
    });

    it('should correctly flag breaching items with isItemBreachingSLA', () => {
        const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();

        const breachingBug: WorkItemNode = {
            id: 3,
            fields: {
                'System.Id': 3,
                'System.Title': 'Slow Bug',
                'System.WorkItemType': 'Bug',
                'System.State': 'In Progress',
                'System.CreatedDate': twentyDaysAgo,
                'Microsoft.VSTS.Common.ActivatedDate': twentyDaysAgo
            },
            children: []
        };

        expect(isItemBreachingSLA(breachingBug, DEFAULT_SLA_CONFIG)).toBe(true);
    });
});
