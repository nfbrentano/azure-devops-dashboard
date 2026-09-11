import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderCharts } from './comparison-chart.ts';
import Chart from 'chart.js/auto';

vi.mock('chart.js/auto', () => {
    const ChartMock = vi.fn(function () {
        return { destroy: vi.fn(), update: vi.fn() };
    });
    (ChartMock as any).defaults = { font: {}, elements: { line: {}, point: {} }, plugins: { tooltip: {} } };
    return { default: ChartMock };
});

describe('comparison-chart.ts', () => {
    let container: HTMLElement;
    const translations = {
        en: {
            'label-days': 'Days',
            'metric-lead-time-title': 'Lead Time',
            'metric-cycle-time-title': 'Cycle Time'
        }
    };
    const azureConfig = { org: 'org', project: 'proj', pat: 'pat' };

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <canvas id="comparisonChart"></canvas>
            </div>
        `;
        container = document.body.firstElementChild as HTMLElement;
        vi.clearAllMocks();
    });

    it('should handle missing canvas gracefully', () => {
        document.body.innerHTML = '<div></div>';
        const charts: any = {};
        expect(() => renderCharts([], [], [], charts, 'light', 'en', translations, azureConfig)).not.toThrow();
    });

    it('should destroy existing chart instance', () => {
        const destroyMock = vi.fn();
        const charts: any = { comparison: { destroy: destroyMock } };
        renderCharts([], [], [], charts, 'light', 'en', translations, azureConfig);
        expect(destroyMock).toHaveBeenCalled();
    });

    it('should render chart and map data correctly', () => {
        const charts: any = {};
        const labels = ['ID 1', 'ID 2'];
        const leadTimes = [10, 20];
        const cycleTimes = [5, 10];

        renderCharts(labels, leadTimes, cycleTimes, charts, 'light', 'en', translations, azureConfig);

        expect(Chart).toHaveBeenCalled();
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;

        expect(callArgs.data.labels).toEqual(['ID 1', 'ID 2']);
        expect(callArgs.data.datasets.length).toBe(2);
        expect(callArgs.data.datasets[0].label).toBe('Lead Time');
        expect(callArgs.data.datasets[0].data).toEqual([10, 20]);
        expect(callArgs.data.datasets[1].label).toBe('Cycle Time');
        expect(callArgs.data.datasets[1].data).toEqual([5, 10]);
    });

    it('should handle onClick to open work item', () => {
        const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        const charts: any = {};
        const labels = ['ID 101'];
        renderCharts(labels, [10], [5], charts, 'light', 'en', translations, azureConfig);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const onClick = callArgs.options.onClick;

        // Mock elements array with an index
        onClick({}, [{ index: 0 }]);

        expect(windowOpenSpy).toHaveBeenCalledWith('https://dev.azure.com/org/proj/_workitems/edit/101', '_blank');
        windowOpenSpy.mockRestore();
    });
});
