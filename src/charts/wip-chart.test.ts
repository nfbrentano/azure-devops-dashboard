import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWIPChart } from './wip-chart.ts';
import Chart from 'chart.js/auto';

// Mock Chart.js
vi.mock('chart.js/auto', () => {
    const ChartMock = vi.fn(function () {
        return { destroy: vi.fn(), update: vi.fn() };
    });
    (ChartMock as any).defaults = { font: {}, elements: { line: {}, point: {} }, plugins: { tooltip: {} } };
    return { default: ChartMock };
});

describe('wip-chart.ts', () => {
    let container: HTMLElement;
    const translations = {
        en: {
            'msg-wip-empty': 'No items in progress',
            'label-items-count': 'Items',
            'label-quantity': 'Quantity',
            'label-items': 'Item'
        }
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <canvas id="wipChart"></canvas>
            </div>
        `;
        container = document.body.firstElementChild as HTMLElement;
        vi.clearAllMocks();
    });

    it('should display empty message when there is no board data', () => {
        renderWIPChart({}, {} as any, 'light', 'en', translations);
        expect(container.innerHTML).toContain('No items in progress');
    });

    it('should recreate canvas if empty message is present and data exists', () => {
        container.innerHTML = `<div id="wip-empty-msg">empty</div>`;
        const charts: any = {};
        renderWIPChart({ 'To Do': 1 }, charts, 'light', 'en', translations);
        expect(container.querySelector('canvas')).not.toBeNull();
        expect(charts.wip).toBeDefined();
    });

    it('should destroy existing chart instance', () => {
        const destroyMock = vi.fn();
        const charts: any = { wip: { destroy: destroyMock } };
        renderWIPChart({ 'To Do': 1 }, charts, 'light', 'en', translations);
        expect(destroyMock).toHaveBeenCalled();
    });

    it('should render chart and highlight overloaded columns', () => {
        const charts: any = {};
        const boardData = {
            'To Do': 5,
            'In Progress': 10,
            Done: 20
        };
        renderWIPChart(boardData, charts, 'light', 'en', translations);

        expect(Chart).toHaveBeenCalled();
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;

        expect(callArgs.data.labels).toEqual(['To Do', 'In Progress', 'Done']);
        expect(callArgs.data.datasets[0].data).toEqual([5, 10, 20]);
        // To Do (5) -> #f59e0b
        // In Progress (10) -> overloaded -> #ef4444
        // Done (20) -> excluded -> #f59e0b
        expect(callArgs.data.datasets[0].backgroundColor).toEqual(['#f59e0b', '#ef4444', '#f59e0b']);
    });
});
