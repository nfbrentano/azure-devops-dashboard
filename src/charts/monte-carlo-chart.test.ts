import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderMonteCarloChart } from './monte-carlo-chart.ts';
import { Chart } from 'chart.js';

vi.mock('chart.js', () => {
    const ChartMock = vi.fn(function () {
        return { destroy: vi.fn(), update: vi.fn() };
    });
    (ChartMock as any).defaults = { font: {}, elements: { line: {}, point: {} }, plugins: { tooltip: {} } };
    return { Chart: ChartMock };
});

describe('monte-carlo-chart.ts', () => {
    let canvas: HTMLCanvasElement;
    const translations = {
        en: {
            'empty-state-desc': 'No data available',
            'label-weeks': 'weeks'
        }
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <canvas id="monteCarloChart" width="400" height="400"></canvas>
            </div>
        `;
        canvas = document.getElementById('monteCarloChart') as HTMLCanvasElement;

        // Mock getContext
        const ctxMock = {
            clearRect: vi.fn(),
            fillText: vi.fn(),
            fillStyle: '',
            font: '',
            textAlign: ''
        };
        vi.spyOn(canvas, 'getContext').mockReturnValue(ctxMock as any);
        vi.clearAllMocks();
    });

    it('should handle missing canvas gracefully', () => {
        document.body.innerHTML = '<div></div>';
        const charts: any = {};
        expect(() => renderMonteCarloChart(null, charts, 'light', 'en', translations)).not.toThrow();
    });

    it('should draw empty message directly on canvas when data is null', () => {
        const charts: any = {};
        renderMonteCarloChart(null, charts, 'light', 'en', translations);
        const ctxMock = canvas.getContext('2d');
        expect(ctxMock?.clearRect).toHaveBeenCalledWith(0, 0, 400, 400);
        expect(ctxMock?.fillText).toHaveBeenCalledWith('No data available', 200, 200);
    });

    it('should destroy existing chart instance', () => {
        const destroyMock = vi.fn();
        const charts: any = { monteCarlo: { destroy: destroyMock } };
        renderMonteCarloChart(null, charts, 'light', 'en', translations);
        expect(destroyMock).toHaveBeenCalled();
        expect(charts.monteCarlo).toBeNull();
    });

    it('should render chart and map data correctly', () => {
        const charts: any = {};
        const forecastData = {
            histogram: { 1: 500, 2: 300, 3: 200 },
            p50Weeks: 1,
            p85Weeks: 2,
            p95Weeks: 3
        };

        renderMonteCarloChart(forecastData, charts, 'light', 'en', translations);

        expect(Chart).toHaveBeenCalled();
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;

        expect(callArgs.data.labels).toEqual(['1 weeks', '2 weeks', '3 weeks']);
        expect(callArgs.data.datasets[0].data).toEqual([500, 300, 200]);

        // Check annotations
        const annotations = callArgs.options.plugins.annotation.annotations;
        expect(annotations.p50.label.content).toBe('P50: 1w');
        expect(annotations.p85.label.content).toBe('P85: 2w');
        expect(annotations.p95.label.content).toBe('P95: 3w');
    });

    it('should handle tooltip callbacks', () => {
        const charts: any = {};
        const forecastData = {
            histogram: { 1: 500 },
            p50Weeks: 1,
            p85Weeks: 1,
            p95Weeks: 1
        };
        renderMonteCarloChart(forecastData, charts, 'light', 'en', translations);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const titleCallback = callArgs.options.plugins.tooltip.callbacks.title;
        const labelCallback = callArgs.options.plugins.tooltip.callbacks.label;

        expect(titleCallback([{ label: '1 weeks' }])).toBe('1 weeks');
        expect(labelCallback({ raw: 500 })).toBe('500 simulations');
    });
});
