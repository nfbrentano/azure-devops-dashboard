import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    calculateBottlenecks,
    computeMetrics,
    calculateAnomalies,
    renderAnomalies,
    renderSLAStats,
    renderAll,
    processAnalytics
} from './analytics.ts';
import { state } from './state.ts';
import type { WorkItemNode, WorkItemMetadata, ComputedMetrics, AnomalyAlert } from './types.ts';

vi.mock('./charts/index.ts', () => ({
    renderCharts: vi.fn(),
    renderAgingChart: vi.fn(),
    renderAssigneeChart: vi.fn(),
    renderWIPChart: vi.fn(),
    renderCFDChart: vi.fn(),
    renderBottlenecksChart: vi.fn(),
    renderThroughputChart: vi.fn(),
    renderMonteCarloChart: vi.fn(),
    renderScatterChart: vi.fn(),
    renderPortfolioFilters: vi.fn(),
    renderProgress: vi.fn(),
    renderLegends: vi.fn(),
    renderGlobalTypeFilters: vi.fn()
}));

describe('analytics.ts > calculateBottlenecks', () => {
    const mockMetadata = {
        states: {
            done: { category: 'Completed', color: '#10b981' },
            closed: { category: 'Completed', color: '#10b981' },
            resolved: { category: 'InProgress', color: '#0078d4' },
            active: { category: 'InProgress', color: '#0078d4' },
            new: { category: 'Proposed', color: '#b2b2b2' }
        }
    } as unknown as WorkItemMetadata;

    it('should return empty list if no items or revisions are passed', () => {
        const result = calculateBottlenecks([], {}, mockMetadata);
        expect(result).toEqual([]);
    });

    it('should compute average column times correctly based on revisions', () => {
        // Create dates
        const baseTime = new Date('2026-06-01T00:00:00Z');
        const day2 = new Date('2026-06-02T00:00:00Z');
        const day4 = new Date('2026-06-04T00:00:00Z');

        const items: WorkItemNode[] = [
            {
                id: 1,
                fields: {
                    'System.Id': 1,
                    'System.Title': 'Task 1',
                    'System.State': 'Closed',
                    'System.WorkItemType': 'Task'
                },
                children: []
            }
        ];

        const revisionsData = {
            1: [
                {
                    id: 1,
                    fields: {
                        'System.Id': 1,
                        'System.Title': 'Task 1',
                        'System.BoardColumn': 'To Do',
                        'System.State': 'New',
                        'System.WorkItemType': 'Task',
                        'System.ChangedDate': baseTime.toISOString()
                    }
                },
                {
                    id: 1,
                    fields: {
                        'System.Id': 1,
                        'System.Title': 'Task 1',
                        'System.BoardColumn': 'In Progress',
                        'System.State': 'Active',
                        'System.WorkItemType': 'Task',
                        'System.ChangedDate': day2.toISOString()
                    }
                },
                {
                    id: 1,
                    fields: {
                        'System.Id': 1,
                        'System.Title': 'Task 1',
                        'System.BoardColumn': 'Done',
                        'System.State': 'Closed',
                        'System.WorkItemType': 'Task',
                        'System.ChangedDate': day4.toISOString()
                    }
                }
            ]
        };

        const result = calculateBottlenecks(items, revisionsData, mockMetadata);

        // Duration in To Do is 1 day (day2 - baseTime)
        // Duration in In Progress is 2 days (day4 - day2)
        // Duration in Done is ignored since Done is 'Completed' and it is the last state
        expect(result).toHaveLength(2);

        const inProgress = result.find((r) => r.column === 'In Progress');
        const toDo = result.find((r) => r.column === 'To Do');

        expect(inProgress).toBeDefined();
        expect(inProgress?.avgDays).toBe(2);

        expect(toDo).toBeDefined();
        expect(toDo?.avgDays).toBe(1);
    });

    it('should calculate active time in the last state if item is not Done or Removed', () => {
        const baseTime = new Date();
        // Set last changed date to 2 days ago
        baseTime.setDate(baseTime.getDate() - 2);

        const items: WorkItemNode[] = [
            {
                id: 2,
                fields: {
                    'System.Id': 2,
                    'System.Title': 'Task 2',
                    'System.State': 'Active',
                    'System.WorkItemType': 'Task'
                },
                children: []
            }
        ];

        const revisionsData = {
            2: [
                {
                    id: 2,
                    fields: {
                        'System.Id': 2,
                        'System.Title': 'Task 2',
                        'System.BoardColumn': 'In Progress',
                        'System.State': 'Active',
                        'System.WorkItemType': 'Task',
                        'System.ChangedDate': baseTime.toISOString()
                    }
                }
            ]
        };

        const result = calculateBottlenecks(items, revisionsData, mockMetadata);
        expect(result).toHaveLength(1);
        expect(result[0].column).toBe('In Progress');
        // It should be around 2 days
        expect(result[0].avgDays).toBeGreaterThanOrEqual(1.9);
        expect(result[0].avgDays).toBeLessThanOrEqual(2.1);
    });
});

