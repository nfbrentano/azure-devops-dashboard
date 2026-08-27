import type { AlertRule, ComputedMetrics, AnomalyAlert } from './types.ts';

const ALERTS_STORAGE_KEY = 'az_dashboard_alert_rules';

export const DEFAULT_ALERT_RULES: AlertRule[] = [
    {
        id: 'rule_lead_time',
        name: 'Lead Time Médio Elevado',
        metric: 'lead_time_avg',
        operator: '>',
        threshold: 25,
        enabled: true
    },
    {
        id: 'rule_cycle_time',
        name: 'Cycle Time Médio Elevado',
        metric: 'cycle_time_avg',
        operator: '>',
        threshold: 15,
        enabled: true
    },
    {
        id: 'rule_wip_total',
        name: 'WIP Excessivo (Itens em Progresso)',
        metric: 'wip_total',
        operator: '>',
        threshold: 20,
        enabled: true
    },
    {
        id: 'rule_aging_max',
        name: 'Item Envelhecido sem Movimentação',
        metric: 'aging_max',
        operator: '>',
        threshold: 30,
        enabled: true
    }
];

export function getAlertRules(): AlertRule[] {
    try {
        const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // Fallback
    }
    return [...DEFAULT_ALERT_RULES];
}

export function saveAlertRules(rules: AlertRule[]): void {
    try {
        localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(rules));
    } catch (e) {
        console.warn('Failed to save alert rules to localStorage', e);
    }
}

export function evaluateAlertRules(metrics: ComputedMetrics, rules: AlertRule[] = getAlertRules()): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];

    // Calculate aggregate metrics
    const leadTimesNum = metrics.leadTimes.map(Number).filter((n) => !isNaN(n));
    const avgLeadTime = leadTimesNum.length > 0 ? leadTimesNum.reduce((a, b) => a + b, 0) / leadTimesNum.length : 0;

    const cycleTimesNum = metrics.cycleTimes.map(Number).filter((n) => !isNaN(n));
    const avgCycleTime = cycleTimesNum.length > 0 ? cycleTimesNum.reduce((a, b) => a + b, 0) / cycleTimesNum.length : 0;

    const totalWIP = metrics.kpis.inprogress;

    const maxAging = metrics.agingData.length > 0 ? Math.max(...metrics.agingData.map((d) => d.age)) : 0;

    const cfr = metrics.doraMetrics?.changeFailureRate?.value ?? 0;

    for (const rule of rules) {
        if (!rule.enabled) continue;

        let currentValue = 0;
        let unit = '';

        switch (rule.metric) {
            case 'lead_time_avg':
                currentValue = avgLeadTime;
                unit = 'dias';
                break;
            case 'cycle_time_avg':
                currentValue = avgCycleTime;
                unit = 'dias';
                break;
            case 'wip_total':
                currentValue = totalWIP;
                unit = 'itens';
                break;
            case 'aging_max':
                currentValue = maxAging;
                unit = 'dias';
                break;
            case 'cfr_pct':
                currentValue = cfr;
                unit = '%';
                break;
        }

        let violated = false;
        if (rule.operator === '>') violated = currentValue > rule.threshold;
        else if (rule.operator === '>=') violated = currentValue >= rule.threshold;
        else if (rule.operator === '<') violated = currentValue < rule.threshold;

        if (violated) {
            alerts.push({
                type: 'warning',
                title: `Alerta: ${rule.name}`,
                message: `Valor atual: ${currentValue.toFixed(1)} ${unit} (${rule.operator} limite de ${rule.threshold} ${unit})`,
                count: Math.round(currentValue)
            });
        }
    }

    return alerts;
}
