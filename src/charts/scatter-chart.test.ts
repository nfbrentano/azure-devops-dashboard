import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderScatterChart } from './scatter-chart.ts';
import Chart from 'chart.js/auto';
import type { ScatterMetrics } from '../types.ts';

vi.mock('chart.js/auto', () => {
    const ChartMock = vi.fn(function () {
        return { destroy: vi.fn(), update: vi.fn() };
    });
    (ChartMock as any).defaults = { font: {}, elements: { line: {}, point: {} }, plugins: { tooltip: {} } };
    return { default: ChartMock };
});

describe('scatter-chart.ts', () => {
    let container: HTMLElement;
    const translations = {
        en: {
            'scatter-item-label': 'Work Items (Cycle Time)',
            'label-cycle-time-days': 'Cycle Time (days)',
            'label-completion-date': 'Completion Date'
        }
    };
    const azureConfig = { org: 'org', project: 'proj', pat: 'pat' };

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <canvas id="scatterChart"></canvas>
            </div>
        `;
        container = document.body.firstElementChild as HTMLElement;
        vi.clearAllMocks();
    });

    it('should handle missing canvas gracefully', () => {
        document.body.innerHTML = '<div></div>';
        const charts: any = {};
        expect(() => renderScatterChart(undefined, charts, 'light', 'en', translations, azureConfig)).not.toThrow();
    });

    it('should handle empty data gracefully', () => {
        const charts: any = {};
        renderScatterChart({ points: [], p50: 0, p85: 0, p95: 0 }, charts, 'light', 'en', translations, azureConfig);
        expect(Chart).not.toHaveBeenCalled();
    });

    it('should destroy existing chart instance', () => {
        const destroyMock = vi.fn();
        const charts: any = { scatter: { destroy: destroyMock } };
        const data: ScatterMetrics = {
            points: [{ id: 1, title: 'Item', type: 'Bug', x: '2023-01-01T12:00:00Z', y: 5 }],
            p50: 5,
            p85: 10,
            p95: 15
        };
        renderScatterChart(data, charts, 'light', 'en', translations, azureConfig);
        expect(destroyMock).toHaveBeenCalled();
    });

    it('should render chart and map data correctly, sorting by date', () => {
        const charts: any = {};
        const data: ScatterMetrics = {
            points: [
                { id: 2, title: 'Item 2', type: 'Task', x: '2023-01-02T12:00:00Z', y: 10 },
                { id: 1, title: 'Item 1', type: 'Bug', x: '2023-01-01T12:00:00Z', y: 5 }
            ],
            p50: 5,
            p85: 10,
            p95: 15
        };

        renderScatterChart(data, charts, 'light', 'en', translations, azureConfig);

        expect(Chart).toHaveBeenCalled();
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;

        // Should sort by date so Item 1 comes first
        expect(callArgs.data.datasets[0].data[0].id).toBe(1);
        expect(callArgs.data.datasets[0].data[1].id).toBe(2);

        // Check labels
        expect(callArgs.data.labels).toEqual(['2023-01-01', '2023-01-02']);

        // Check percentile lines
        expect(callArgs.data.datasets.length).toBe(4);
        expect(callArgs.data.datasets[1].data).toEqual([
            { x: 0, y: 5 },
            { x: 1, y: 5 }
        ]); // p50
        expect(callArgs.data.datasets[2].data).toEqual([
            { x: 0, y: 10 },
            { x: 1, y: 10 }
        ]); // p85
        expect(callArgs.data.datasets[3].data).toEqual([
            { x: 0, y: 15 },
            { x: 1, y: 15 }
        ]); // p95
    });

    it('should handle x-axis tick callback', () => {
        const charts: any = {};
        const data: ScatterMetrics = {
            points: [{ id: 1, title: 'Item', type: 'Bug', x: '2023-01-01T12:00:00Z', y: 5 }],
            p50: 5,
            p85: 5,
            p95: 5
        };
        renderScatterChart(data, charts, 'light', 'en', translations, azureConfig);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const tickCallback = callArgs.options.scales.x.ticks.callback;

        expect(tickCallback(0)).toBe('2023-01-01');
        expect(tickCallback(99)).toBe(''); // out of bounds
    });

    it('should handle tooltip callbacks', () => {
        const charts: any = {};
        const data: ScatterMetrics = {
            points: [{ id: 1, title: 'Item 1', type: 'Bug', x: '2023-01-01T12:00:00Z', y: 5.5 }],
            p50: 5,
            p85: 5,
            p95: 5
        };
        renderScatterChart(data, charts, 'light', 'en', translations, azureConfig);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const labelCallback = callArgs.options.plugins.tooltip.callbacks.label;

        // Mock context for the scatter points (dataset 0)
        const result0 = labelCallback({ datasetIndex: 0, raw: callArgs.data.datasets[0].data[0] });
        expect(result0[0]).toBe('#1: Item 1');
        expect(result0[1]).toBe('Tipo: Bug');
        expect(result0[2]).toBe('Data: 2023-01-01');
        expect(result0[3]).toContain('Cycle Time: 5.5');

        // Mock context for a percentile line (dataset 1)
        const result1 = labelCallback({ datasetIndex: 1, dataset: { label: '50% (5.0d)' } });
        expect(result1).toBe('50% (5.0d)');
    });

    it('should handle onClick to open work item', () => {
        const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        const charts: any = {};
        const data: ScatterMetrics = {
            points: [{ id: 101, title: 'Item', type: 'Bug', x: '2023-01-01', y: 5 }],
            p50: 5,
            p85: 5,
            p95: 5
        };
        renderScatterChart(data, charts, 'light', 'en', translations, azureConfig);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const onClick = callArgs.options.onClick;

        // Mock elements array for dataset 0
        onClick({}, [{ datasetIndex: 0, index: 0 }]);
        expect(windowOpenSpy).toHaveBeenCalledWith('https://dev.azure.com/org/proj/_workitems/edit/101', '_blank');

        // Mock elements array for percentile line
        windowOpenSpy.mockClear();
        onClick({}, [{ datasetIndex: 1, index: 0 }]);
        expect(windowOpenSpy).not.toHaveBeenCalled();

        windowOpenSpy.mockRestore();
    });
});