describe('analytics.ts > computeMetrics and calculateAnomalies', () => {
    const mockMetadata = {
        types: {
            'user story': { name: 'User Story', color: '#0078d4', iconData: null, states: {} },
            epic: { name: 'Epic', color: '#e11d48', iconData: null, states: {} }
        },
        states: {
            done: { name: 'Done', category: 'Completed', color: '#10b981' },
            active: { name: 'Active', category: 'InProgress', color: '#0078d4' },
            new: { name: 'New', category: 'Proposed', color: '#b2b2b2' }
        },
        backlogs: [
            { name: 'Epics', type: 'portfolio', workItemTypes: ['epic'] },
            { name: 'Requirement Backlog', type: 'requirement', workItemTypes: ['user story'] }
        ]
    } as unknown as WorkItemMetadata;

    it('should compute metrics and respect custom CFD period length', () => {
        const items: WorkItemNode[] = [
            {
                id: 10,
                fields: {
                    'System.Id': 10,
                    'System.Title': 'Story 10',
                    'System.State': 'Active',
                    'System.WorkItemType': 'User Story',
                    'System.CreatedDate': '2026-06-01T00:00:00Z',
                    'System.ChangedDate': '2026-06-10T00:00:00Z'
                },
                children: []
            }
        ];

        const metrics30 = computeMetrics(items, undefined, mockMetadata, 'en', 30);
        expect(metrics30.cfdSeries).toHaveLength(30);

        const metrics90 = computeMetrics(items, undefined, mockMetadata, 'en', 90);
        expect(metrics90.cfdSeries).toHaveLength(90);

        const metrics180 = computeMetrics(items, undefined, mockMetadata, 'en', 180);
        expect(metrics180.cfdSeries).toHaveLength(180);
    });

    it('should generate anomaly alerts for stale items and WIP overload', () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 20); // 20 days ago

        const items: WorkItemNode[] = Array.from({ length: 9 }, (_, i) => ({
            id: i + 1,
            fields: {
                'System.Id': i + 1,
                'System.Title': `Stale Task ${i + 1}`,
                'System.State': 'Active',
                'System.BoardColumn': 'Doing',
                'System.WorkItemType': 'User Story',
                'System.CreatedDate': oldDate.toISOString(),
                'System.ChangedDate': oldDate.toISOString()
            },
            children: []
        }));

        const metrics = computeMetrics(items, undefined, mockMetadata, 'en');
        expect(metrics.anomalies.length).toBeGreaterThan(0);

        const staleAlert = metrics.anomalies.find((a) => a.type === 'warning');
        expect(staleAlert).toBeDefined();

        const wipAlert = metrics.anomalies.find((a) => a.type === 'error');
        expect(wipAlert).toBeDefined();
    });
});

