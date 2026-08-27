/**
 * Analytics and Data Processing for Azure DevOps Dashboard
 */
import { state } from './state.ts';
import type {
    WorkItemNode,
    WorkItemMetadata,
    ComputedMetrics,
    AgingItem,
    CFDDataPoint,
    ThroughputDataPoint,
    BottleneckResult,
    AnomalyAlert,
    ChartInstances,
    AzureConfig,
    WorkItem
} from './types.ts';
import { translations } from './translations.ts';
import { getItemIcon, getStatusInfo, isRequirementType } from './utils.ts';
import { logger } from './logger.ts';
import { calculateDORAMetrics } from './dora.ts';
import { runMonteCarloSimulation } from './forecast.ts';
import { calculateSLACompliance } from './sla.ts';
import { evaluateAlertRules } from './alerts.ts';
import {
    renderCharts,
    renderAgingChart,
    renderAssigneeChart,
    renderWIPChart,
    renderCFDChart,
    renderBottlenecksChart,
    renderThroughputChart,
    renderMonteCarloChart,
    renderScatterChart,
    renderPortfolioFilters,
    renderProgress,
    renderLegends,
    renderGlobalTypeFilters
} from './charts/index.ts';

export type { ComputedMetrics };

export interface ProcessAnalyticsOptions {
    currentTheme?: 'dark' | 'light';
    currentLanguage?: string;
    workItemMetadata?: WorkItemMetadata;
    charts?: ChartInstances;
    azureConfig?: AzureConfig | null;
    progressList?: HTMLElement | null;
    revisionsData?: Record<number, WorkItem[]>;
    cfdPeriod?: number;
    callRenderGantt?: () => void;
}

