import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderAgingChart } from './aging-chart.ts';
import Chart from 'chart.js/auto';

vi.mock('chart.js/auto', () => {
    const ChartMock = vi.fn(function () {
        return { destroy: vi.fn(), update: vi.fn() };
    });
    (ChartMock as any).defaults = { font: {}, elements: { line: {}, point: {} }, plugins: { tooltip: {} } };
    return { default: ChartMock };
});

describe('aging-chart.ts', () => {
    let container: HTMLElement;
    const translations = {
        en: {
            'msg-aging-empty': 'No aging data',
            'label-days-inactive': 'Days Inactive',
            'label-days-since-update': 'Days Since Update'
        }
    };
    const azureConfig = { org: 'org', project: 'proj', pat: 'pat' };

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <canvas id="agingChart"></canvas>
            </div>
        `;
        container = document.body.firstElementChild as HTMLElement;
        vi.clearAllMocks();
    });

    it('should display empty message when data is empty', () => {
        renderAgingChart([], {} as any, 'light', 'en', translations, azureConfig);
        expect(container.innerHTML).toContain('No aging data');
    });

    it('should display empty message when data is null/undefined', () => {
        renderAgingChart(null as any, {} as any, 'light', 'en', translations, azureConfig);
        expect(container.innerHTML).toContain('No aging data');
    });

    it('should recreate canvas if empty message is present and data exists', () => {
        container.innerHTML = `<div id="aging-empty-msg">empty</div>`;
        const charts: any = {};
        renderAgingChart([{ id: 1, title: 'Test', age: 5 }], charts, 'light', 'en', translations, azureConfig);
        expect(container.querySelector('canvas')).not.toBeNull();
        expect(charts.aging).toBeDefined();
    });

    it('should destroy existing chart instance', () => {
        const destroyMock = vi.fn();
        const charts: any = { aging: { destroy: destroyMock } };
        renderAgingChart([{ id: 1, title: 'Test', age: 5 }], charts, 'light', 'en', translations, azureConfig);
        expect(destroyMock).toHaveBeenCalled();
    });

    it('should render chart and map data correctly, sorting by age', () => {
        const charts: any = {};
        const data = [
            { id: 1, title: 'Item 1', age: 5 },
            { id: 2, title: 'Item 2', age: 10 },
            { id: 3, title: 'Item 3', age: 2 }
        ];
        renderAgingChart(data, charts, 'light', 'en', translations, azureConfig);

        expect(Chart).toHaveBeenCalled();
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;

        // Should be sorted descending by age: Item 2 (10), Item 1 (5), Item 3 (2)
        expect(callArgs.data.datasets[0].data).toEqual([10, 5, 2]);
        expect(callArgs.data.labels[0]).toContain('ID 2');
        expect(callArgs.data.labels[1]).toContain('ID 1');
        expect(callArgs.data.labels[2]).toContain('ID 3');
    });

    it('should truncate long titles in labels', () => {
        const charts: any = {};
        const data = [
            { id: 1, title: 'This is a very long title that should exceed thirty characters in length', age: 5 }
        ];
        renderAgingChart(data, charts, 'light', 'en', translations, azureConfig);
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        expect(callArgs.data.labels[0]).toContain('...');
    });

    it('should handle tooltip callbacks', () => {
        const charts: any = {};
        const data = [{ id: 1, title: 'Item 1', age: 5, state: 'Active', assignee: 'John', updated: '2023-01-01' }];
        renderAgingChart(data, charts, 'light', 'en', translations, azureConfig);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const labelCallback = callArgs.options.plugins.tooltip.callbacks.label;
        const result = labelCallback({ dataIndex: 0 });

        expect(result).toContain('Days Inactive: 5');
        expect(result).toContain('Active');
        expect(result).toContain('Resp: John');
        expect(result).toContain('Upd: 2023-01-01');
    });

    it('should handle onClick to open work item', () => {
        const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        const charts: any = {};
        const data = [{ id: 101, title: 'Item 1', age: 5 }];
        renderAgingChart(data, charts, 'light', 'en', translations, azureConfig);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const onClick = callArgs.options.onClick;

        // Mock elements array with an index
        onClick({}, [{ index: 0 }]);

        expect(windowOpenSpy).toHaveBeenCalledWith('https://dev.azure.com/org/proj/_workitems/edit/101', '_blank');
        windowOpenSpy.mockRestore();
    });

    it('should execute thresholdLine plugin safely', () => {
        const charts: any = {};
        const data = [{ id: 101, title: 'Item 1', age: 5 }];
        renderAgingChart(data, charts, 'light', 'en', translations, azureConfig);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const plugin = callArgs.plugins[0];

        const mockChart = {
            ctx: {
                save: vi.fn(),
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                stroke: vi.fn(),
                setLineDash: vi.fn(),
                fillText: vi.fn(),
                restore: vi.fn()
            },
            scales: {
                x: {
                    getPixelForValue: vi.fn().mockReturnValue(100),
                    left: 0,
                    right: 200
                },
                y: {
                    top: 10,
                    bottom: 100
                }
            }
        };

        expect(() => plugin.afterDraw(mockChart)).not.toThrow();
        expect(mockChart.ctx.save).toHaveBeenCalled();
    });
});
