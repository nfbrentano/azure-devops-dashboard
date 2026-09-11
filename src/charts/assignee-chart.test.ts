import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderAssigneeChart } from './assignee-chart.ts';
import Chart from 'chart.js/auto';

vi.mock('chart.js/auto', () => {
    const ChartMock = vi.fn(function () {
        return { destroy: vi.fn(), update: vi.fn() };
    });
    (ChartMock as any).defaults = { font: {}, elements: { line: {}, point: {} }, plugins: { tooltip: {} } };
    return { default: ChartMock };
});

describe('assignee-chart.ts', () => {
    let container: HTMLElement;
    const translations = {
        en: {
            'msg-assignee-empty': 'No assignee data',
            'label-number-of-items': 'Number of items'
        }
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <canvas id="assigneeChart"></canvas>
            </div>
        `;
        container = document.body.firstElementChild as HTMLElement;
        vi.clearAllMocks();
    });

    it('should display empty message when data is empty', () => {
        renderAssigneeChart({}, {} as any, 'light', 'en', translations);
        expect(container.innerHTML).toContain('No assignee data');
    });

    it('should recreate canvas if empty message is present and data exists', () => {
        container.innerHTML = `<div id="assignee-empty-msg">empty</div>`;
        const charts: any = {};
        renderAssigneeChart({ John: { Done: 1 } }, charts, 'light', 'en', translations);
        expect(container.querySelector('canvas')).not.toBeNull();
        expect(charts.assignee).toBeDefined();
    });

    it('should destroy existing chart instance', () => {
        const destroyMock = vi.fn();
        const charts: any = { assignee: { destroy: destroyMock } };
        renderAssigneeChart({ John: { Done: 1 } }, charts, 'light', 'en', translations);
        expect(destroyMock).toHaveBeenCalled();
    });

    it('should render chart and map data correctly, sorting by totals', () => {
        const charts: any = {};
        const data = {
            Alice: { Done: 1, 'In Progress': 2 }, // Total: 3
            Bob: { Done: 5 }, // Total: 5
            Charlie: { Backlog: 1 } // Total: 1
        };
        renderAssigneeChart(data, charts, 'light', 'en', translations);

        expect(Chart).toHaveBeenCalled();
        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;

        // Should be sorted descending by total: Bob (5), Alice (3), Charlie (1)
        expect(callArgs.data.labels).toEqual(['Bob', 'Alice', 'Charlie']);

        // We should have 3 datasets: 'Done', 'In Progress', 'Backlog'
        // Let's find each dataset to verify
        const dsDone = callArgs.data.datasets.find((d: any) => d.label === 'Done');
        expect(dsDone.data).toEqual([5, 1, 0]); // Bob: 5, Alice: 1, Charlie: 0

        const dsInProgress = callArgs.data.datasets.find((d: any) => d.label === 'In Progress');
        expect(dsInProgress.data).toEqual([0, 2, 0]);

        const dsBacklog = callArgs.data.datasets.find((d: any) => d.label === 'Backlog');
        expect(dsBacklog.data).toEqual([0, 0, 1]);
    });

    it('should handle fallback color for unknown statuses', () => {
        const charts: any = {};
        const data = { Alice: { UnknownStatus: 1 } };
        renderAssigneeChart(data, charts, 'light', 'en', translations);

        const callArgs = vi.mocked(Chart).mock.calls[0][1] as any;
        const ds = callArgs.data.datasets[0];

        expect(ds.backgroundColor).toBe('#8b5cf6'); // fallback color
    });
});
