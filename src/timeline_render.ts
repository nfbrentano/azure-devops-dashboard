// @ts-nocheck
import { getWorkItemUrl, getStatusInfo, getItemIcon, calculateProgress } from './utils.ts';
import { getGanttDates, filterTreeByDate } from './gantt.ts';

/**
 * Timeline specific rendering logic (copied and adapted from gantt.ts to avoid breaking it)
 */

export function renderTimeline(tree, context) {
    const { 
        ganttPeriod, 
        currentData, 
        ganttOffset, 
        currentLanguage, 
        translations, 
        workItemMetadata, 
        ganttContainer,
        periodLabelId = 'timeline-gantt-period-label'
    } = context;

    const periodValue = ganttPeriod.value;
    // We use the same getGanttDates as the original Gantt for consistency
    const { start: viewStart, end: viewEnd } = getGanttDates(periodValue, tree.flatMap(n => [n, ...(n.children || [])]), ganttOffset);
    const totalMs = viewEnd - viewStart;

    const periodLabel = document.getElementById(periodLabelId);
    if (periodLabel) {
        if (periodValue === 'total') {
            const minYear = viewStart.getFullYear();
            const maxYear = viewEnd.getFullYear();
            periodLabel.textContent = minYear === maxYear ? minYear : `${minYear} - ${maxYear}`;
        } else {
            periodLabel.textContent = `${viewStart.toLocaleDateString(currentLanguage, { day: '2-digit', month: 'short', year: 'numeric' })} - ${viewEnd.toLocaleDateString(currentLanguage, { day: '2-digit', month: 'short', year: 'numeric' })}`;
        }
    }

    const activeTypes = context.activeTypes || [];
    
    // Timeline defaults to showing all statuses for now, or we could add specific filters
    const displayTree = filterTreeByDate(
        tree,
        viewStart,
        viewEnd,
        ['Backlog', 'InProgress', 'Completed', 'Done'], // default categories
        activeTypes, // Use the active types from context
        workItemMetadata
    );

    // Sort by Start Date
    const getStartDate = (n) => {
        const fields = n.fields || {};
        const f1 = fields['Microsoft.VSTS.Scheduling.StartDate'];
        const f2 = fields['System.CreatedDate'];
        return new Date(f1 || f2 || new Date()).getTime();
    };

    displayTree.sort((a, b) => getStartDate(a) - getStartDate(b));

    ganttContainer.innerHTML = '';
    if (displayTree.length === 0) {
        ganttContainer.innerHTML = `<div style="text-align: center; opacity: 0.5; padding: 2rem;">${translations[currentLanguage]['msg-gantt-empty']}</div>`;
        return;
    }

    const header = document.createElement('div');
    header.className = 'gantt-header';
    header.innerHTML = `<div class="gantt-label" style="border: none;"></div><div class="gantt-timeline"></div>`;
    const timeline = header.querySelector('.gantt-timeline');

    let steps = 4;
    if (periodValue === 'month') steps = 4;
    if (periodValue === 'year') steps = 12;
    if (periodValue === 'week') steps = 7;
    if (periodValue === 'total') steps = 10;

    for (let i = 0; i < steps; i++) {
        const milestone = document.createElement('div');
        milestone.className = 'timeline-milestone';
        const mDate = new Date(viewStart.getTime() + (totalMs / steps) * i);
        milestone.textContent =
            periodValue === 'year' || periodValue === 'total'
                ? mDate.toLocaleString(currentLanguage, { month: 'short', year: '2-digit' })
                : mDate.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' });
        timeline.appendChild(milestone);
    }
    ganttContainer.appendChild(header);

    const now = new Date();
    if (now >= viewStart && now <= viewEnd) {
        const todayPos = ((now - viewStart) / totalMs) * 100;
        const line = document.createElement('div');
        line.className = 'today-line';
        line.style.left = `calc(var(--gantt-label-width) + 1rem + ( (100% - var(--gantt-label-width) - 1rem) * ${todayPos / 100} ))`;
        ganttContainer.appendChild(line);
    }

    const fragment = document.createDocumentFragment();
    renderRecursive(displayTree, 0, [], totalMs, viewStart, context, fragment);
    ganttContainer.appendChild(fragment);
}

