import { describe, it, expect } from 'vitest';
import { calculateProgress, getStatusInfo, getItemIcon } from './utils.ts';
import type { WorkItemMetadata, WorkItemNode } from './types.ts';

describe('utils.ts', () => {
    const mockMetadata = {
        types: {
            'epic': { color: '#ff0000' },
            'feature': { color: '#00ff00' },
            'user story': { color: '#0000ff' },
            'task': { color: '#cccccc' }
        },
        states: {
            'done': { category: 'Completed', color: '#10b981' },
            'closed': { category: 'Completed', color: '#10b981' },
            'resolved': { category: 'InProgress', color: '#0078d4' }, // Specific case
            'active': { category: 'InProgress', color: '#0078d4' },
            'new': { category: 'Proposed', color: '#b2b2b2' }
        },
        backlogs: [
            { name: 'Epics', type: 'portfolio', workItemTypes: ['epic'] },
            { name: 'Features', type: 'portfolio', workItemTypes: ['feature'] },
            { name: 'Stories', type: 'requirement', workItemTypes: ['user story'] }
        ]
    } as unknown as WorkItemMetadata;

    describe('getStatusInfo', () => {
        it('should return correct info for mapped states', () => {
            const result = getStatusInfo('Done', mockMetadata);
            expect(result.label).toBe('Done');
            expect(result.class).toBe('bg-done');
        });

        it('should return fallback info for unmapped states', () => {
            const result = getStatusInfo('SomeRandomState', mockMetadata);
            expect(result.label).toBe('Backlog');
        });

        it('should handle "Resolved" specifically in fallback if needed', () => {
            // If not in metadata, it uses internal fallback
            const emptyMeta = { types: {}, states: {}, backlogs: [] } as unknown as WorkItemMetadata;
            const result = getStatusInfo('Resolved', emptyMeta);
            expect(result.label).toBe('Done'); // Fallback says Done for resolved
        });
    });

    describe('calculateProgress', () => {
        it('should return 0 for leaf items with no children', () => {
            const item = { fields: { 'System.State': 'New' } } as unknown as WorkItemNode;
            expect(calculateProgress(item, mockMetadata)).toBe(0);
        });

        it('should calculate progress for simple hierarchy (50%)', () => {
            const item = {
                children: [
                    { fields: { 'System.State': 'Done' } },
                    { fields: { 'System.State': 'New' } }
                ]
            } as unknown as WorkItemNode;
            expect(calculateProgress(item, mockMetadata)).toBe(50);
        });

        it('should handle "Resolved" as 50% specifically', () => {
            const item = {
                children: [
                    { fields: { 'System.State': 'Resolved' } }
                ]
            } as unknown as WorkItemNode;
            // Resolved is hardcoded to 0.5 in calculateProgress
            expect(calculateProgress(item, mockMetadata)).toBe(50);
        });

        it('should work recursively for deep hierarchies', () => {
            const item = {
                children: [
                    { 
                        children: [
                            { fields: { 'System.State': 'Done' } }, // 1.0
                            { fields: { 'System.State': 'Resolved' } } // 0.5
                        ]
                    },
                    { fields: { 'System.State': 'New' } } // 0.0
                ]
            } as unknown as WorkItemNode;
            // Leaves are: Done(1), Resolved(0.5), New(0)
            // Total = (1 + 0.5 + 0) / 3 = 1.5 / 3 = 0.5 (50%)
            expect(calculateProgress(item, mockMetadata)).toBe(50);
        });

        it('should prefer allChildren over children if present', () => {
            const item = {
                allChildren: [
                    { fields: { 'System.State': 'Done' } }
                ],
                children: [] // Filtered out
            } as unknown as WorkItemNode;
            expect(calculateProgress(item, mockMetadata)).toBe(100);
        });
    });

    describe('getItemIcon', () => {
        it('should return correct icon for Epic', () => {
            const result = getItemIcon('Epic', mockMetadata);
            expect(result.icon).toContain('ph-crown');
            expect(result.isPortfolio).toBe(true);
        });

        it('should return correct icon for Task', () => {
            const result = getItemIcon('Task', mockMetadata);
            expect(result.icon).toContain('ph-check-square');
            expect(result.isPortfolio).toBe(false);
        });
    });
});
