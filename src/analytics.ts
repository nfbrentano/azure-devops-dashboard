// @ts-nocheck
/**
 * Analytics and Data Processing for Azure DevOps Dashboard
 */
import { state } from './state.ts';
import { translations } from './translations.ts';
import { getItemIcon, getStatusInfo } from './utils.ts';
import { 
    renderCharts, renderThroughputChart, renderAgingChart, 
    renderAssigneeChart, renderWIPChart, renderCFDChart, renderBottlenecksChart,
    renderPortfolioFilters, renderProgress, renderLegends, renderGlobalTypeFilters 
} from './charts.ts';
import { renderActivityHeatmap } from './heatmap.ts';

export function processAnalytics(items, tree, options = {}) {
    const { 
        currentTheme, currentLanguage, workItemMetadata, charts, 
        azureConfig, progressList, callRenderGantt 
    } = options;

    // Global Type Filters Initialization
    if (!state.globalActiveTypes) {
        state.globalActiveTypes = [];
        const seenTypes = new Set();
        items.forEach(item => {
            const t = item.fields['System.WorkItemType'];
            if (t && !seenTypes.has(t)) {
                seenTypes.add(t);
                state.globalActiveTypes.push(t);
            }
        });
        state.globalActiveTypes.sort();
    }

    renderGlobalTypeFilters(state.globalActiveTypes, items, workItemMetadata, currentLanguage, (newActiveTypes) => {
        state.globalActiveTypes = newActiveTypes;
        processAnalytics(state.currentData.items, state.currentData.tree, options);
    });

    const filteredItems = items.filter(item => {
        const type = item.fields['System.WorkItemType'];
        return state.globalActiveTypes.includes(type);
    });

    const leadTimes = [], cycleTimes = [], labels = [], agingData = [];
    const assigneeWorkload = {};
    const boardColumnWIP = {};
    const kpis = { total: filteredItems.length, backlog: 0, inprogress: 0, doneRemoved: 0 };
    const now = new Date();

    filteredItems.forEach(item => {
        const f = item.fields;
        const createdDate = new Date(f['System.CreatedDate']);
        const activatedDate = f['Microsoft.VSTS.Common.ActivatedDate'] ? new Date(f['Microsoft.VSTS.Common.ActivatedDate']) : null;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        const closedDate = closedDateStr ? new Date(closedDateStr) : null;
        const stateName = f['System.State'];
        const changedDate = new Date(f['System.ChangedDate']);

        const statusInfo = getStatusInfo(stateName, workItemMetadata);
        if (statusInfo.label === 'Backlog') kpis.backlog++;
        else if (statusInfo.label === 'In Progress') kpis.inprogress++;
        else if (statusInfo.label === 'Done' || statusInfo.label === 'Removed') kpis.doneRemoved++;

        if (closedDate && !isNaN(closedDate)) {
            leadTimes.push(((closedDate - createdDate) / (1000 * 60 * 60 * 24)).toFixed(1));
            cycleTimes.push(activatedDate ? ((closedDate - activatedDate) / (1000 * 60 * 60 * 24)).toFixed(1) : 0);
            labels.push(`ID ${item.id}`);
        }

        const type = f['System.WorkItemType']?.toLowerCase();
        const iconInfo = getItemIcon(type, workItemMetadata);
        
        if (statusInfo.label === 'In Progress' && !iconInfo.isPortfolio && !isNaN(changedDate)) {
            agingData.push({
                id: item.id,
                title: f['System.Title'] || translations[currentLanguage]['label-no-title'],
                age: Math.max(0, Math.floor((now - changedDate) / (1000 * 60 * 60 * 24))),
                state: stateName
            });
        }

        if (!iconInfo.isPortfolio) {
            let assignee = f['System.AssignedTo'];
            let name = assignee?.displayName || assignee?.uniqueName || (typeof assignee === 'string' ? assignee : translations[currentLanguage]['label-unassigned']);
            assigneeWorkload[name] = (assigneeWorkload[name] || 0) + 1;

            const boardColumn = f['System.BoardColumn'] || f['System.State'];
            boardColumnWIP[boardColumn] = (boardColumnWIP[boardColumn] || 0) + 1;
        }
    });

    // CFD and Heatmap processing
    const cfdSeries = [];
    for (let i = 179; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const counts = { date: d, Proposed: 0, InProgress: 0, Done: 0 };
        filteredItems.forEach(item => {
            const f = item.fields;
            if (getItemIcon(f['System.WorkItemType'], workItemMetadata).isPortfolio) return;
            const created = new Date(f['System.CreatedDate']);
            const activated = f['Microsoft.VSTS.Common.ActivatedDate'] ? new Date(f['Microsoft.VSTS.Common.ActivatedDate']) : null;
            const closed = f['Microsoft.VSTS.Common.ClosedDate'] ? new Date(f['Microsoft.VSTS.Common.ClosedDate']) : null;
            if (created <= d) {
                if (closed && closed <= d) counts.Done++;
                else if (activated && activated <= d) counts.InProgress++;
                else counts.Proposed++;
            }
        });
        cfdSeries.push(counts);
    }

    state.heatmapData = {};
    filteredItems.forEach(item => {
        const f = item.fields;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        if (closedDateStr) {
            const dateStr = new Date(closedDateStr).toISOString().split('T')[0];
            state.heatmapData[dateStr] = (state.heatmapData[dateStr] || 0) + 1;
        }
    });

    const throughputData = [];
    const requirementBacklogTypes = workItemMetadata.backlogs.find(b => b.name.toLowerCase().includes('requirement'))?.workItemTypes || [];
    
    // Find earliest completion date for requirement-level items
    let earliestClosedDate = null;
    filteredItems.forEach(item => {
        const f = item.fields;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        if (!closedDateStr) return;
        const type = item.fields['System.WorkItemType']?.toLowerCase();
        if (!(requirementBacklogTypes.includes(type) || ['user story', 'product backlog item', 'requirement', 'issue'].includes(type))) return;
        
        const closed = new Date(closedDateStr);
        if (!earliestClosedDate || closed < earliestClosedDate) earliestClosedDate = closed;
    });

    if (earliestClosedDate) {
        // Find the absolute start of the week for the first completion
        const firstWeekStart = new Date(earliestClosedDate);
        firstWeekStart.setDate(earliestClosedDate.getDate() - earliestClosedDate.getDay());
        firstWeekStart.setHours(0, 0, 0, 0);

        // Find the absolute start of the current week
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay());
        currentWeekStart.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((currentWeekStart - firstWeekStart) / (1000 * 60 * 60 * 24));
        const numWeeks = Math.max(1, Math.floor(diffDays / 7) + 1);

        for (let i = 0; i < numWeeks; i++) {
            const startOfWeek = new Date(firstWeekStart);
            startOfWeek.setDate(firstWeekStart.getDate() + (i * 7));
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);

            let count = 0;
            filteredItems.forEach(item => {
                const f = item.fields;
                const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
                if (!closedDateStr) return;
                const type = item.fields['System.WorkItemType']?.toLowerCase();
                if (!(requirementBacklogTypes.includes(type) || ['user story', 'product backlog item', 'requirement', 'issue'].includes(type))) return;
                
                const closed = new Date(closedDateStr);
                if (closed >= startOfWeek && closed <= endOfWeek) count++;
            });

            throughputData.push({
                label: `${translations[currentLanguage]['label-week-short']}${i + 1}`,
                range: `${startOfWeek.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' })}`,
                count: count
            });
        }
    }

    // Rendering via charts.js
    renderCharts(labels, leadTimes, cycleTimes, charts, currentTheme, currentLanguage, translations, azureConfig);
    renderAgingChart(agingData, charts, currentTheme, currentLanguage, translations, azureConfig);
    renderAssigneeChart(assigneeWorkload, charts, currentTheme, currentLanguage, translations);
    renderWIPChart(boardColumnWIP, charts, currentTheme, currentLanguage, translations);
    renderCFDChart(cfdSeries, charts, currentTheme, currentLanguage, translations);
    renderActivityHeatmap(state.heatmapData, currentLanguage, translations);
    
    renderThroughputChart(throughputData, charts, currentTheme, currentLanguage, translations);
    
    // Bottleneck Analysis (based on revisions data if available)
    if (options.revisionsData) {
        const bottleneckData = calculateBottlenecks(filteredItems, options.revisionsData, workItemMetadata);
        renderBottlenecksChart(bottleneckData, charts, currentTheme, currentLanguage, translations);
    }

    renderPortfolioFilters(items, workItemMetadata, translations, currentLanguage, () => renderProgress(items, progressList, translations, currentLanguage, workItemMetadata, azureConfig));
    renderProgress(items, progressList, translations, currentLanguage, workItemMetadata, azureConfig);
    
    renderLegends(items, workItemMetadata, translations, currentLanguage);
    if (callRenderGantt) callRenderGantt();

    // Update KPIs (counts + percentages)
    const pct = (val) => kpis.total > 0 ? Math.round((val / kpis.total) * 100) : 0;

    document.getElementById('kpi-total').textContent = kpis.total;
    document.getElementById('kpi-total-pct').textContent = '100%';
    document.getElementById('kpi-backlog').textContent = kpis.backlog;
    document.getElementById('kpi-backlog-pct').textContent = `${pct(kpis.backlog)}%`;
    document.getElementById('kpi-inprogress').textContent = kpis.inprogress;
    document.getElementById('kpi-inprogress-pct').textContent = `${pct(kpis.inprogress)}%`;
    document.getElementById('kpi-done').textContent = kpis.doneRemoved;
    document.getElementById('kpi-done-pct').textContent = `${pct(kpis.doneRemoved)}%`;
}

