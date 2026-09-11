import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderLegends } from './legends.ts';
import type { WorkItemNode, WorkItemMetadata } from '../types.ts';
import * as utils from '../utils.ts';

vi.mock('../utils.ts', () => ({
    getItemIcon: vi.fn(),
    getStatusInfo: vi.fn()
}));

describe('legends.ts', () => {
    let statusLegend: HTMLElement;
    let typeLegend: HTMLElement;

    const mockMetadata: WorkItemMetadata = {
        types: {
            Epic: { name: 'Epic', color: '#ff5722' },
            Task: { name: 'Task', color: '#773b93' }
        },
        states: {
            Active: { name: 'Active', category: 'InProgress', color: '#3b82f6' },
            Done: { name: 'Done', category: 'Completed', color: '#10b981' }
        },
        backlogs: [
            { name: 'Iteration backlog', workItemTypes: ['Task'] },
            { name: 'Epic backlog', workItemTypes: ['Epic'] }
        ]
    } as any;

    const mockTranslations = {
        en: {
            'status-backlog': 'Backlog',
            'status-inprogress': 'In Progress',
            'status-done': 'Done',
            'status-removed': 'Removed'
        }
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="status-legend"></div>
            <div id="type-legend"></div>
        `;
        statusLegend = document.getElementById('status-legend')!;
        typeLegend = document.getElementById('type-legend')!;
        vi.clearAllMocks();
    });

    it('should handle missing containers gracefully', () => {
        document.body.innerHTML = '';
        expect(() => renderLegends(null, mockMetadata, mockTranslations, 'en')).not.toThrow();
    });

    it('should render all legends when activeItems is null', () => {
        vi.mocked(utils.getItemIcon).mockReturnValue({ icon: 'icon-test', isPortfolio: false, color: '#fff' });

        renderLegends(null, mockMetadata, mockTranslations, 'en');

        // Status legend should have 4 default items
        expect(statusLegend.children.length).toBe(4);
        expect(statusLegend.textContent).toContain('Backlog');
        expect(statusLegend.textContent).toContain('In Progress');

        // Type legend should render types from metadata backlogs or keys
        expect(typeLegend.children.length).toBeGreaterThan(0);

        // Task should be unchecked (iteration backlog)
        const taskCheckbox =
            typeLegend.querySelector('input[data-type="task"]') ||
            (typeLegend.querySelector('input[data-type="Task"]') as HTMLInputElement);
        expect(taskCheckbox.checked).toBe(false);
    });

    it('should filter legends based on activeItems', () => {
        const activeItems = [
            { fields: { 'System.WorkItemType': 'Epic', 'System.State': 'Active' } }
        ] as unknown as WorkItemNode[];

        vi.mocked(utils.getItemIcon).mockReturnValue({
            iconData: 'data:image/png',
            isPortfolio: true,
            color: '#fff'
        } as any);
        vi.mocked(utils.getStatusInfo).mockReturnValue({ label: 'In Progress' } as any);

        renderLegends(activeItems, mockMetadata, mockTranslations, 'en');

        // Status legend should only contain 'In Progress' since 'Active' maps to it
        expect(statusLegend.children.length).toBe(1);
        expect(statusLegend.textContent).toContain('In Progress');
        expect(statusLegend.textContent).not.toContain('Done');

        // Type legend should only contain 'Epic'
        expect(typeLegend.children.length).toBe(1);
        const epicCheckbox =
            typeLegend.querySelector('input[data-type="epic"]') ||
            (typeLegend.querySelector('input[data-type="Epic"]') as HTMLInputElement);
        expect(epicCheckbox.checked).toBe(true); // Not iteration backlog
    });
});
