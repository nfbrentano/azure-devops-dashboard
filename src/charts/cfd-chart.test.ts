import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderCFDChart } from './cfd-chart.ts';
import Chart from 'chart.js/auto';

vi.mock('chart.js/auto', () => {
    const ChartMock = vi.fn(function () {
        return { destroy: vi.fn(), update: vi.fn() };
    });
    (ChartMock as any).defaults = { font: {}, elements: { line: {}, point: {} }, plugins: { tooltip: {} } };
    return { default: ChartMock };
});

describe('cfd-chart.ts', () => {
    let container: HTMLElement;
    const translations = {
        en: {
            'msg-cfd-empty': 'No CFD data available',
            'status-done': 'Done',
            'status-inprogress': 'In Progress',
            'status-backlog': 'Backlog'
        }
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <canvas id="cfdChart"></canvas>
            </div>
        `;
        container = document.body.firstElementChild as HTMLElement;
        vi.clearAllMocks();
    });

    it('should display empty message when data is empty', () => {
        renderCFDChart([], {} as any, 'light', 'en', translations);
        expect(container.innerHTML).toContain('No CFD data available');
    });

    it('should display empty message when data is null/undefined', () => {
        renderCFDChart(null as any, {} as any, 'light', 'en', translations);
        expect(container.innerHTML).toContain('No CFD data available');
    });

    it('should recreate canvas if empty message is present and data exists', () => {
        container.innerHTML = `<div id="cfd-empty-msg">empty</div>`;
        const charts: any = {};
        renderCFDChart(
            [{ date: new Date(), Done: 1, InProgress: 1, Proposed: 1 }],
            charts,
            'light',
            'en',
            translations
        );
        expect(container.querySelector('canvas')).not.toBeNull();
        expect(charts.cfd).toBeDefined();
    });

    it('should destroy existing chart instance', () => {
        const destroyMock = vi.fn();
        const charts: any = { cfd: { destroy: destroyMock } };
        renderCFDChart(
            [{ date: new Date(), Done: 1, InProgress: 1, Proposed: 1 }],
            charts,
            'light',
            'en',
            translations
        );
        expect(destroyMock).toHaveBeenCalled();
    });

    it('should render chart and map data correctly', () => {
        const charts: any = {};
        const data = [
            { date: new Date('2023-01-01T12:00:00Z'), Done: 5, InProgress: 10, Proposed: 15 },
            { date: new Date('2023-01-02T12:00:00Z'), Done: 10, InProgress: 12, Proposed: 8 }
        ];
        renderCFDChart(data, charts, 'light', 'en', translations);

        expect(Chart).toHaveBeenCalled();
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;

        expect(callArgs.data.datasets.length).toBe(3);

        // Done
        expect(callArgs.data.datasets[0].label).toBe('Done');
        expect(callArgs.data.datasets[0].data).toEqual([5, 10]);

        // In Progress
        expect(callArgs.data.datasets[1].label).toBe('In Progress');
        expect(callArgs.data.datasets[1].data).toEqual([10, 12]);

        // Backlog/Proposed
        expect(callArgs.data.datasets[2].label).toBe('Backlog');
        expect(callArgs.data.datasets[2].data).toEqual([15, 8]);
    });
});
