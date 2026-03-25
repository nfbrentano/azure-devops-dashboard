import { describe, it, expect, vi } from 'vitest';
import { buildTree, getTypePriority } from './api.js';

// Mock dependencies that might be imported
vi.mock('./utils.js', () => ({
    showToast: vi.fn()
}));
vi.mock('./translations.js', () => ({
    translations: {}
}));
vi.mock('./state.js', () => ({
    state: { currentLanguage: 'en' }
}));

describe('api.js', () => {
    const mockMetadata = {
        backlogs: [
            { name: 'Epics', workItemTypes: ['epic'] },
            { name: 'Features', workItemTypes: ['feature'] }
        ]
    };

    describe('getTypePriority', () => {
        it('should return 1 for Epic based on backlogs', () => {
            expect(getTypePriority('Epic', mockMetadata)).toBe(1);
        });

        it('should return 2 for Feature based on backlogs', () => {
            expect(getTypePriority('Feature', mockMetadata)).toBe(2);
        });

        it('should return 99 for unknown type', () => {
            expect(getTypePriority('SomethingElse', mockMetadata)).toBe(99);
        });

        it('should use fallbacks if metadata is missing', () => {
            expect(getTypePriority('Epic', {})).toBe(1);
            expect(getTypePriority('Task', {})).toBe(4);
        });
    });

    describe('buildTree', () => {
        it('should link children to parents correctly', () => {
            const items = [
                { id: 1, fields: { 'System.WorkItemType': 'Epic' } },
                { id: 2, fields: { 'System.WorkItemType': 'Feature', 'System.Parent': { id: 1 } } },
                { id: 3, fields: { 'System.WorkItemType': 'User Story', 'System.Parent': 1 } }
            ];

            const { roots, nodes } = buildTree(items, mockMetadata);

            expect(roots.length).toBe(1);
            expect(roots[0].id).toBe(1);
            expect(roots[0].children.length).toBe(2);
            expect(roots[0].children.map(c => c.id)).toContain(2);
            expect(roots[0].children.map(c => c.id)).toContain(3);
        });

        it('should handle relations for parent linking', () => {
            const items = [
                { id: 1, fields: { 'System.WorkItemType': 'Epic' } },
                { 
                    id: 2, 
                    fields: { 'System.WorkItemType': 'Feature' },
                    relations: [
                        { rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://.../workitems/1' }
                    ]
                }
            ];

            const { roots } = buildTree(items, mockMetadata);

            expect(roots.length).toBe(1);
            expect(roots[0].children.length).toBe(1);
            expect(roots[0].children[0].id).toBe(2);
        });

        it('should sort roots and children by priority', () => {
            const items = [
                { id: 3, fields: { 'System.WorkItemType': 'User Story' } },
                { id: 1, fields: { 'System.WorkItemType': 'Epic' } },
                { id: 2, fields: { 'System.WorkItemType': 'Feature' } }
            ];

            const { roots } = buildTree(items, mockMetadata);

            expect(roots[0].fields['System.WorkItemType']).toBe('Epic');
            expect(roots[1].fields['System.WorkItemType']).toBe('Feature');
            expect(roots[2].fields['System.WorkItemType']).toBe('User Story');
        });

        it('should handle cases where parent is not in the list', () => {
            const items = [
                { id: 2, fields: { 'System.WorkItemType': 'Feature', 'System.Parent': 999 } }
            ];

            const { roots } = buildTree(items, mockMetadata);

            expect(roots.length).toBe(1);
            expect(roots[0].id).toBe(2);
        });
    });
});