function renderRecursive(nodes, depth, parentSiblingsActive, totalMs, viewStart, context, container) {
    const { currentLanguage, workItemMetadata, azureConfig } = context;

    nodes.forEach((item, index) => {
        try {
            const fields = item.fields;
            const state = fields['System.State'];
            const iconInfo = getItemIcon(fields['System.WorkItemType'], workItemMetadata);
            const statusInfo = getStatusInfo(state, workItemMetadata);

            const itemStart = new Date(fields['Microsoft.VSTS.Scheduling.StartDate'] || fields['System.CreatedDate']);
            const itemEnd = new Date(
                fields['Microsoft.VSTS.Scheduling.TargetDate'] || fields['Microsoft.VSTS.Common.ClosedDate'] || new Date()
            );

            const left = Math.max(-10, ((itemStart - viewStart) / totalMs) * 100);
            const right = Math.min(110, ((itemEnd - viewStart) / totalMs) * 100);
            const width = Math.max(0.1, right - left);

            const isOutside = right <= 0 || left >= 100;
            const progress = calculateProgress(item, workItemMetadata);
            const row = document.createElement('div');
            const hasChildren = item.children && item.children.length > 0;
            const isLastChild = index === nodes.length - 1;
            row.className = `gantt-row ${hasChildren ? 'parent' : ''} ${depth === 0 ? 'root' : ''} ${isLastChild ? 'last-child' : ''}`;

            let treeLinesHtml = '';
            parentSiblingsActive.forEach((active) => {
                treeLinesHtml += `<div class="tree-line spacer ${active ? 'active' : ''}"></div>`;
            });
            if (depth > 0) {
                treeLinesHtml += `<div class="tree-line connector"></div>`;
            }

            let iconHtml = `<i class="${iconInfo.icon} ${iconInfo.iconClass}" style="flex-shrink: 0; color: ${iconInfo.color}"></i>`;
            if (iconInfo.iconData) {
                iconHtml = `<img src="${iconInfo.iconData}" style="width: 16px; height: 16px; flex-shrink: 0;" alt="">`;
            }

            const projectBadge = fields['System.TeamProject'] 
                ? `<span class="project-tag" style="background: rgba(100, 116, 139, 0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 0.5rem; color: var(--text-muted); border: 1px solid var(--border-glass);">${fields['System.TeamProject']}</span>`
                : '';

            const startDateStr = itemStart.toLocaleDateString(currentLanguage, { day: '2-digit', month: '2-digit', year: '2-digit' });
            const endDateStr = itemEnd.toLocaleDateString(currentLanguage, { day: '2-digit', month: '2-digit', year: '2-digit' });

            row.innerHTML = `
                <div class="gantt-label" title="${fields['System.Title']}" style="min-width: 300px;">
                    ${treeLinesHtml}
                    <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
                    <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden;">
                            <a href="${getWorkItemUrl(azureConfig, item.id, fields['System.TeamProject'])}" target="_blank" class="item-link" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${iconHtml}
                                <span style="overflow: hidden; text-overflow: ellipsis;">${fields['System.Title']}</span>
                            </a>
                    </div>
                    <div style="display: flex; align-items: center; margin-top: 2px; flex-wrap: wrap; gap: 0.5rem;">
                            ${projectBadge}
                            <div class="status-indicator" style="font-size: 0.7rem;">
                                <div class="status-dot" style="background: ${statusInfo.color}; width: 6px; height: 6px;"></div>
                                <span>${state}</span>
                            </div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.25rem;">
                                <i class="ph ph-calendar-blank"></i>
                                <span>${startDateStr}</span>
                                <span>→</span>
                                <span>${endDateStr}</span>
                            </div>
                    </div>
                    </div>
                </div>
                <div class="gantt-track">
                    ${
                        !isOutside
                            ? `
                    <div class="gantt-bar ${statusInfo.class}" style="left: ${Math.max(0, left)}%; width: ${Math.min(100, width)}%; padding-left: 0.5rem; background-color: ${statusInfo.color}">
                        <span>${progress}%</span>
                    </div>
                    `
                            : ''
                    }
                </div>
            `;
            container.appendChild(row);

            if (item.children && item.children.length > 0) {
                const nextActiveSiblings = [...parentSiblingsActive];
                if (depth > 0) nextActiveSiblings.push(!isLastChild);
                renderRecursive(item.children, depth + 1, nextActiveSiblings, totalMs, viewStart, context, container);
            }
        } catch (e) {
            console.error('Error rendering work item:', item.id, e);
        }
    });
}