export function computeMetrics(
    filteredItems: WorkItemNode[],
    revisionsData: Record<number, WorkItem[]> | undefined,
    workItemMetadata: WorkItemMetadata,
    currentLanguage: string,
    cfdDays = 180
): ComputedMetrics {
    const leadTimes: string[] = [];
    const cycleTimes: (string | number)[] = [];
    const labels: string[] = [];
    const agingData: AgingItem[] = [];
    const assigneeWorkload: Record<string, Record<string, number>> = {};
    const boardColumnWIP: Record<string, number> = {};
    const kpis = { total: filteredItems.length, backlog: 0, inprogress: 0, doneRemoved: 0 };
    const now = new Date();

    filteredItems.forEach((item) => {
        const f = item.fields;
        const createdDate = new Date(f['System.CreatedDate'] as string);
        const activatedDate = f['Microsoft.VSTS.Common.ActivatedDate']
            ? new Date(f['Microsoft.VSTS.Common.ActivatedDate'] as string)
            : null;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        const closedDate = closedDateStr ? new Date(closedDateStr as string) : null;
        const stateName = f['System.State'] as string;
        const changedDate = new Date(f['System.ChangedDate'] as string);

        const statusInfo = getStatusInfo(stateName, workItemMetadata);
        if (statusInfo.label === 'Backlog') kpis.backlog++;
        else if (statusInfo.label === 'In Progress') kpis.inprogress++;
        else if (statusInfo.label === 'Done' || statusInfo.label === 'Removed') kpis.doneRemoved++;

        if (closedDate && !isNaN(closedDate.getTime())) {
            leadTimes.push(((closedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1));
            cycleTimes.push(
                activatedDate ? ((closedDate.getTime() - activatedDate.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1) : 0
            );
            labels.push(`ID ${item.id}`);
        }

        const type = (f['System.WorkItemType'] as string)?.toLowerCase();
        const iconInfo = getItemIcon(type, workItemMetadata);

        if (statusInfo.label === 'In Progress' && !iconInfo.isPortfolio && !isNaN(changedDate.getTime())) {
            const assignee = f['System.AssignedTo'] as { displayName?: string; uniqueName?: string } | string | undefined;
            const name = (typeof assignee === 'object' && assignee !== null ? assignee.displayName || assignee.uniqueName : typeof assignee === 'string' ? assignee : null) || translations[currentLanguage]['label-unassigned'] || 'Unassigned';
            
            agingData.push({
                id: item.id,
                title: (f['System.Title'] as string) || translations[currentLanguage]['label-no-title'] || 'No title',
                age: Math.max(0, Math.floor((now.getTime() - changedDate.getTime()) / (1000 * 60 * 60 * 24))),
                state: stateName,
                assignee: name,
                updated: changedDate.toLocaleDateString(currentLanguage, { day: '2-digit', month: '2-digit', year: 'numeric' })
            });
        }

        if (!iconInfo.isPortfolio) {
            const assignee = f['System.AssignedTo'] as { displayName?: string; uniqueName?: string } | string | undefined;
            const name =
                (typeof assignee === 'object' && assignee !== null
                    ? assignee.displayName || assignee.uniqueName
                    : typeof assignee === 'string'
                      ? assignee
                      : null) || translations[currentLanguage]['label-unassigned'] || 'Unassigned';
            if (!assigneeWorkload[name]) assigneeWorkload[name] = {};
            assigneeWorkload[name][statusInfo.label] = (assigneeWorkload[name][statusInfo.label] || 0) + 1;

            const boardColumn = (f['System.BoardColumn'] as string) || (f['System.State'] as string);
            boardColumnWIP[boardColumn] = (boardColumnWIP[boardColumn] || 0) + 1;
        }
    });

    // Pré-computa os dados relevantes dos itens para o CFD para evitar instanciar datas e rodar checks redundantes no loop
    const cfdItems = filteredItems
        .filter((item) => !getItemIcon(item.fields['System.WorkItemType'] as string, workItemMetadata).isPortfolio)
        .map((item) => {
            const f = item.fields;
            const createdVal = f['System.CreatedDate'];
            const activatedVal = f['Microsoft.VSTS.Common.ActivatedDate'];
            const closedVal = f['Microsoft.VSTS.Common.ClosedDate'];

            return {
                createdTime: typeof createdVal === 'string' ? new Date(createdVal).getTime() : 0,
                activatedTime: typeof activatedVal === 'string' ? new Date(activatedVal).getTime() : null,
                closedTime: typeof closedVal === 'string' ? new Date(closedVal).getTime() : null
            };
        });

    const cfdSeries: CFDDataPoint[] = [];
    const validCfdDays = Math.max(7, Math.min(365, cfdDays || 180));
    for (let i = validCfdDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const t = d.getTime();
        const counts: CFDDataPoint = { date: d, Proposed: 0, InProgress: 0, Done: 0 };

        cfdItems.forEach((item) => {
            if (item.createdTime <= t) {
                if (item.closedTime !== null && item.closedTime <= t) counts.Done++;
                else if (item.activatedTime !== null && item.activatedTime <= t) counts.InProgress++;
                else counts.Proposed++;
            }
        });
        cfdSeries.push(counts);
    }

    const heatmapData: Record<string, number> = {};
    filteredItems.forEach((item) => {
        const f = item.fields;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        if (closedDateStr) {
            const dateStr = new Date(closedDateStr as string).toISOString().split('T')[0];
            heatmapData[dateStr] = (heatmapData[dateStr] || 0) + 1;
        }
    });

    const throughputData: ThroughputDataPoint[] = [];

    let earliestClosedDate: Date | null = null;
    for (const item of filteredItems) {
        const f = item.fields;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        if (!closedDateStr) continue;
        const type = (item.fields['System.WorkItemType'] as string)?.toLowerCase();
        if (!isRequirementType(type, workItemMetadata)) continue;

        const closed = new Date(closedDateStr as string);
        if (!earliestClosedDate || closed < earliestClosedDate) earliestClosedDate = closed;
    }

    if (earliestClosedDate) {
        const firstWeekStart = new Date(earliestClosedDate);
        firstWeekStart.setDate(earliestClosedDate.getDate() - earliestClosedDate.getDay());
        firstWeekStart.setHours(0, 0, 0, 0);

        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay());
        currentWeekStart.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((currentWeekStart.getTime() - firstWeekStart.getTime()) / (1000 * 60 * 60 * 24));
        const numWeeks = Math.max(1, Math.floor(diffDays / 7) + 1);

        for (let i = 0; i < numWeeks; i++) {
            const startOfWeek = new Date(firstWeekStart);
            startOfWeek.setDate(firstWeekStart.getDate() + i * 7);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);

            let count = 0;
            filteredItems.forEach((item) => {
                const f = item.fields;
                const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
                if (!closedDateStr) return;
                const type = (item.fields['System.WorkItemType'] as string)?.toLowerCase();
                if (!isRequirementType(type, workItemMetadata)) return;

                const closed = new Date(closedDateStr as string);
                if (closed >= startOfWeek && closed <= endOfWeek) count++;
            });

            throughputData.push({
                label: `${translations[currentLanguage]['label-week-short'] || 'W'}${i + 1}`,
                range: `${startOfWeek.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' })}`,
                count: count
            });
        }
    }

    // Scatter plot data for cycle time of closed items
    const scatterPoints = filteredItems
        .filter((item) => {
            const f = item.fields;
            const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
            return !!closedDateStr;
        })
        .map((item) => {
            const f = item.fields;
            const createdDate = new Date(f['System.CreatedDate'] as string);
            const activatedDate = f['Microsoft.VSTS.Common.ActivatedDate']
                ? new Date(f['Microsoft.VSTS.Common.ActivatedDate'] as string)
                : createdDate;
            const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
            const closedDate = new Date(closedDateStr as string);
            const cycleDays = Math.max(0, (closedDate.getTime() - activatedDate.getTime()) / (1000 * 60 * 60 * 24));

            return {
                x: closedDate.toISOString().split('T')[0],
                y: Number(cycleDays.toFixed(1)),
                id: item.id,
                title: (f['System.Title'] as string) || `Item #${item.id}`,
                type: (f['System.WorkItemType'] as string) || '',
                state: (f['System.State'] as string) || ''
            };
        });

    const sortedCycleValues = scatterPoints.map((p) => p.y).sort((a, b) => a - b);
    const getPercentile = (p: number) => {
        if (sortedCycleValues.length === 0) return 0;
        const idx = Math.floor(sortedCycleValues.length * p);
        return sortedCycleValues[Math.min(idx, sortedCycleValues.length - 1)];
    };

    const scatterData = {
        points: scatterPoints,
        p50: getPercentile(0.50),
        p85: getPercentile(0.85),
        p95: getPercentile(0.95)
    };

    // SLA tracking calculation
    const slaData = calculateSLACompliance(filteredItems, workItemMetadata);

    const doraMetrics = calculateDORAMetrics(filteredItems, workItemMetadata);

    // Bottlenecks
    let bottleneckData: BottleneckResult[] | null = null;
    if (revisionsData) {
        bottleneckData = calculateBottlenecks(filteredItems, revisionsData, workItemMetadata);
    }

    // Initial anomalies
    const baseMetricsPartial = {
        filteredItems,
        leadTimes,
        cycleTimes,
        labels,
        agingData,
        assigneeWorkload,
        boardColumnWIP,
        kpis,
        cfdSeries,
        heatmapData,
        throughputData,
        bottleneckData,
        doraMetrics,
        scatterData,
        slaData
    };

    const builtInAnomalies = calculateAnomalies(baseMetricsPartial, currentLanguage);
    const customAlerts = evaluateAlertRules({ ...baseMetricsPartial, anomalies: builtInAnomalies });
    const anomalies = [...builtInAnomalies, ...customAlerts];

    // For monte carlo, let's forecast the remaining In Progress and Backlog items (for requirements)
    const remainingReqs = filteredItems.filter((item) => {
        const type = (item.fields['System.WorkItemType'] as string)?.toLowerCase();
        if (!isRequirementType(type, workItemMetadata)) return false;
        const stateInfo = getStatusInfo(item.fields['System.State'] as string, workItemMetadata);
        return stateInfo.label === 'Backlog' || stateInfo.label === 'In Progress';
    }).length;

    const forecastData = runMonteCarloSimulation(throughputData, remainingReqs);

    return {
        filteredItems,
        leadTimes,
        cycleTimes,
        labels,
        agingData,
        assigneeWorkload,
        boardColumnWIP,
        kpis,
        cfdSeries,
        heatmapData,
        throughputData,
        bottleneckData,
        anomalies,
        doraMetrics,
        forecastData,
        scatterData,
        slaData
    };
}