describe('analytics.ts > calculateAnomalies', () => {
    const translations = {
        'alert-lt-title': 'Lead Time Spike',
        'alert-lt-msg': 'Recent items are taking much longer',
        'alert-wip-title': 'WIP Limit Alert',
        'alert-wip-msg': 'Columns overloaded:',
        'alert-bottleneck-title': 'Main Bottleneck Detected',
        'alert-bottleneck-msg': 'Column',
        'alert-bottleneck-detail': 'takes on average',
        'label-days': 'days'
    };

    it('should generate bottleneck alert when top bottleneck avgDays >= 7', () => {
        const dummyMetrics = {
            agingData: [],
            leadTimes: [2, 2, 2, 2, 2],
            boardColumnWIP: {},
            bottleneckData: [{ column: 'Review', avgDays: 8.5 }]
        } as unknown as ComputedMetrics;

        const alerts = calculateAnomalies(dummyMetrics, 'en');
        const bottleneckAlert = alerts.find((a) => a.type === 'info');
        expect(bottleneckAlert).toBeDefined();
        expect(bottleneckAlert?.title).toBeDefined();
        expect(bottleneckAlert?.message).toContain('"Review"');
    });

    it('should generate stale items alert when agingData has items with age >= 14', () => {
        const dummyMetrics = {
            agingData: [{ id: 1, age: 16, title: 'Old item' }],
            leadTimes: [],
            boardColumnWIP: {},
            bottleneckData: []
        } as unknown as ComputedMetrics;

        const alerts = calculateAnomalies(dummyMetrics, 'en');
        const staleAlert = alerts.find((a) => a.type === 'warning');
        expect(staleAlert).toBeDefined();
        expect(staleAlert?.count).toBe(1);
    });

    it('should generate WIP alert when column items >= 8', () => {
        const dummyMetrics = {
            agingData: [],
            leadTimes: [],
            boardColumnWIP: { 'In Progress': 9, Done: 20 },
            bottleneckData: []
        } as unknown as ComputedMetrics;

        const alerts = calculateAnomalies(dummyMetrics, 'en');
        const wipAlert = alerts.find((a) => a.type === 'error');
        expect(wipAlert).toBeDefined();
        expect(wipAlert?.message).toContain('In Progress (9)');
    });
});

describe('analytics.ts > renderAnomalies', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="anomaly-alerts-container" class="hidden"></div>
        `;
    });

    it('should do nothing if container does not exist', () => {
        document.body.innerHTML = '';
        expect(() => renderAnomalies([])).not.toThrow();
    });

    it('should clear and hide container if anomalies array is empty', () => {
        const container = document.getElementById('anomaly-alerts-container')!;
        container.classList.remove('hidden');
        container.innerHTML = '<span>Old</span>';

        renderAnomalies([]);
        expect(container.innerHTML).toBe('');
        expect(container.classList.contains('hidden')).toBe(true);
    });

    it('should render alert cards with proper classes and icons', () => {
        const container = document.getElementById('anomaly-alerts-container')!;
        const anomalies: AnomalyAlert[] = [
            { type: 'error', title: 'WIP Overload', message: 'Col 1 has 10 items' },
            { type: 'warning', title: 'Stale Item', message: 'Task is 15d old' },
            { type: 'info', title: 'Bottleneck', message: 'Code review is slow' }
        ];

        renderAnomalies(anomalies);
        expect(container.classList.contains('hidden')).toBe(false);
        expect(container.querySelectorAll('.anomaly-alert-card')).toHaveLength(3);
        expect(container.querySelector('.alert-error')).not.toBeNull();
        expect(container.querySelector('.alert-warning')).not.toBeNull();
        expect(container.querySelector('.alert-info')).not.toBeNull();
    });
});

describe('analytics.ts > renderSLAStats', () => {
    const translations = {
        en: {
            'sla-target': 'Target',
            'sla-within-target': 'within SLA',
            'label-avg': 'Average'
        }
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="sla-stats-container"></div>
        `;
    });

    it('should do nothing if container does not exist', () => {
        document.body.innerHTML = '';
        expect(() => renderSLAStats([], 'en', translations)).not.toThrow();
    });

    it('should hide container when slaData is empty', () => {
        const container = document.getElementById('sla-stats-container')!;
        renderSLAStats([], 'en', translations);
        expect(container.style.display).toBe('none');
    });

    it('should render SLA cards with compliance classes', () => {
        const container = document.getElementById('sla-stats-container')!;
        const slaData = [
            { workItemType: 'Bug', compliancePct: 95, targetDays: 5, met: 19, total: 20, avgDays: 3 },
            { workItemType: 'User Story', compliancePct: 75, targetDays: 10, met: 15, total: 20, avgDays: 8 },
            { workItemType: 'Task', compliancePct: 50, targetDays: 2, met: 5, total: 10, avgDays: 4 }
        ];

        renderSLAStats(slaData as any, 'en', translations);

        expect(container.style.display).toBe('block');
        expect(container.querySelectorAll('.sla-card')).toHaveLength(3);
        expect(container.querySelector('.sla-good')).not.toBeNull();
        expect(container.querySelector('.sla-warn')).not.toBeNull();
        expect(container.querySelector('.sla-danger')).not.toBeNull();
    });
});

