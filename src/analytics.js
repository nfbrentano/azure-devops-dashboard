/**
 * Analytics and Data Processing for Azure DevOps Dashboard
 */
import { state } from './state.js';
import { translations } from './translations.js';
import { getItemIcon, getStatusInfo } from './utils.js';
import { 
    renderCharts, renderThroughputChart, renderAgingChart, 
    renderAssigneeChart, renderCFDChart, renderPortfolioFilters, 
    renderProgress, renderLegends 
} from './charts.js';
import { renderActivityHeatmap } from './heatmap.js';

export function processAnalytics(items, tree, options = {}) {
    const { 
        currentTheme, currentLanguage, workItemMetadata, charts, 
        azureConfig, progressList, callRenderGantt 
    } = options;

    const leadTimes = [], cycleTimes = [], labels = [], agingData = [];
    const assigneeWorkload = {};
    const now = new Date();

    items.forEach(item => {
        const f = item.fields;
        const createdDate = new Date(f['System.CreatedDate']);
        const activatedDate = f['Microsoft.VSTS.Common.ActivatedDate'] ? new Date(f['Microsoft.VSTS.Common.ActivatedDate']) : null;
        const closedDate = f['Microsoft.VSTS.Common.ClosedDate'] ? new Date(f['Microsoft.VSTS.Common.ClosedDate']) : null;
        const stateName = f['System.State'];
        const changedDate = new Date(f['System.ChangedDate']);

        if (closedDate && !isNaN(closedDate)) {
            leadTimes.push(((closedDate - createdDate) / (1000 * 60 * 60 * 24)).toFixed(1));
            cycleTimes.push(activatedDate ? ((closedDate - activatedDate) / (1000 * 60 * 60 * 24)).toFixed(1) : 0);
            labels.push(`ID ${item.id}`);
        }

        const statusInfo = getStatusInfo(stateName, workItemMetadata);
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
        }
    });

    // CFD and Heatmap processing
    const cfdSeries = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const counts = { date: d, Proposed: 0, InProgress: 0, Done: 0 };
        items.forEach(item => {
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
    items.forEach(item => {
        const closedDate = item.fields['Microsoft.VSTS.Common.ClosedDate'];
        if (closedDate) {
            const dateStr = new Date(closedDate).toISOString().split('T')[0];
            state.heatmapData[dateStr] = (state.heatmapData[dateStr] || 0) + 1;
        }
    });

    const throughputData = [];
    const requirementBacklogTypes = workItemMetadata.backlogs.find(b => b.name.toLowerCase().includes('requirement'))?.workItemTypes || [];
    for (let i = 11; i >= 0; i--) {
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() - (i * 7)); startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23, 59, 59, 999);
        let count = 0;
        items.forEach(item => {
            const closedDateStr = item.fields['Microsoft.VSTS.Common.ClosedDate'];
            if (!closedDateStr) return;
            const type = item.fields['System.WorkItemType']?.toLowerCase();
            if (!(requirementBacklogTypes.includes(type) || ['user story', 'product backlog item', 'requirement', 'issue'].includes(type))) return;
            const closed = new Date(closedDateStr);
            if (closed >= startOfWeek && closed <= endOfWeek) count++;
        });
        throughputData.push({
            label: `${translations[currentLanguage]['label-week-short']}${12 - i}`,
            range: `${startOfWeek.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' })}`,
            count: count
        });
    }

    // Rendering via charts.js
    renderCharts(labels, leadTimes, cycleTimes, charts, currentTheme, currentLanguage, translations, azureConfig);
    renderAgingChart(agingData, charts, currentTheme, currentLanguage, translations, azureConfig);
    renderAssigneeChart(assigneeWorkload, charts, currentTheme, currentLanguage, translations);
    renderCFDChart(cfdSeries, charts, currentTheme, currentLanguage, translations);
    renderActivityHeatmap(state.heatmapData, currentLanguage, translations);
    
    renderThroughputChart(throughputData, charts, currentTheme, currentLanguage, translations);
    renderPortfolioFilters(items, workItemMetadata, translations, currentLanguage, () => renderProgress(items, progressList, translations, currentLanguage, workItemMetadata, azureConfig));
    renderProgress(items, progressList, translations, currentLanguage, workItemMetadata, azureConfig);
    
    if (callRenderGantt) callRenderGantt();
    renderLegends(items, workItemMetadata, translations, currentLanguage);
}