export function calculateAnomalies(metrics: Omit<ComputedMetrics, 'anomalies'>, currentLanguage: string): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];
    const t = translations[currentLanguage] || translations['en'];

    // 1. Stuck / Stale In-Progress items (> 14 days)
    const staleItems = metrics.agingData.filter((i) => i.age >= 14);
    if (staleItems.length > 0) {
        alerts.push({
            type: 'warning',
            title: t['alert-stale-title'] || 'Itens Estagnados em Progresso',
            message: `${staleItems.length} ${t['alert-stale-msg'] || 'itens em In Progress estão há mais de 14 dias sem atualização.'}`,
            count: staleItems.length
        });
    }

    // 2. WIP Overload in specific columns (> 8 items)
    const overloadedColumns = Object.entries(metrics.boardColumnWIP).filter(([col, count]) => {
        const lower = col.toLowerCase();
        return count >= 8 && !['done', 'closed', 'removed', 'backlog', 'new'].includes(lower);
    });
    if (overloadedColumns.length > 0) {
        const colNames = overloadedColumns.map(([c, n]) => `${c} (${n})`).join(', ');
        alerts.push({
            type: 'error',
            title: t['alert-wip-title'] || 'Alerta de Limite de WIP',
            message: `${t['alert-wip-msg'] || 'Colunas com sobrecarga de itens:'} ${colNames}`
        });
    }

    // 3. Bottleneck Columns (> 7 days average)
    if (metrics.bottleneckData && metrics.bottleneckData.length > 0) {
        const topBottleneck = metrics.bottleneckData[0];
        if (topBottleneck.avgDays >= 7) {
            alerts.push({
                type: 'info',
                title: t['alert-bottleneck-title'] || 'Principal Gargalo Detectado',
                message: `${t['alert-bottleneck-msg'] || 'A coluna'} "${topBottleneck.column}" ${t['alert-bottleneck-detail'] || 'leva em média'} ${topBottleneck.avgDays.toFixed(1)} ${t['label-days'] || 'dias'}.`
            });
        }
    }

    return alerts;
}

