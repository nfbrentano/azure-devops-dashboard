import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderThroughputChart } from './throughput-chart.ts';
import Chart from 'chart.js/auto';

vi.mock('chart.js/auto', () => {
    const ChartMock = vi.fn(function () {
        return { destroy: vi.fn(), update: vi.fn() };
    });
    (ChartMock as any).defaults = { font: {}, elements: { line: {}, point: {} }, plugins: { tooltip: {} } };
    return { default: ChartMock };
});

describe('throughput-chart.ts', () => {
    let container: HTMLElement;
    const translations = {
        en: {
            'label-delivered-items': 'Delivered Items',
            'label-quantity': 'Quantity',
            'label-delivered': 'Delivered',
            'label-items': 'items'
        }
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <canvas id="throughputChart"></canvas>
            </div>
        `;
        container = document.body.firstElementChild as HTMLElement;
        vi.clearAllMocks();
    });

    it('should handle missing canvas gracefully', () => {
        document.body.innerHTML = '<div></div>';
        const charts: any = {};
        expect(() => renderThroughputChart([], charts, 'light', 'en', translations)).not.toThrow();
    });

    it('should destroy existing chart instance', () => {
        const destroyMock = vi.fn();
        const charts: any = { throughput: { destroy: destroyMock } };
        renderThroughputChart([], charts, 'light', 'en', translations);
        expect(destroyMock).toHaveBeenCalled();
    });

    it('should render chart and map data correctly', () => {
        const charts: any = {};
        const data = [
            { label: 'Week 1', count: 5, range: 'Jan 1 - Jan 7' },
            { label: 'Week 2', count: 8, range: 'Jan 8 - Jan 14' }
        ];
        renderThroughputChart(data, charts, 'light', 'en', translations);

        expect(Chart).toHaveBeenCalled();
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;

        expect(callArgs.data.labels).toEqual(['Week 1', 'Week 2']);
        expect(callArgs.data.datasets[0].data).toEqual([5, 8]);
        expect(callArgs.data.datasets[0].label).toEqual('Delivered Items');
    });

    it('should handle background color gradient fallback if chartArea is missing', () => {
        const charts: any = {};
        const data = [{ label: 'Week 1', count: 5, range: 'Jan 1 - Jan 7' }];
        renderThroughputChart(data, charts, 'light', 'en', translations);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const bgFunc = callArgs.data.datasets[0].backgroundColor;

        const fallbackColor = bgFunc({ chart: {} });
        expect(fallbackColor).toBe('#3b82f6');
    });
});