describe('analytics.ts > renderAll and processAnalytics', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="anomaly-alerts-container"></div>
            <div id="progress-list"></div>
            <div id="kpi-total"></div>
            <div id="kpi-total-pct"></div>
            <div id="kpi-backlog"></div>
            <div id="kpi-backlog-pct"></div>
            <div id="kpi-inprogress"></div>
            <div id="kpi-inprogress-pct"></div>
            <div id="kpi-done"></div>
            <div id="kpi-done-pct"></div>
            <div id="dora-metrics-container">
                <div id="dora-df"><span id="dora-df-val"></span><span id="dora-df-class"></span></div>
                <div id="dora-lt"><span id="dora-lt-val"></span><span id="dora-lt-class"></span></div>
                <div id="dora-cfr"><span id="dora-cfr-val"></span><span id="dora-cfr-class"></span></div>
                <div id="dora-mttr"><span id="dora-mttr-val"></span><span id="dora-mttr-class"></span></div>
            </div>
            <div id="sla-stats-container"></div>
        `;
        vi.clearAllMocks();
    });

    it('should update KPI counts, percentages and DORA metrics', () => {
        const mockMetrics: ComputedMetrics = {
            labels: ['Item 1'],
            leadTimes: [5],
            cycleTimes: [3],
            kpis: { total: 10, backlog: 3, inprogress: 4, doneRemoved: 3 },
            agingData: [],
            assigneeWorkload: {},
            boardColumnWIP: {},
            cfdSeries: [],
            scatterData: [],
            anomalies: [],
            slaData: [],
            doraMetrics: {
                deploymentFrequency: { value: 1.5, class: 'Elite', raw: 10 },
                leadTimeForChanges: { value: 2, class: 'High', raw: 2 },
                changeFailureRate: { value: 5, class: 'Medium', raw: 0.05 },
                timeToRestore: { value: 4, class: 'Low', raw: 4 }
            },
            throughputData: [{ label: 'W1', count: 5, range: 'Jan' }],
            bottleneckData: [{ column: 'Active', avgDays: 4 }]
        };

        const callGantt = vi.fn();
        renderAll(mockMetrics, [], { callRenderGantt: callGantt });

        expect(document.getElementById('kpi-total')?.textContent).toBe('10');
        expect(document.getElementById('kpi-total-pct')?.textContent).toBe('100%');
        expect(document.getElementById('kpi-backlog')?.textContent).toBe('3');
        expect(document.getElementById('kpi-backlog-pct')?.textContent).toBe('30%');
        expect(document.getElementById('kpi-inprogress')?.textContent).toBe('4');
        expect(document.getElementById('kpi-inprogress-pct')?.textContent).toBe('40%');
        expect(document.getElementById('kpi-done')?.textContent).toBe('3');
        expect(document.getElementById('kpi-done-pct')?.textContent).toBe('30%');

        expect(document.getElementById('dora-df-val')?.textContent).toBe('1.5');
        expect(document.getElementById('dora-df-class')?.textContent).toBe('Elite');
        expect(document.getElementById('dora-df')?.classList.contains('dora-elite')).toBe(true);
        expect(callGantt).toHaveBeenCalled();
    });

    it('should hide DORA container when doraMetrics is undefined', () => {
        const mockMetrics = {
            labels: [],
            leadTimes: [],
            cycleTimes: [],
            kpis: { total: 0, backlog: 0, inprogress: 0, doneRemoved: 0 },
            agingData: [],
            assigneeWorkload: {},
            boardColumnWIP: {},
            cfdSeries: [],
            scatterData: [],
            anomalies: [],
            slaData: []
        } as unknown as ComputedMetrics;

        renderAll(mockMetrics, [], {});
        expect(document.getElementById('dora-metrics-container')?.style.display).toBe('none');
    });

    it('should initialize globalActiveTypes and process analytics', () => {
        state.globalActiveTypes = null;
        const items: WorkItemNode[] = [
            { id: 1, fields: { 'System.WorkItemType': 'Task', 'System.State': 'Active' }, children: [] },
            { id: 2, fields: { 'System.WorkItemType': 'Bug', 'System.State': 'Active' }, children: [] }
        ];

        processAnalytics(items, items, {});

        expect(state.globalActiveTypes).toEqual(['Bug', 'Task']);
        expect(localStorage.getItem('global_active_types')).toContain('Bug');
    });
});
