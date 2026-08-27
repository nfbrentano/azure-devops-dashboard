import { describe, it, expect } from 'vitest';
import { calculateDORAMetrics } from './dora.ts';
import type { WorkItemNode, WorkItemMetadata } from './types.ts';

describe('dora.ts', () => {
    const mockMetadata: WorkItemMetadata = {
        types: {
            'user story': { name: 'User Story', color: '#007acc', iconData: null, states: {} },
            bug: { name: 'Bug', color: '#cc292b', iconData: null, states: {} }
        },
        backlogs: [
            {
                name: 'Requirement',
                type: 'requirement',
                workItemTypes: ['User Story']
            }
        ],
        states: {}
    };

    it('should calculate DORA metrics correctly for standard items', () => {
        const now = new Date();
        const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

        const mockItems: WorkItemNode[] = [
            {
                id: 101,
                fields: {
                    'System.Id': 101,
                    'System.Title': 'Story 1',
                    'System.State': 'Closed',
                    'System.WorkItemType': 'User Story',
                    'System.CreatedDate': tenDaysAgo,
                    'Microsoft.VSTS.Common.ClosedDate': fiveDaysAgo
                },
                children: []
            },
            {
                id: 102,
                fields: {
                    'System.Id': 102,
                    'System.Title': 'Bug 1',
                    'System.State': 'Closed',
                    'System.WorkItemType': 'Bug',
                    'System.CreatedDate': fiveDaysAgo,
                    'Microsoft.VSTS.Common.ActivatedDate': fiveDaysAgo,
                    'Microsoft.VSTS.Common.ClosedDate': twoDaysAgo
                },
                children: []
            }
        ];

        const dora = calculateDORAMetrics(mockItems, mockMetadata, 30);
        expect(dora.deploymentFrequency.value).toBeGreaterThan(0);
        expect(dora.leadTimeForChanges.value).toBe(5); // 5 days lead time for closed story
        expect(dora.timeToRestore.value).toBe(3); // 3 days restore time for bug
        expect(dora.changeFailureRate.value).toBe(100); // 1 bug vs 1 story deployed
    });

    it('should handle zero completed items gracefully', () => {
        const dora = calculateDORAMetrics([], mockMetadata, 30);
        expect(dora.deploymentFrequency.value).toBe(0);
        expect(dora.deploymentFrequency.class).toBe('Low');
        expect(dora.leadTimeForChanges.value).toBe(0);
        expect(dora.changeFailureRate.value).toBe(-1);
        expect(dora.timeToRestore.value).toBe(-1);
    });
});
