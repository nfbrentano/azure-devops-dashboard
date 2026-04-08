// @ts-nocheck
import { getWorkItemUrl, getStatusInfo, getItemIcon, calculateProgress } from './utils.ts';

/**
 * Hierarchical Gantt chart logic
 */

export function getGanttDates(period, items = [], ganttOffset) {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (period === 'total' && items.length > 0) {
        let minDate = new Date();
        let maxDate = new Date();
        items.forEach((item) => {
            const s = new Date(item.fields['Microsoft.VSTS.Scheduling.StartDate'] || item.fields['System.CreatedDate']);
            const e = new Date(
                item.fields['Microsoft.VSTS.Scheduling.TargetDate'] ||
                    item.fields['Microsoft.VSTS.Common.ClosedDate'] ||
                    new Date()
            );
            if (!isNaN(s) && s < minDate) minDate = s;
            if (!isNaN(e) && e > maxDate) maxDate = e;
        });
        if (minDate.getTime() === maxDate.getTime()) {
            start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            end = new Date(minDate.getFullYear(), minDate.getMonth() + 1, 1);
        } else {
            start = new Date(minDate);
            end = new Date(maxDate);
            const diff = end.getTime() - start.getTime();
            start = new Date(start.getTime() - diff * 0.05);
            end = new Date(end.getTime() + diff * 0.05);
        }
        return { start, end };
    }

    switch (period) {
        case 'week': {
            start.setDate(now.getDate() - now.getDay() + ganttOffset * 7);
            end = new Date(start);
            end.setDate(start.getDate() + 7);
            break;
        }
        case 'month': {
            start = new Date(now.getFullYear(), now.getMonth() + ganttOffset, 1);
            end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            break;
        }
        case 'bimester': {
            const bIndex = Math.floor(now.getMonth() / 2) + ganttOffset;
            start = new Date(now.getFullYear(), bIndex * 2, 1);
            end = new Date(now.getFullYear(), (bIndex + 1) * 2, 1);
            break;
        }
        case 'trimester': {
            const tIndex = Math.floor(now.getMonth() / 3) + ganttOffset;
            start = new Date(now.getFullYear(), tIndex * 3, 1);
            end = new Date(now.getFullYear(), (tIndex + 1) * 3, 1);
            break;
        }
        case 'year': {
            start = new Date(now.getFullYear() + ganttOffset, 0, 1);
            end = new Date(start.getFullYear() + 1, 0, 1);
            break;
        }
    }
    return { start, end };
}

export function filterTreeByDate(tree, start, end, activeStatusCategories, activeItemTypes, workItemMetadata, activeStates) {
    return tree.flatMap((node) => {
        const fields = node.fields || {};
        // ... (dates part) ...
        const startFields = ['Microsoft.VSTS.Scheduling.StartDate', 'System.CreatedDate'];
        const endFields = ['Microsoft.VSTS.Scheduling.TargetDate', 'Microsoft.VSTS.Common.ClosedDate', 'Microsoft.VSTS.Common.ProposedDate'];
        
        let sVal = null;
        for(const f of startFields) { if(fields[f]) { sVal = fields[f]; break; } }
        let eVal = null;
        for(const f of endFields) { if(fields[f]) { eVal = fields[f]; break; } }

        const itemStart = new Date(sVal || new Date());
        const itemEnd = new Date(eVal || new Date());

        const dateMatch = itemStart <= end && itemEnd >= start;

        let statusMatch = true;
        if (activeStates && activeStates.length > 0) {
            statusMatch = activeStates.includes(fields['System.State']);
        } else if (activeStatusCategories) {
            const statusInfo = getStatusInfo(fields['System.State'], workItemMetadata);
            statusMatch = activeStatusCategories.includes(statusInfo.label.replace(' ', ''));
        }

        let typeMatch = true;
        if (activeItemTypes) {
            const itemType = (fields['System.WorkItemType'] || '').toLowerCase();
            const activeLower = activeItemTypes.map(t => t.toLowerCase());
            typeMatch = activeLower.includes(itemType);
        }

        const overlaps = dateMatch && statusMatch && typeMatch;
        const filteredChildren = filterTreeByDate(
            node.children || [],
            start,
            end,
            activeStatusCategories,
            activeItemTypes,
            workItemMetadata,
            activeStates
        );

        if (overlaps) {
            return [
                {
                    ...node,
                    children: filteredChildren,
                    allChildren: node.children,
                    isMatch: true
                }
            ];
        } else if (filteredChildren.length > 0) {
            // Se o nó não passou no filtro, mas os filhos passaram, substituímos o nó pelos filhos (hoisting)
            return filteredChildren;
        }

        return [];
    });
}