export function calculateBottlenecks(items, revisionsData, workItemMetadata) {
    const columnTimes = {}; // { column: [durations] }
    let itemsWithRevisions = 0;
    
    items.forEach(item => {
        const revisions = revisionsData[item.id];
        if (!revisions || revisions.length === 0) return;
        itemsWithRevisions++;

        // Sort revisions by date
        const sorted = [...revisions].sort((a, b) => 
            new Date(a.fields['System.ChangedDate']) - new Date(b.fields['System.ChangedDate'])
        );

        // Time spent between transitions
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];
            
            const col = current.fields['System.BoardColumn'] || current.fields['System.State'];
            if (!col) continue;

            const start = new Date(current.fields['System.ChangedDate']);
            const end = new Date(next.fields['System.ChangedDate']);
            const durationDays = (end - start) / (1000 * 60 * 60 * 24);

            if (!columnTimes[col]) columnTimes[col] = [];
            columnTimes[col].push(durationDays);
        }

        // Add time in current state for active items
        const lastRev = sorted[sorted.length - 1];
        const stateInfo = getStatusInfo(lastRev.fields['System.State'], workItemMetadata);
        if (stateInfo.label !== 'Done' && stateInfo.label !== 'Removed') {
            const col = lastRev.fields['System.BoardColumn'] || lastRev.fields['System.State'];
            const start = new Date(lastRev.fields['System.ChangedDate']);
            const durationDays = (new Date() - start) / (1000 * 60 * 60 * 24);
            
            if (!columnTimes[col]) columnTimes[col] = [];
            columnTimes[col].push(durationDays);
        }
    });

    console.log(`Bottlenecks: Calculated for ${itemsWithRevisions}/${items.length} items`);

    // Calculate averages
    const results = Object.entries(columnTimes)
        .map(([column, durations]) => ({
            column,
            avgDays: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
        }))
        .filter(d => d.avgDays > 0.01) // Show almost everything with some time
        .sort((a, b) => b.avgDays - a.avgDays);

    console.log('Bottlenecks data:', results);
    return results;
}
