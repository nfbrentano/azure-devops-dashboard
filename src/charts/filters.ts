import { getItemIcon, getStatusInfo } from '../utils.ts';
import type { WorkItemNode, WorkItemMetadata } from '../types.ts';

export function renderPortfolioFilters(
    items: WorkItemNode[],
    workItemMetadata: WorkItemMetadata,
    translations: Record<string, Record<string, string>>,
    currentLanguage: string,
    onFilterChange: () => void
) {
    const container = document.getElementById('portfolio-status-filters');
    if (!container) return;

    const portfolioStatuses = new Set<string>();
    items.forEach((item) => {
        const iconInfo = getItemIcon(item.fields['System.WorkItemType'] as string, workItemMetadata);
        if (iconInfo.isPortfolio) {
            portfolioStatuses.add(item.fields['System.State'] as string);
        }
    });

    if (portfolioStatuses.size === 0) {
        container.innerHTML = '';
        return;
    }

    const previousSelection = new Set<string>(
        Array.from(container.querySelectorAll('input:checked')).map((cb) => (cb as HTMLInputElement).value)
    );

    container.innerHTML = '';
    Array.from(portfolioStatuses)
        .sort()
        .forEach((state) => {
            const label = document.createElement('label');
            label.className = 'filter-item';

            const statusInfo = getStatusInfo(state, workItemMetadata);
            const isChecked = previousSelection.size > 0 ? previousSelection.has(state) : statusInfo.label !== 'Done';

            label.innerHTML = `
            <input type="checkbox" value="${state}" ${isChecked ? 'checked' : ''}>
            <span>${state}</span>
        `;

            label.querySelector('input')!.addEventListener('change', () => onFilterChange());
            container.appendChild(label);
        });
}

export function renderGlobalTypeFilters(
    activeTypes: string[],
    items: WorkItemNode[],
    workItemMetadata: WorkItemMetadata,
    currentLanguage: string,
    onFilterChange: (newActiveTypes: string[]) => void
) {
    const container = document.getElementById('global-type-legend');
    if (!container) return;

    container.innerHTML = '';

    const uniqueTypes = new Set<string>();
    items.forEach((item) => {
        const t = item.fields['System.WorkItemType'] as string;
        if (t) uniqueTypes.add(t);
    });

    const typesArray = Array.from(uniqueTypes).sort();

    typesArray.forEach((typeName) => {
        const typeMeta = Object.values(workItemMetadata.types).find(
            (t) => t.name.toLowerCase() === typeName.toLowerCase()
        ) || { name: typeName, color: '#64748b' };

        const iconInfo = getItemIcon(typeName, workItemMetadata);
        const label = document.createElement('label');
        label.className = 'filter-item';

        let iconHtml = `<i class="${iconInfo.icon}" style="color: ${typeMeta.color}"></i>`;
        if (iconInfo.iconData) {
            iconHtml = `<img src="${iconInfo.iconData}" style="width: 16px; height: 16px;" alt="">`;
        }

        const isChecked = activeTypes.includes(typeName);

        label.innerHTML = `
            <input type="checkbox" data-global-type="${typeName}" ${isChecked ? 'checked' : ''}>
            ${iconHtml} <span>${typeMeta.name}</span>
        `;

        const checkbox = label.querySelector('input')!;
        checkbox.addEventListener('change', () => {
            const newActiveTypes: string[] = [];
            container.querySelectorAll('input').forEach((cb) => {
                if ((cb as HTMLInputElement).checked) {
                    const val = cb.getAttribute('data-global-type');
                    if (val) newActiveTypes.push(val);
                }
            });
            onFilterChange(newActiveTypes);
        });

        container.appendChild(label);
    });
}

export function renderTimelineTypeFilters(
    items: WorkItemNode[],
    activeTypes: string[],
    workItemMetadata: WorkItemMetadata,
    currentLanguage: string,
    onFilterChange: (selectedTypes: string[]) => void
) {
    const container = document.getElementById('timeline-type-legend');
    if (!container) return;

    container.innerHTML = '';

    const uniqueTypes = new Set<string>();
    items.forEach((item) => {
        const t = item.fields['System.WorkItemType'] as string;
        if (t) uniqueTypes.add(t);
    });

    const typesArray = Array.from(uniqueTypes).sort();

    typesArray.forEach((typeName) => {
        const typeMeta = Object.values(workItemMetadata.types).find(
            (t) => t.name.toLowerCase() === typeName.toLowerCase()
        ) || { name: typeName, color: '#64748b' };

        const iconInfo = getItemIcon(typeName, workItemMetadata);
        const label = document.createElement('label');
        label.className = 'filter-item';

        let iconHtml = `<i class="${iconInfo.icon}" style="color: ${typeMeta.color}"></i>`;
        if (iconInfo.iconData) {
            iconHtml = `<img src="${iconInfo.iconData}" style="width: 16px; height: 16px;" alt="">`;
        }

        const isChecked = activeTypes.includes(typeName);

        label.innerHTML = `
            <input type="checkbox" data-timeline-type="${typeName}" ${isChecked ? 'checked' : ''}>
            ${iconHtml} <span>${typeMeta.name}</span>
        `;

        const checkbox = label.querySelector('input')!;
        checkbox.addEventListener('change', () => {
            const selectedTypes: string[] = [];
            container.querySelectorAll('input').forEach((cb) => {
                if ((cb as HTMLInputElement).checked) {
                    const val = cb.getAttribute('data-timeline-type');
                    if (val) selectedTypes.push(val);
                }
            });
            onFilterChange(selectedTypes);
        });

        container.appendChild(label);
    });
}

export function renderTimelineStateFilters(
    items: WorkItemNode[],
    activeStates: string[],
    workItemMetadata: WorkItemMetadata,
    currentLanguage: string,
    onFilterChange: (selectedStates: string[]) => void
) {
    const container = document.getElementById('timeline-state-filters');
    if (!container) return;

    container.innerHTML = '';

    const uniqueStates = new Set<string>();
    items.forEach((item) => {
        const s = item.fields['System.State'] as string;
        if (s) uniqueStates.add(s);
    });

    const statesArray = Array.from(uniqueStates).sort();

    statesArray.forEach((stateName) => {
        const statusInfo = getStatusInfo(stateName, workItemMetadata);
        const label = document.createElement('label');
        label.className = 'filter-item';

        const isChecked = activeStates.includes(stateName);

        label.innerHTML = `
            <input type="checkbox" data-timeline-state="${stateName}" ${isChecked ? 'checked' : ''}>
            <div class="status-dot" style="background: ${statusInfo.color}; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px;"></div>
            <span>${stateName}</span>
        `;

        const checkbox = label.querySelector('input')!;
        checkbox.addEventListener('change', () => {
            const selectedStates: string[] = [];
            container.querySelectorAll('input').forEach((cb) => {
                if ((cb as HTMLInputElement).checked) {
                    const val = cb.getAttribute('data-timeline-state');
                    if (val) selectedStates.push(val);
                }
            });
            onFilterChange(selectedStates);
        });

        container.appendChild(label);
    });
}
