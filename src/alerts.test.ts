import { describe, it, expect } from 'vitest';
import { evaluateAlertRules, DEFAULT_ALERT_RULES } from './alerts.ts';
import type { ComputedMetrics, AlertRule } from './types.ts';

describe('alerts.ts', () => {
    const mockMetrics: ComputedMetrics = {
        filteredItems: [],
        leadTimes: ['30.0', '40.0'], // Avg: 35.0
        cycleTimes: ['20.0', '25.0'], // Avg: 22.5
        labels: [],
        agingData: [{ id: 1, title: 'Old item', age: 45, state: 'In Progress' }],
        assigneeWorkload: {},
        boardColumnWIP: {},
        kpis: {
            total: 10,
            backlog: 2,
            inprogress: 30, // Total WIP: 30
            doneRemoved: 0
        },
        cfdSeries: [],
        heatmapData: {},
        throughputData: [],
        bottleneckData: [],
        anomalies: [],
        doraMetrics: {
            deploymentFrequency: { value: 2, class: 'High', raw: 2 },
            leadTimeForChanges: { value: 35, class: 'Medium', raw: 35 },
            changeFailureRate: { value: 25, class: 'High', raw: 25 },
            timeToRestore: { value: 5, class: 'High', raw: 5 }
        }
    };

    it('should detect violations when metrics exceed default thresholds', () => {
        const alerts = evaluateAlertRules(mockMetrics, DEFAULT_ALERT_RULES);
        expect(alerts.length).toBeGreaterThan(0);
        const titles = alerts.map((a) => a.title);
        expect(titles.some((t) => t.includes('Lead Time'))).toBe(true);
        expect(titles.some((t) => t.includes('Cycle Time'))).toBe(true);
        expect(titles.some((t) => t.includes('WIP'))).toBe(true);
        expect(titles.some((t) => t.includes('Envelhecido'))).toBe(true);
    });

    it('should not trigger alerts when metrics are within limits', () => {
        const safeMetrics: ComputedMetrics = {
            ...mockMetrics,
            leadTimes: ['5.0'],
            cycleTimes: ['3.0'],
            agingData: [{ id: 2, title: 'Fresh item', age: 2, state: 'In Progress' }],
            kpis: {
                total: 5,
                backlog: 2,
                inprogress: 3,
                doneRemoved: 0
            }
        };

        const alerts = evaluateAlertRules(safeMetrics, DEFAULT_ALERT_RULES);
        expect(alerts.length).toBe(0);
    });

    it('should ignore disabled alert rules', () => {
        const disabledRules: AlertRule[] = DEFAULT_ALERT_RULES.map((r) => ({ ...r, enabled: false }));
        const alerts = evaluateAlertRules(mockMetrics, disabledRules);
        expect(alerts.length).toBe(0);
    });
});
