/**
 * Analytics and Data Processing for Azure DevOps Dashboard
 */
import { state } from './state.ts';
import type { WorkItemNode, WorkItemMetadata } from './types.ts';
import { translations } from './translations.ts';
import { getItemIcon, getStatusInfo } from './utils.ts';
import { logger } from './logger.ts';
import {
    renderCharts,
    renderThroughputChart,
    renderAgingChart,
    renderAssigneeChart,
    renderWIPChart,
    renderCFDChart,
    renderBottlenecksChart,
    renderPortfolioFilters,
    renderProgress,
    renderLegends,
    renderGlobalTypeFilters
} from './charts/index.ts';
import { renderActivityHeatmap } from './heatmap.ts';

export interface ComputedMetrics {
    filteredItems: WorkItemNode[];
    leadTimes: string[];
    cycleTimes: (string | number)[];
    labels: string[];
    agingData: any[];
    assigneeWorkload: Record<string, number>;
    boardColumnWIP: Record<string, number>;
    kpis: {
        total: number;
        backlog: number;
        inprogress: number;
        doneRemoved: number;
    };
    cfdSeries: any[];
    heatmapData: Record<string, number>;
    throughputData: any[];
    bottleneckData: any[] | null;
}

export function computeMetrics(
    filteredItems: WorkItemNode[],
    revisionsData: Record<number, any[]> | undefined,
    workItemMetadata: WorkItemMetadata,
    currentLanguage: string
): ComputedMetrics {
    const leadTimes: string[] = [],
        cycleTimes: (string | number)[] = [],
        labels: string[] = [],
        agingData: any[] = [];
    const assigneeWorkload: Record<string, number> = {};
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
            cycleTimes.push(activatedDate ? ((closedDate.getTime() - activatedDate.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1) : 0);
            labels.push(`ID ${item.id}`);
        }

        const type = (f['System.WorkItemType'] as string)?.toLowerCase();
        const iconInfo = getItemIcon(type, workItemMetadata);

        if (statusInfo.label === 'In Progress' && !iconInfo.isPortfolio && !isNaN(changedDate.getTime())) {
            agingData.push({
                id: item.id,
                title: (f['System.Title'] as string) || translations[currentLanguage]['label-no-title'],
                age: Math.max(0, Math.floor((now.getTime() - changedDate.getTime()) / (1000 * 60 * 60 * 24))),
                state: stateName
            });
        }

        if (!iconInfo.isPortfolio) {
            const assignee = f['System.AssignedTo'] as any;
            const name =
                assignee?.displayName ||
                assignee?.uniqueName ||
                (typeof assignee === 'string' ? assignee : translations[currentLanguage]['label-unassigned']);
            assigneeWorkload[name] = (assigneeWorkload[name] || 0) + 1;

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

    const cfdSeries: any[] = [];
    for (let i = 179; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const t = d.getTime();
        const counts = { date: d, Proposed: 0, InProgress: 0, Done: 0 };

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

    const throughputData: any[] = [];
    const requirementBacklogTypes =
        workItemMetadata.backlogs.find((b) => b.name.toLowerCase().includes('requirement'))?.workItemTypes || [];

    let earliestClosedDate: Date | null = null;
    filteredItems.forEach((item) => {
        const f = item.fields;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        if (!closedDateStr) return;
        const type = (item.fields['System.WorkItemType'] as string)?.toLowerCase();
        if (
            !(
                requirementBacklogTypes.includes(type) ||
                ['user story', 'product backlog item', 'requirement', 'issue'].includes(type)
            )
        )
            return;

        const closed = new Date(closedDateStr as string);
        if (!earliestClosedDate || closed < earliestClosedDate) earliestClosedDate = closed;
    });

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
                if (
                    !(
                        requirementBacklogTypes.includes(type) ||
                        ['user story', 'product backlog item', 'requirement', 'issue'].includes(type)
                    )
                )
                    return;

                const closed = new Date(closedDateStr as string);
                if (closed >= startOfWeek && closed <= endOfWeek) count++;
            });

            throughputData.push({
                label: `${translations[currentLanguage]['label-week-short']}${i + 1}`,
                range: `${startOfWeek.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' })}`,
                count: count
            });
        }
    }

    // Bottlenecks
    let bottleneckData: any[] | null = null;
    if (revisionsData) {
        bottleneckData = calculateBottlenecks(filteredItems, revisionsData, workItemMetadata);
    }

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
        bottleneckData
    };
}

export function renderAll(metrics: ComputedMetrics, originalItems: WorkItemNode[], options: any) {
    const { currentTheme, currentLanguage, workItemMetadata, charts, azureConfig, progressList, callRenderGantt } =
        options;

    // Rendering via charts.js
    renderCharts(metrics.labels, metrics.leadTimes, metrics.cycleTimes, charts, currentTheme, currentLanguage, translations, azureConfig);
    renderAgingChart(metrics.agingData, charts, currentTheme, currentLanguage, translations, azureConfig);
    renderAssigneeChart(metrics.assigneeWorkload, charts, currentTheme, currentLanguage, translations);
    renderWIPChart(metrics.boardColumnWIP, charts, currentTheme, currentLanguage, translations);
    renderCFDChart(metrics.cfdSeries, charts, currentTheme, currentLanguage, translations);
    renderActivityHeatmap(metrics.heatmapData, currentLanguage, translations);

    renderThroughputChart(metrics.throughputData, charts, currentTheme, currentLanguage, translations);

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
}

export function processAnalytics(items: WorkItemNode[], tree: WorkItemNode[], options: any = {}) {
    const { currentLanguage, workItemMetadata, revisionsData } = options;

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
    }

    renderGlobalTypeFilters(state.globalActiveTypes, items, workItemMetadata, currentLanguage, (newActiveTypes) => {
        state.globalActiveTypes = newActiveTypes;
        processAnalytics(state.currentData.items, state.currentData.tree, options);
    });

    const filteredItems = items.filter((item) => {
        const type = item.fields['System.WorkItemType'] as string;
        return state.globalActiveTypes?.includes(type);
    });

    const metrics = computeMetrics(filteredItems, revisionsData, workItemMetadata, currentLanguage);
    renderAll(metrics, items, options);
}

export function calculateBottlenecks(
    items: WorkItemNode[],
    revisionsData: Record<number, any[]>,
    workItemMetadata: WorkItemMetadata
) {
    const columnTimes: Record<string, number[]> = {}; // { column: [durations] }
    let itemsWithRevisions = 0;

    items.forEach((item) => {
        const revisions = revisionsData[item.id];
        if (!revisions || revisions.length === 0) return;
        itemsWithRevisions++;

        // Sort revisions by date
        const sorted = [...revisions].sort(
            (a, b) => new Date(a.fields['System.ChangedDate'] as string).getTime() - new Date(b.fields['System.ChangedDate'] as string).getTime()
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
    const results = Object.entries(columnTimes)
        .map(([column, durations]) => ({
            column,
            avgDays: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
        }))
        .filter((d) => d.avgDays > 0.01) // Show almost everything with some time
        .sort((a, b) => b.avgDays - a.avgDays);

    logger.debug('Bottlenecks data:', results);
    return results;
}
