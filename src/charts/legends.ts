import { getItemIcon, getStatusInfo } from '../utils.ts';
import type { WorkItemNode, WorkItemMetadata } from '../types.ts';

export function renderLegends(
    activeItems: WorkItemNode[] | null,
    workItemMetadata: WorkItemMetadata,
    translations: Record<string, Record<string, string>>,
    currentLanguage: string
) {
    const statusLegend = document.getElementById('status-legend');
    const typeLegend = document.getElementById('type-legend');
    if (!statusLegend || !typeLegend) return;

    const activeStatesSet = new Set<string>();
    const activeTypesSet = new Set<string>();

    const hasActiveItems = activeItems && activeItems.length > 0;

    if (hasActiveItems) {
        activeItems.forEach((item) => {
            const state = item.fields['System.State'] as string;
            const type = item.fields['System.WorkItemType'] as string;
            if (state) activeStatesSet.add(state.toLowerCase());
            if (type) activeTypesSet.add(type.toLowerCase());
        });
    }

    const lang = translations[currentLanguage];
    const categories = {
        Proposed: { label: lang['status-backlog'], class: 'bg-backlog' },
        InProgress: { label: lang['status-inprogress'], class: 'bg-inprogress' },
        Completed: { label: lang['status-done'], class: 'bg-done' },
        Removed: { label: lang['status-removed'], class: 'bg-removed' }
    };

    statusLegend.innerHTML = '';
    Object.entries(categories).forEach(([cat, info]) => {
        if (hasActiveItems) {
            const hasCategory = Object.values(workItemMetadata.states).some(
                (s) => s.category === cat && activeStatesSet.has(s.name.toLowerCase())
            );

            const fallbackHasCategory = activeItems.some((item) => {
                const sInfo = getStatusInfo(item.fields['System.State'] as string, workItemMetadata);
                return sInfo.label === info.label;
            });

            if (!hasCategory && !fallbackHasCategory) return;
        }

        const item = document.createElement('div');
        item.className = 'legend-item';
        const sampleState = Object.values(workItemMetadata.states).find((s) => s.category === cat);
        let color = sampleState ? sampleState.color : null;

        if (!color) {
            if (cat === 'Completed') color = '#10b981';
            else if (cat === 'Removed') color = '#64748b';
            else if (cat === 'InProgress') color = '#3b82f6';
            else color = '#94a3b8';
        }

        item.innerHTML = `<div class="legend-color" style="background: ${color}"></div> ${info.label}`;
        statusLegend.appendChild(item);
    });

    typeLegend.innerHTML = '';
    let typesToRender: string[];
    if (hasActiveItems) {
        typesToRender = Array.from(activeTypesSet);
    } else {
        typesToRender =
            workItemMetadata.backlogs.length > 0
                ? workItemMetadata.backlogs.flatMap((b) => b.workItemTypes)
                : Object.keys(workItemMetadata.types);
    }

    const renderedTypes = new Set<string>();
    typesToRender.forEach((typeName) => {
        if (renderedTypes.has(typeName)) return;
        renderedTypes.add(typeName);

        const type = workItemMetadata.types[typeName];
        if (!type) return;
        const iconInfo = getItemIcon(typeName, workItemMetadata);

        const label = document.createElement('label');
        label.className = 'filter-item';

        let iconHtml = `<i class="${iconInfo.icon}" style="color: ${type.color}"></i>`;
        if (iconInfo.iconData) {
            iconHtml = `<img src="${iconInfo.iconData}" style="width: 16px; height: 16px;" alt="">`;
        }

        // Check if this type belongs to 'Iteration backlog'
        let isIterationBacklog = false;
        if (workItemMetadata.backlogs) {
            const iterBacklog = workItemMetadata.backlogs.find(
                (b) => b.name === 'Iteration backlog' || b.name === 'Iteration Backlog'
            );
            if (iterBacklog && iterBacklog.workItemTypes.some((t) => t.toLowerCase() === typeName)) {
                isIterationBacklog = true;
            }
        }

        // Fallback for explicitly common iteration level items according to the user
        if (
            ['task', 'bug', 'sprint', 'bug sprint', 'test', 'test case', 'test plan', 'test suite'].includes(typeName)
        ) {
            isIterationBacklog = true;
        }

        const isChecked = !isIterationBacklog;

        label.innerHTML = `
            <input type="checkbox" data-type="${typeName}" ${isChecked ? 'checked' : ''}>
            ${iconHtml} <span>${type.name}</span>
        `;
        typeLegend.appendChild(label);
    });
}
