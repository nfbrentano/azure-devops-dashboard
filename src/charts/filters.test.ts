import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    renderPortfolioFilters,
    renderGlobalTypeFilters,
    renderTimelineTypeFilters,
    renderTimelineStateFilters
} from './filters.ts';
import type { WorkItemNode, WorkItemMetadata } from '../types.ts';
import * as utils from '../utils.ts';

vi.mock('../utils.ts', () => ({
    getItemIcon: vi.fn(),
    getStatusInfo: vi.fn()
}));

describe('filters.ts', () => {
    let portfolioContainer: HTMLElement;
    let globalTypeContainer: HTMLElement;
    let timelineTypeContainer: HTMLElement;
    let timelineStateContainer: HTMLElement;

    const mockMetadata: WorkItemMetadata = {
        types: {
            Epic: { name: 'Epic', color: '#ff5722' },
            Feature: { name: 'Feature', color: '#773b93' }
        },
        states: {},
        backlogs: []
    } as any;

    const mockTranslations = { en: {} };

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="portfolio-status-filters"></div>
            <div id="global-type-legend"></div>
            <div id="timeline-type-legend"></div>
            <div id="timeline-state-filters"></div>
        `;
        portfolioContainer = document.getElementById('portfolio-status-filters')!;
        globalTypeContainer = document.getElementById('global-type-legend')!;
        timelineTypeContainer = document.getElementById('timeline-type-legend')!;
        timelineStateContainer = document.getElementById('timeline-state-filters')!;
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('renderPortfolioFilters', () => {
        it('should handle missing container gracefully', () => {
            document.body.innerHTML = '';
            expect(() => renderPortfolioFilters([], mockMetadata, mockTranslations, 'en', vi.fn())).not.toThrow();
        });

        it('should render empty when no portfolio items', () => {
            renderPortfolioFilters([], mockMetadata, mockTranslations, 'en', vi.fn());
            expect(portfolioContainer.innerHTML).toBe('');
        });

        it('should render portfolio statuses and trigger callback on change', () => {
            const items = [
                { fields: { 'System.WorkItemType': 'Epic', 'System.State': 'Active' } },
                { fields: { 'System.WorkItemType': 'Feature', 'System.State': 'New' } }
            ] as unknown as WorkItemNode[];

            vi.mocked(utils.getItemIcon).mockImplementation((type) => {
                return { isPortfolio: type === 'Epic', icon: 'test', color: 'test' };
            });
            vi.mocked(utils.getStatusInfo).mockReturnValue({ label: 'Active', color: '#fff', category: 'InProgress' });

            const onChange = vi.fn();
            renderPortfolioFilters(items, mockMetadata, mockTranslations, 'en', onChange);

            expect(portfolioContainer.querySelectorAll('input').length).toBe(1);
            expect(portfolioContainer.textContent).toContain('Active');

            const checkbox = portfolioContainer.querySelector('input')!;
            checkbox.dispatchEvent(new Event('change'));
            expect(onChange).toHaveBeenCalled();
        });

        it('should preserve previous selection if it existed in container', () => {
            portfolioContainer.innerHTML = '<input type="checkbox" value="Active" checked>';
            const items = [
                { fields: { 'System.WorkItemType': 'Epic', 'System.State': 'Active' } }
            ] as unknown as WorkItemNode[];
            vi.mocked(utils.getItemIcon).mockReturnValue({ isPortfolio: true } as any);
            vi.mocked(utils.getStatusInfo).mockReturnValue({ label: 'Active', color: '#fff', category: 'InProgress' });

            renderPortfolioFilters(items, mockMetadata, mockTranslations, 'en', vi.fn());
            const checkbox = portfolioContainer.querySelector('input')!;
            expect(checkbox.checked).toBe(true);
        });
    });

    describe('renderGlobalTypeFilters', () => {
        it('should render checkboxes for unique types', () => {
            const items = [
                { fields: { 'System.WorkItemType': 'Epic' } },
                { fields: { 'System.WorkItemType': 'Feature' } }
            ] as unknown as WorkItemNode[];

            vi.mocked(utils.getItemIcon).mockReturnValue({ icon: 'icon-test', isPortfolio: false, color: '#fff' });

            const onChange = vi.fn();
            renderGlobalTypeFilters(['Epic'], items, mockMetadata, 'en', onChange);

            const inputs = globalTypeContainer.querySelectorAll('input');
            expect(inputs.length).toBe(2);

            const epicCheckbox = globalTypeContainer.querySelector(
                'input[data-global-type="Epic"]'
            ) as HTMLInputElement;
            expect(epicCheckbox.checked).toBe(true);

            const featureCheckbox = globalTypeContainer.querySelector(
                'input[data-global-type="Feature"]'
            ) as HTMLInputElement;
            expect(featureCheckbox.checked).toBe(false);

            featureCheckbox.checked = true;
            featureCheckbox.dispatchEvent(new Event('change'));
            expect(onChange).toHaveBeenCalledWith(['Epic', 'Feature']);
        });
    });

    describe('renderTimelineTypeFilters', () => {
        it('should render checkboxes and save to localStorage on change', () => {
            const items = [{ fields: { 'System.WorkItemType': 'Epic' } }] as unknown as WorkItemNode[];

            vi.mocked(utils.getItemIcon).mockReturnValue({
                iconData: 'data:image/png',
                isPortfolio: false,
                color: '#fff'
            } as any);
            const onChange = vi.fn();

            renderTimelineTypeFilters(items, [], mockMetadata, 'en', onChange);

            const checkbox = timelineTypeContainer.querySelector('input') as HTMLInputElement;
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));

            expect(onChange).toHaveBeenCalledWith(['Epic']);
            expect(localStorage.getItem('timeline_active_types')).toBe(JSON.stringify(['Epic']));
        });
    });

    describe('renderTimelineStateFilters', () => {
        it('should render checkboxes and save to localStorage on change', () => {
            const items = [{ fields: { 'System.State': 'Done' } }] as unknown as WorkItemNode[];

            vi.mocked(utils.getStatusInfo).mockReturnValue({ label: 'Done', color: '#10b981', category: 'Completed' });
            const onChange = vi.fn();

            renderTimelineStateFilters(items, ['Done'], mockMetadata, 'en', onChange);

            const checkbox = timelineStateContainer.querySelector('input') as HTMLInputElement;
            expect(checkbox.checked).toBe(true);

            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));

            expect(onChange).toHaveBeenCalledWith([]);
            expect(localStorage.getItem('timeline_active_states')).toBe(JSON.stringify([]));
        });
    });
});
