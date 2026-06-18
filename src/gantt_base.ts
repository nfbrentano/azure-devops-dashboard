import { getWorkItemUrl, getStatusInfo, getItemIcon, calculateProgress } from './utils.ts';
import type { WorkItemNode, WorkItemMetadata, AzureConfig } from './types.ts';

export interface GanttContext {
    ganttPeriod: HTMLSelectElement | null;
    currentData: {
        items: WorkItemNode[];
        tree: WorkItemNode[];
        revisions?: Record<number, any[]>;
    };
    ganttOffset: number;
    currentLanguage: string;
    translations: Record<string, Record<string, string>>;
    workItemMetadata: WorkItemMetadata;
    ganttContainer: HTMLElement | null;
    azureConfig: AzureConfig | null;
    timelineData?: {
        items: WorkItemNode[];
        tree: WorkItemNode[];
    };
    timelineActiveTypes?: string[];
    timelineActiveStates?: string[];
    periodLabelId?: string;
    activeTypes?: string[];
    activeStates?: string[];
}

export interface GanttRenderOptions {
    isTimeline: boolean;
    periodLabelId?: string;
    activeTypes?: string[];
    activeStates?: string[];
}

export const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

export function getGanttDates(period: string, items: WorkItemNode[] = [], ganttOffset: number): { start: Date; end: Date } {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (period === 'total' && items.length > 0) {
        let minDate = new Date();
        let maxDate = new Date();
        items.forEach((item) => {
            const sVal = item.fields['Microsoft.VSTS.Scheduling.StartDate'] || item.fields['System.CreatedDate'];
            const s = new Date(typeof sVal === 'string' ? sVal : '');
            const eVal = item.fields['Microsoft.VSTS.Scheduling.TargetDate'] ||
                item.fields['Microsoft.VSTS.Common.ClosedDate'];
            const e = new Date(typeof eVal === 'string' ? eVal : new Date().toString());
            
            if (isValidDate(s) && s < minDate) minDate = s;
            if (isValidDate(e) && e > maxDate) maxDate = e;
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

export function filterTreeByDate(
    tree: WorkItemNode[],
    start: Date,
    end: Date,
    activeStatusCategories: (string | null)[] | null,
    activeItemTypes: string[] | null,
    workItemMetadata: WorkItemMetadata,
    activeStates?: string[]
): WorkItemNode[] {
    return tree.flatMap((node) => {
        const fields = node.fields || {};
        const startFields = ['Microsoft.VSTS.Scheduling.StartDate', 'System.CreatedDate'];
        const endFields = ['Microsoft.VSTS.Scheduling.TargetDate', 'Microsoft.VSTS.Common.ClosedDate', 'Microsoft.VSTS.Common.ProposedDate'];
        
        let sVal: unknown = null;
        for(const f of startFields) { if(fields[f]) { sVal = fields[f]; break; } }
        let eVal: unknown = null;
        for(const f of endFields) { if(fields[f]) { eVal = fields[f]; break; } }

        const itemStart = new Date(typeof sVal === 'string' ? sVal : new Date().toString());
        const itemEnd = new Date(typeof eVal === 'string' ? eVal : new Date().toString());

        const dateMatch = itemStart <= end && itemEnd >= start;

        let statusMatch = true;
        if (activeStates && activeStates.length > 0) {
            statusMatch = activeStates.includes(fields['System.State'] as string);
        } else if (activeStatusCategories) {
            const statusInfo = getStatusInfo(fields['System.State'] as string, workItemMetadata);
            statusMatch = activeStatusCategories.includes(statusInfo.label.replace(' ', ''));
        }

        let typeMatch = true;
        if (activeItemTypes) {
            const itemType = (fields['System.WorkItemType'] as string || '').toLowerCase();
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
            return filteredChildren;
        }

        return [];
    });
}

export function filterTreeForTimeline(
    nodes: WorkItemNode[],
    activeTypes: string[],
    activeStates: string[]
): WorkItemNode[] {
    return nodes.flatMap(node => {
        const fields = node.fields || {};
        
        const typeLower = (fields['System.WorkItemType'] as string || '').toLowerCase();
        const typeMatch = activeTypes.length === 0 || activeTypes.map(t => t.toLowerCase()).includes(typeLower);
        const stateMatch = activeStates.length === 0 || activeStates.includes(fields['System.State'] as string);
        
        const finalMatch = typeMatch && stateMatch;
        const filteredChildren = filterTreeForTimeline(node.children || [], activeTypes, activeStates);

        if (finalMatch) {
            return [{
                ...node,
                children: filteredChildren,
                allChildren: node.children
            }];
        } else if (filteredChildren.length > 0) {
            return filteredChildren;
        }
        return [];
    });
}

export function renderBaseGantt(tree: WorkItemNode[], context: GanttContext, options: GanttRenderOptions) {
    const { 
        ganttPeriod, 
        currentData, 
        ganttOffset, 
        currentLanguage, 
        translations, 
        workItemMetadata, 
        ganttContainer,
        azureConfig
    } = context;

    const periodValue = ganttPeriod?.value || 'total';
    const periodLabelId = options.periodLabelId || 'gantt-current-period-label';

    const itemsForDateCalculation = currentData.items || [];
    const { start: viewStart, end: viewEnd } = getGanttDates(periodValue, itemsForDateCalculation, ganttOffset);
    const totalMs = viewEnd.getTime() - viewStart.getTime();

    const periodLabel = document.getElementById(periodLabelId);
    if (periodLabel) {
        if (periodValue === 'total') {
            const minYear = viewStart.getFullYear();
            const maxYear = viewEnd.getFullYear();
            periodLabel.textContent = minYear === maxYear ? String(minYear) : `${minYear} - ${maxYear}`;
        } else {
            periodLabel.textContent = `${viewStart.toLocaleDateString(currentLanguage, { day: '2-digit', month: 'short', year: 'numeric' })} - ${viewEnd.toLocaleDateString(currentLanguage, { day: '2-digit', month: 'short', year: 'numeric' })}`;
        }
    }

    let displayTree: WorkItemNode[] = [];

    if (options.isTimeline) {
        const activeTypes = options.activeTypes || [];
        const activeStates = options.activeStates || [];
        displayTree = filterTreeForTimeline(tree, activeTypes, activeStates);

        // Sort timeline roots by start date
        const getStartDate = (n: WorkItemNode) => {
            const fields = n.fields || {};
            const f1 = fields['Microsoft.VSTS.Scheduling.StartDate'];
            const f2 = fields['System.CreatedDate'];
            return new Date(typeof f1 === 'string' ? f1 : (typeof f2 === 'string' ? f2 : new Date().toString())).getTime();
        };
        displayTree.sort((a, b) => getStartDate(a) - getStartDate(b));
    } else {
        const activeStatusCategories = Array.from(document.querySelectorAll('.gantt-status-filters input:checked')).map(
            (cb) => cb.getAttribute('data-category')
        );

        const typeLabelInputs = document.querySelectorAll('#type-legend input');
        let activeItemTypes: string[] | null = null;
        if (typeLabelInputs.length > 0) {
            activeItemTypes = Array.from(typeLabelInputs)
                .filter((cb) => (cb as HTMLInputElement).checked)
                .map((cb) => cb.getAttribute('data-type'))
                .filter((t): t is string => t !== null);
        }

        displayTree = filterTreeByDate(
            tree,
            viewStart,
            viewEnd,
            activeStatusCategories,
            activeItemTypes,
            workItemMetadata
        );
    }

    if (ganttContainer) {
        ganttContainer.innerHTML = '';
        if (displayTree.length === 0) {
            ganttContainer.innerHTML = `<div style="text-align: center; opacity: 0.5; padding: 2rem;">${translations[currentLanguage]['msg-gantt-empty']}</div>`;
            return;
        }

        // Auto reset of limit if period, offset, or mode changed
        const lastKey = `${periodValue}-${ganttOffset}-${options.isTimeline}`;
        const prevKey = ganttContainer.getAttribute('data-last-key');
        if (prevKey !== lastKey) {
            ganttContainer.setAttribute('data-last-key', lastKey);
            ganttContainer.setAttribute('data-limit', '30');
        }

        const pageLimit = parseInt(ganttContainer.getAttribute('data-limit') || '30', 10);
        const slicedTree = displayTree.slice(0, pageLimit);
        const hasMore = displayTree.length > pageLimit;

        const header = document.createElement('div');
        header.className = 'gantt-header';
        header.innerHTML = `<div class="gantt-label" style="border: none;"></div><div class="gantt-timeline"></div>`;
        const timeline = header.querySelector('.gantt-timeline');

        let steps = 4;
        if (periodValue === 'month') steps = 4;
        if (periodValue === 'year') steps = 12;
        if (periodValue === 'week') steps = 7;
        if (periodValue === 'total') steps = 10;

        if (timeline) {
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
        }
        ganttContainer.appendChild(header);

        const now = new Date();
        if (now >= viewStart && now <= viewEnd) {
            const todayPos = ((now.getTime() - viewStart.getTime()) / totalMs) * 100;
            const line = document.createElement('div');
            line.className = 'today-line';
            line.style.left = `calc(var(--gantt-label-width) + 1rem + ( (100% - var(--gantt-label-width) - 1rem) * ${todayPos / 100} ))`;
            ganttContainer.appendChild(line);
        }

        const fragment = document.createDocumentFragment();
        renderRecursive(slicedTree, 0, [], totalMs, viewStart, context, options, fragment);
        ganttContainer.appendChild(fragment);

        if (hasMore) {
            const loadMoreRow = document.createElement('div');
            loadMoreRow.className = 'gantt-load-more-row';
            loadMoreRow.style.cssText = 'display: flex; justify-content: center; padding: 1.5rem;';
            loadMoreRow.innerHTML = `
                <button class="load-more-btn" style="background: rgba(100, 116, 139, 0.1); border: 1px solid var(--border-glass); color: var(--text-muted); padding: 0.5rem 1.5rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="ph ph-plus-circle" style="font-size: 1rem;"></i>
                    <span>${translations[currentLanguage]['label-load-more'] || 'Carregar Mais'} (+${Math.min(30, displayTree.length - pageLimit)})</span>
                </button>
            `;
            loadMoreRow.querySelector('.load-more-btn')?.addEventListener('click', () => {
                ganttContainer.setAttribute('data-limit', String(pageLimit + 30));
                renderBaseGantt(tree, context, options);
            });
            ganttContainer.appendChild(loadMoreRow);
        }
    }
}

function renderRecursive(
    nodes: WorkItemNode[],
    depth: number,
    parentSiblingsActive: boolean[],
    totalMs: number,
    viewStart: Date,
    context: GanttContext,
    options: GanttRenderOptions,
    container: HTMLElement | DocumentFragment
) {
    const { currentLanguage, translations, workItemMetadata, azureConfig } = context;

    nodes.forEach((item, index) => {
        try {
            const fields = item.fields || {};
            const state = (fields['System.State'] as string) || 'Unknown';
            const iconInfo = getItemIcon(fields['System.WorkItemType'] as string, workItemMetadata);
            const statusInfo = getStatusInfo(state, workItemMetadata);

            const hasChildren = item.children && item.children.length > 0;
            const isLastChild = index === nodes.length - 1;

            let treeLinesHtml = '';
            parentSiblingsActive.forEach((active) => {
                treeLinesHtml += `<div class="tree-line spacer ${active ? 'active' : ''}"></div>`;
            });
            if (depth > 0) {
                treeLinesHtml += `<div class="tree-line connector"></div>`;
            }

            let iconHtml = iconInfo.iconData 
                ? `<img src="${iconInfo.iconData}" style="width: 16px; height: 16px; flex-shrink: 0;" alt="">`
                : `<i class="${iconInfo.icon} ${iconInfo.iconClass}" style="flex-shrink: 0; color: ${iconInfo.color}"></i>`;

            const progress = calculateProgress(item, workItemMetadata);
            const row = document.createElement('div');
            row.className = `gantt-row ${hasChildren ? 'parent' : ''} ${depth === 0 ? 'root' : ''} ${isLastChild ? 'last-child' : ''}`;

            if (options.isTimeline) {
                const startDateRaw = fields['Microsoft.VSTS.Scheduling.StartDate'];
                const endDateRaw = fields['Microsoft.VSTS.Scheduling.TargetDate'];
                const hasPlannedDates = !!startDateRaw && !!endDateRaw && isValidDate(new Date(startDateRaw as string)) && isValidDate(new Date(endDateRaw as string));

                const itemStart = new Date(typeof startDateRaw === 'string' ? startDateRaw : (typeof fields['System.CreatedDate'] === 'string' ? fields['System.CreatedDate'] : ''));
                const itemEnd = new Date(typeof endDateRaw === 'string' ? endDateRaw : (typeof fields['Microsoft.VSTS.Common.ClosedDate'] === 'string' ? fields['Microsoft.VSTS.Common.ClosedDate'] : new Date().toString()));

                const left = Math.max(-10, ((itemStart.getTime() - viewStart.getTime()) / totalMs) * 100);
                const right = Math.min(110, ((itemEnd.getTime() - viewStart.getTime()) / totalMs) * 100);
                const width = Math.max(0.1, right - left);

                const isOutside = hasPlannedDates && (right <= 0 || left >= 100);

                const missingDatesExclamation = !hasPlannedDates 
                    ? `<i class="ph-fill ph-warning-octagon" style="color: #ef4444; font-size: 1.1rem; margin-right: 0.25rem;" title="${translations[currentLanguage]['label-no-planned-dates']}"></i>`
                    : '';

                const projectBadge = fields['System.TeamProject'] 
                    ? `<span class="project-tag" style="background: rgba(100, 116, 139, 0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 0.5rem; color: var(--text-muted); border: 1px solid var(--border-glass);">${fields['System.TeamProject']}</span>`
                    : '';

                const startDateStr = hasPlannedDates ? itemStart.toLocaleDateString(currentLanguage, { day: '2-digit', month: '2-digit', year: '2-digit' }) : '---';
                const endDateStr = hasPlannedDates ? itemEnd.toLocaleDateString(currentLanguage, { day: '2-digit', month: '2-digit', year: '2-digit' }) : '---';

                row.innerHTML = `
                    <div class="gantt-label" title="${String(fields['System.Title'] || '')}" style="min-width: 300px;">
                        ${treeLinesHtml}
                        <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden;">
                                ${missingDatesExclamation}
                                <a href="${getWorkItemUrl(azureConfig, item.id, fields['System.TeamProject'] as string)}" target="_blank" class="item-link" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${iconHtml}
                                    <span style="overflow: hidden; text-overflow: ellipsis;">${String(fields['System.Title'] || '')}</span>
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
                            hasPlannedDates && !isOutside
                                ? `
                        <div class="gantt-bar ${statusInfo.class}" style="left: ${Math.max(0, left)}%; width: ${Math.min(100, width)}%; padding-left: 0.5rem; background-color: ${statusInfo.color}">
                            <span>${progress}%</span>
                        </div>
                        `
                                : !hasPlannedDates 
                                ? `<div class="no-dates-msg" style="font-size: 0.75rem; color: #ef4444; opacity: 0.8; display: flex; align-items: center; gap: 0.4rem; font-style: italic; padding: 0 1rem;">
                                    <i class="ph-fill ph-warning-octagon"></i>
                                    ${translations[currentLanguage]['label-no-planned-dates']}
                                   </div>`
                                : ''
                        }
                    </div>
                `;
            } else {
                const hasMissingDates =
                    !fields['Microsoft.VSTS.Scheduling.StartDate'] || !fields['Microsoft.VSTS.Scheduling.TargetDate'];
                const missingDatesWarning = hasMissingDates
                    ? `<i class="ph ph-warning-circle missing-dates-warning" title="${translations[currentLanguage]['gantt-missing-dates-tooltip']}"></i>`
                    : '';

                const sVal = fields['Microsoft.VSTS.Scheduling.StartDate'] || fields['System.CreatedDate'];
                const eVal = fields['Microsoft.VSTS.Scheduling.TargetDate'] || fields['Microsoft.VSTS.Common.ClosedDate'];
                
                const itemStart = new Date(typeof sVal === 'string' ? sVal : '');
                const itemEnd = new Date(typeof eVal === 'string' ? eVal : new Date().toString());

                const left = Math.max(-10, ((itemStart.getTime() - viewStart.getTime()) / totalMs) * 100);
                const right = Math.min(110, ((itemEnd.getTime() - viewStart.getTime()) / totalMs) * 100);
                const width = Math.max(0.1, right - left);

                const isOutside = right <= 0 || left >= 100;

                row.innerHTML = `
                    <div class="gantt-label" title="${String(fields['System.Title'] || '')}">
                        ${treeLinesHtml}
                        <a href="${getWorkItemUrl(azureConfig, item.id)}" target="_blank" class="item-link" style="flex: 1; overflow: hidden; text-overflow: ellipsis;">
                            ${iconHtml}
                            ${missingDatesWarning}
                            <span style="overflow: hidden; text-overflow: ellipsis;">${String(fields['System.Title'] || '')}</span>
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
            }

            container.appendChild(row);

            if (item.children && item.children.length > 0) {
                const nextActiveSiblings = [...parentSiblingsActive];
                if (depth > 0) nextActiveSiblings.push(!isLastChild);
                renderRecursive(item.children, depth + 1, nextActiveSiblings, totalMs, viewStart, context, options, container);
            }
        } catch (e) {
            console.error('Error rendering work item:', item.id, e);
        }
    });
}
