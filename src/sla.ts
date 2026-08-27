import type { WorkItemNode, WorkItemMetadata, SLAConfig, SLAResult } from './types.ts';

const SLA_STORAGE_KEY = 'az_dashboard_sla_config';

export const DEFAULT_SLA_CONFIG: SLAConfig = {
    bug: { targetDays: 5, metric: 'cycle' },
    task: { targetDays: 3, metric: 'cycle' },
    'user story': { targetDays: 14, metric: 'cycle' },
    'product backlog item': { targetDays: 14, metric: 'cycle' },
    feature: { targetDays: 30, metric: 'lead' },
    epic: { targetDays: 90, metric: 'lead' }
};

export function getSLAConfig(): SLAConfig {
    try {
        const stored = localStorage.getItem(SLA_STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_SLA_CONFIG, ...JSON.parse(stored) };
        }
    } catch {
        // Fallback to default
    }
    return { ...DEFAULT_SLA_CONFIG };
}

export function saveSLAConfig(config: SLAConfig): void {
    try {
        localStorage.setItem(SLA_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        console.warn('Failed to save SLA config to localStorage', e);
    }
}

export function calculateSLACompliance(
    items: WorkItemNode[],
    _metadata?: WorkItemMetadata,
    config: SLAConfig = getSLAConfig()
): SLAResult[] {
    const typeStats: Record<string, { total: number; met: number; breached: number; totalDays: number; targetDays: number }> = {};

    items.forEach((item) => {
        const f = item.fields;
        const rawType = (f['System.WorkItemType'] as string) || '';
        const typeKey = rawType.toLowerCase().trim();

        // Check if there is an SLA rule configured for this type
        const slaRule = config[typeKey] || config[rawType];
        if (!slaRule || slaRule.targetDays <= 0) return;

        const createdDate = f['System.CreatedDate'] ? new Date(f['System.CreatedDate'] as string) : null;
        const activatedDate = f['Microsoft.VSTS.Common.ActivatedDate']
            ? new Date(f['Microsoft.VSTS.Common.ActivatedDate'] as string)
            : createdDate;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        const closedDate = closedDateStr ? new Date(closedDateStr as string) : null;

        // Only evaluate completed items for historical SLA compliance
        if (!closedDate || isNaN(closedDate.getTime())) return;

        const baseStartDate = slaRule.metric === 'lead' ? (createdDate || activatedDate) : (activatedDate || createdDate);
        if (!baseStartDate || isNaN(baseStartDate.getTime())) return;

        const daysTaken = (closedDate.getTime() - baseStartDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysTaken < 0) return;

        if (!typeStats[rawType]) {
            typeStats[rawType] = {
                total: 0,
                met: 0,
                breached: 0,
                totalDays: 0,
                targetDays: slaRule.targetDays
            };
        }

        typeStats[rawType].total++;
        typeStats[rawType].totalDays += daysTaken;

        if (daysTaken <= slaRule.targetDays) {
            typeStats[rawType].met++;
        } else {
            typeStats[rawType].breached++;
        }
    });

    return Object.entries(typeStats).map(([workItemType, stats]) => {
        const compliancePct = stats.total > 0 ? (stats.met / stats.total) * 100 : 100;
        const avgDays = stats.total > 0 ? stats.totalDays / stats.total : 0;
        return {
            workItemType,
            total: stats.total,
            met: stats.met,
            breached: stats.breached,
            compliancePct: Number(compliancePct.toFixed(1)),
            avgDays: Number(avgDays.toFixed(1)),
            targetDays: stats.targetDays
        };
    });
}

export function isItemBreachingSLA(item: WorkItemNode, config: SLAConfig = getSLAConfig()): boolean {
    const f = item.fields;
    const rawType = (f['System.WorkItemType'] as string) || '';
    const typeKey = rawType.toLowerCase().trim();
    const slaRule = config[typeKey] || config[rawType];
    if (!slaRule || slaRule.targetDays <= 0) return false;

    const createdDate = f['System.CreatedDate'] ? new Date(f['System.CreatedDate'] as string) : null;
    const activatedDate = f['Microsoft.VSTS.Common.ActivatedDate']
        ? new Date(f['Microsoft.VSTS.Common.ActivatedDate'] as string)
        : createdDate;
    const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
    const closedDate = closedDateStr ? new Date(closedDateStr as string) : new Date();

    const baseStartDate = slaRule.metric === 'lead' ? (createdDate || activatedDate) : (activatedDate || createdDate);
    if (!baseStartDate || isNaN(baseStartDate.getTime())) return false;

    const daysTaken = (closedDate.getTime() - baseStartDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysTaken > slaRule.targetDays;
}
