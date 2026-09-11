import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderBottlenecksChart } from './bottlenecks-chart.ts';
import Chart from 'chart.js/auto';

vi.mock('chart.js/auto', () => {
    const ChartMock = vi.fn(function () {
        return { destroy: vi.fn(), update: vi.fn() };
    });
    (ChartMock as any).defaults = { font: {}, elements: { line: {}, point: {} }, plugins: { tooltip: {} } };
    return { default: ChartMock };
});

describe('bottlenecks-chart.ts', () => {
    let container: HTMLElement;
    const translations = {
        en: {
            'msg-bottlenecks-empty': 'No bottlenecks data available',
            'label-avg-days': 'Average Days',
            'label-days': 'Days'
        }
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <canvas id="bottlenecksChart"></canvas>
            </div>
        `;
        container = document.body.firstElementChild as HTMLElement;
        vi.clearAllMocks();
    });

    it('should display empty message when data is empty', () => {
        renderBottlenecksChart([], {} as any, 'light', 'en', translations);
        expect(container.innerHTML).toContain('No bottlenecks data available');
    });

    it('should display empty message when data is null/undefined', () => {
        renderBottlenecksChart(null as any, {} as any, 'light', 'en', translations);
        expect(container.innerHTML).toContain('No bottlenecks data available');
    });

    it('should recreate canvas if empty message is present and data exists', () => {
        container.innerHTML = `<div id="bottlenecks-empty-msg">empty</div>`;
        const charts: any = {};
        renderBottlenecksChart([{ column: 'Test', avgDays: 1 }], charts, 'light', 'en', translations);
        expect(container.querySelector('canvas')).not.toBeNull();
        expect(charts.bottlenecks).toBeDefined();
    });

    it('should destroy existing chart instance', () => {
        const destroyMock = vi.fn();
        const charts: any = { bottlenecks: { destroy: destroyMock } };
        renderBottlenecksChart([{ column: 'Test', avgDays: 1 }], charts, 'light', 'en', translations);
        expect(destroyMock).toHaveBeenCalled();
    });

    it('should render chart and map colors correctly based on values', () => {
        const charts: any = {};
        const data = [
            { column: 'Low', avgDays: 1.5 },
            { column: 'Med', avgDays: 3.5 },
            { column: 'High', avgDays: 6.0 }
        ];
        renderBottlenecksChart(data, charts, 'light', 'en', translations);

        expect(Chart).toHaveBeenCalled();
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;

        expect(callArgs.data.labels).toEqual(['Low', 'Med', 'High']);
        expect(callArgs.data.datasets[0].data).toEqual([1.5, 3.5, 6.0]);
        expect(callArgs.data.datasets[0].backgroundColor).toEqual(['#3b82f6', '#f59e0b', '#ef4444']);
    });
});