export function renderAnomalies(anomalies: AnomalyAlert[]) {
    const container = document.getElementById('anomaly-alerts-container');
    if (!container) return;

    if (anomalies.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = anomalies
        .map((a) => {
            const icon =
                a.type === 'error'
                    ? 'ph-fill ph-warning-circle'
                    : a.type === 'warning'
                      ? 'ph-fill ph-warning'
                      : 'ph-fill ph-info';
            const colorClass = `alert-${a.type}`;
            return `
            <div class="anomaly-alert-card ${colorClass}">
                <i class="${icon}"></i>
                <div class="anomaly-alert-body">
                    <strong>${a.title}</strong>
                    <span>${a.message}</span>
                </div>
            </div>
        `;
        })
        .join('');
}

export function renderAll(metrics: ComputedMetrics, originalItems: WorkItemNode[], options: ProcessAnalyticsOptions) {
    const currentTheme = options.currentTheme || state.currentTheme;
    const currentLanguage = options.currentLanguage || state.currentLanguage;
    const workItemMetadata = options.workItemMetadata || state.workItemMetadata;
    const charts = options.charts || state.charts;
    const azureConfig = options.azureConfig || state.azureConfig;
    const progressList = options.progressList || document.getElementById('progress-list');
    const callRenderGantt = options.callRenderGantt;

    // Render anomalies
    renderAnomalies(metrics.anomalies);

    // Rendering via charts.js
    renderCharts(metrics.labels, metrics.leadTimes, metrics.cycleTimes, charts, currentTheme, currentLanguage, translations, azureConfig);
    renderAgingChart(metrics.agingData, charts, currentTheme, currentLanguage, translations, azureConfig);
    renderAssigneeChart(metrics.assigneeWorkload, charts, currentTheme, currentLanguage, translations);
    renderWIPChart(metrics.boardColumnWIP, charts, currentTheme, currentLanguage, translations);
    renderCFDChart(metrics.cfdSeries, charts, currentTheme, currentLanguage, translations);
    if (metrics.throughputData && metrics.throughputData.length > 0) {
        renderThroughputChart(metrics.throughputData, charts, currentTheme, currentLanguage, translations);
    }

    // Bottleneck Analysis
    if (metrics.bottleneckData) {
        renderBottlenecksChart(metrics.bottleneckData, charts, currentTheme, currentLanguage, translations);
    }

    renderPortfolioFilters(originalItems, workItemMetadata, translations, currentLanguage, () =>
        renderProgress(originalItems, progressList, translations, currentLanguage, workItemMetadata, azureConfig)
    );
    renderProgress(originalItems, progressList, translations, currentLanguage, workItemMetadata, azureConfig);

    renderLegends(originalItems, workItemMetadata, translations, currentLanguage);
    if (callRenderGantt) callRenderGantt();

    // Update KPIs (counts + percentages)
    const pct = (val: number) => (metrics.kpis.total > 0 ? Math.round((val / metrics.kpis.total) * 100) : 0);

    const updateTextContent = (id: string, text: string | number) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(text);
    };

    updateTextContent('kpi-total', metrics.kpis.total);
    updateTextContent('kpi-total-pct', '100%');
    updateTextContent('kpi-backlog', metrics.kpis.backlog);
    updateTextContent('kpi-backlog-pct', `${pct(metrics.kpis.backlog)}%`);
    updateTextContent('kpi-inprogress', metrics.kpis.inprogress);
    updateTextContent('kpi-inprogress-pct', `${pct(metrics.kpis.inprogress)}%`);
    updateTextContent('kpi-done', metrics.kpis.doneRemoved);
    updateTextContent('kpi-done-pct', `${pct(metrics.kpis.doneRemoved)}%`);

    // DORA Metrics
    if (metrics.doraMetrics) {
        const doraContainer = document.getElementById('dora-metrics-container');
        if (doraContainer) doraContainer.style.display = 'grid';
        
        const updateDoraCard = (id: string, metric: { value: number, class: string, raw: number }) => {
            const valEl = document.getElementById(`${id}-val`);
            const classEl = document.getElementById(`${id}-class`);
            const cardEl = document.getElementById(id);
            if (valEl) valEl.textContent = String(metric.value);
            if (classEl) {
                classEl.textContent = metric.class;
                cardEl?.classList.remove('dora-elite', 'dora-high', 'dora-medium', 'dora-low');
                cardEl?.classList.add(`dora-${metric.class.toLowerCase()}`);
            }
        };

        updateDoraCard('dora-df', metrics.doraMetrics.deploymentFrequency);
        updateDoraCard('dora-lt', metrics.doraMetrics.leadTimeForChanges);
        updateDoraCard('dora-cfr', metrics.doraMetrics.changeFailureRate);
        updateDoraCard('dora-mttr', metrics.doraMetrics.timeToRestore);
    } else {
        const doraContainer = document.getElementById('dora-metrics-container');
        if (doraContainer) doraContainer.style.display = 'none';
    }

    // Monte Carlo
    renderMonteCarloChart(metrics.forecastData || null, charts, currentTheme, currentLanguage, translations);

    // Cycle Time Scatter Plot
    renderScatterChart(metrics.scatterData, charts, currentTheme, currentLanguage, translations, azureConfig);

    // SLA Tracking Overview
    renderSLAStats(metrics.slaData, currentLanguage, translations);
}