export function renderGantt(tree, context) {
    const { ganttPeriod, currentData, ganttOffset, currentLanguage, translations, workItemMetadata, ganttContainer } =
        context;

    const periodValue = ganttPeriod.value;
    const { start: viewStart, end: viewEnd } = getGanttDates(periodValue, currentData.items, ganttOffset);
    const totalMs = viewEnd - viewStart;

    const periodLabel = document.getElementById('gantt-current-period-label');
    if (periodLabel) {
        if (periodValue === 'total') {
            const minYear = viewStart.getFullYear();
            const maxYear = viewEnd.getFullYear();
            periodLabel.textContent = minYear === maxYear ? minYear : `${minYear} - ${maxYear}`;
        } else {
            periodLabel.textContent = `${viewStart.toLocaleDateString(currentLanguage, { day: '2-digit', month: 'short', year: 'numeric' })} - ${viewEnd.toLocaleDateString(currentLanguage, { day: '2-digit', month: 'short', year: 'numeric' })}`;
        }
    }

    const activeStatusCategories = Array.from(document.querySelectorAll('.gantt-status-filters input:checked')).map(
        (cb) => cb.getAttribute('data-category')
    );

    const typeLabelInputs = document.querySelectorAll('#type-legend input');
    let activeItemTypes = null;
    if (typeLabelInputs.length > 0) {
        activeItemTypes = Array.from(typeLabelInputs)
            .filter((cb) => cb.checked)
            .map((cb) => cb.getAttribute('data-type'));
    }

    const displayTree = filterTreeByDate(
        tree,
        viewStart,
        viewEnd,
        activeStatusCategories,
        activeItemTypes,
        workItemMetadata
    );

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

    renderRecursive(displayTree, 0, [], totalMs, viewStart, context);
}

function renderRecursive(nodes, depth, parentSiblingsActive, totalMs, viewStart, context) {
    const { ganttContainer, currentLanguage, translations, workItemMetadata, azureConfig } = context;

    nodes.forEach((item, index) => {
        const fields = item.fields;
        const state = fields['System.State'];
        const iconInfo = getItemIcon(fields['System.WorkItemType'], workItemMetadata);
        const statusInfo = getStatusInfo(state, workItemMetadata);

        const hasMissingDates =
            !fields['Microsoft.VSTS.Scheduling.StartDate'] || !fields['Microsoft.VSTS.Scheduling.TargetDate'];
        const missingDatesWarning = hasMissingDates
            ? `<i class="ph ph-warning-circle missing-dates-warning" title="${translations[currentLanguage]['gantt-missing-dates-tooltip']}"></i>`
            : '';

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

        row.innerHTML = `
            <div class="gantt-label" title="${fields['System.Title']}">
                ${treeLinesHtml}
                <a href="${getWorkItemUrl(azureConfig, item.id)}" target="_blank" class="item-link" style="flex: 1; overflow: hidden; text-overflow: ellipsis;">
                    ${iconHtml}
                    ${missingDatesWarning}
                    <span style="overflow: hidden; text-overflow: ellipsis;">${fields['System.Title']}</span>
                </a>
                <div class="status-indicator">
                    <div class="status-dot" style="background: ${statusInfo.color}"></div>
                    <span>${state}</span>
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
        ganttContainer.appendChild(row);

        if (item.children && item.children.length > 0) {
            const nextActiveSiblings = [...parentSiblingsActive];
            if (depth > 0) nextActiveSiblings.push(!isLastChild);
            renderRecursive(item.children, depth + 1, nextActiveSiblings, totalMs, viewStart, context);
        }
    });
}