export function renderSLAStats(
    slaData: ComputedMetrics['slaData'],
    currentLanguage: string,
    translations: Record<string, Record<string, string>>
) {
    const container = document.getElementById('sla-stats-container');
    if (!container) return;

    if (!slaData || slaData.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const t = translations[currentLanguage] || translations['en'];

    container.innerHTML = `
        <div class="sla-overview-grid">
            ${slaData
                .map((s) => {
                    const statusClass =
                        s.compliancePct >= 90 ? 'sla-good' : s.compliancePct >= 70 ? 'sla-warn' : 'sla-danger';
                    return `
                <div class="sla-card ${statusClass}">
                    <div class="sla-card-header">
                        <span class="sla-type-title">${s.workItemType}</span>
                        <span class="sla-target-badge">${t['sla-target'] || 'Meta'}: ≤${s.targetDays}d</span>
                    </div>
                    <div class="sla-card-body">
                        <div class="sla-pct">${s.compliancePct}%</div>
                        <div class="sla-details">
                            <span>${s.met}/${s.total} ${t['sla-within-target'] || 'dentro do SLA'}</span>
                            <span>${t['label-avg'] || 'Média'}: ${s.avgDays}d</span>
                        </div>
                    </div>
                </div>
            `;
                })
                .join('')}
        </div>
    `;
}

export function processAnalytics(items: WorkItemNode[], tree: WorkItemNode[], options: ProcessAnalyticsOptions = {}) {
    const currentLanguage = options.currentLanguage || state.currentLanguage;
    const workItemMetadata = options.workItemMetadata || state.workItemMetadata;
    const revisionsData = options.revisionsData || state.currentData.revisions;
    const cfdPeriod = options.cfdPeriod || state.cfdPeriod || 180;

    // Global Type Filters Initialization
    if (!state.globalActiveTypes) {
        state.globalActiveTypes = [];
        const seenTypes = new Set<string>();
        items.forEach((item) => {
            const t = item.fields['System.WorkItemType'] as string;
            if (t && !seenTypes.has(t)) {
                seenTypes.add(t);
                state.globalActiveTypes?.push(t);
            }
        });
        state.globalActiveTypes.sort();
        try {
            localStorage.setItem('global_active_types', JSON.stringify(state.globalActiveTypes));
        } catch {
            // ignore localStorage quota errors
        }
    }

    renderGlobalTypeFilters(state.globalActiveTypes, items, workItemMetadata, currentLanguage, (newActiveTypes) => {
        state.globalActiveTypes = newActiveTypes;
        try {
            localStorage.setItem('global_active_types', JSON.stringify(newActiveTypes));
        } catch {
            // ignore
        }
        processAnalytics(state.currentData.items, state.currentData.tree, options);
    });

    const filteredItems = items.filter((item) => {
        const type = item.fields['System.WorkItemType'] as string;
        return state.globalActiveTypes?.includes(type);
    });

    const metrics = computeMetrics(filteredItems, revisionsData, workItemMetadata, currentLanguage, cfdPeriod);
    renderAll(metrics, items, options);
}

export function calculateBottlenecks(
    items: WorkItemNode[],
    revisionsData: Record<number, WorkItem[]>,
    workItemMetadata: WorkItemMetadata
): BottleneckResult[] {
    const columnTimes: Record<string, number[]> = {}; // { column: [durations] }
    let itemsWithRevisions = 0;

    items.forEach((item) => {
        const revisions = revisionsData[item.id];
        if (!revisions || revisions.length === 0) return;
        itemsWithRevisions++;

        // Sort revisions by date
        const sorted = [...revisions].sort(
            (a, b) =>
                new Date(a.fields['System.ChangedDate'] as string).getTime() -
                new Date(b.fields['System.ChangedDate'] as string).getTime()
        );

        // Time spent between transitions
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            const col = (current.fields['System.BoardColumn'] as string) || (current.fields['System.State'] as string);
            if (!col) continue;

            const start = new Date(current.fields['System.ChangedDate'] as string);
            const end = new Date(next.fields['System.ChangedDate'] as string);
            const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

            if (!columnTimes[col]) columnTimes[col] = [];
            columnTimes[col].push(durationDays);
        }

        // Add time in current state for active items
        const lastRev = sorted[sorted.length - 1];
        const stateInfo = getStatusInfo(lastRev.fields['System.State'] as string, workItemMetadata);
        if (stateInfo.label !== 'Done' && stateInfo.label !== 'Removed') {
            const col = (lastRev.fields['System.BoardColumn'] as string) || (lastRev.fields['System.State'] as string);
            const start = new Date(lastRev.fields['System.ChangedDate'] as string);
            const durationDays = (new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

            if (!columnTimes[col]) columnTimes[col] = [];
            columnTimes[col].push(durationDays);
        }
    });

    logger.info(`Bottlenecks: Calculated for ${itemsWithRevisions}/${items.length} items`);

    // Calculate averages
    const results: BottleneckResult[] = Object.entries(columnTimes)
        .map(([column, durations]) => ({
            column,
            avgDays: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
        }))
        .filter((d) => d.avgDays > 0.01) // Show almost everything with some time
        .sort((a, b) => b.avgDays - a.avgDays);

    logger.debug('Bottlenecks data:', results);
    return results;
}
