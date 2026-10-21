import { getItemIcon, getStatusInfo } from '../utils.ts';
import type { WorkItemNode, WorkItemMetadata } from '../types.ts';

export function renderPortfolioFilters(
    items: WorkItemNode[],
    workItemMetadata: WorkItemMetadata,
    _translations: Record<string, Record<string, string>>,
    _currentLanguage: string,
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
            const isChecked =
                previousSelection.size > 0
                    ? previousSelection.has(state)
                    : statusInfo.label !== 'Done' && statusInfo.label !== 'Removed';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = state;
            checkbox.checked = isChecked;

            const span = document.createElement('span');
            span.textContent = state;

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(' '));
            label.appendChild(span);

            checkbox.addEventListener('change', () => onFilterChange());
            container.appendChild(label);
        });
}

function createIconElement(iconInfo: ReturnType<typeof getItemIcon>, fallbackColor: string): HTMLElement {
    if (iconInfo.iconData) {
        const img = document.createElement('img');
        img.src = iconInfo.iconData;
        img.style.width = '16px';
        img.style.height = '16px';
        img.alt = '';
        return img;
    }
    const icon = document.createElement('i');
    icon.className = iconInfo.icon;
    icon.style.color = fallbackColor;
    return icon;
}

export function renderGlobalTypeFilters(
    activeTypes: string[],
    items: WorkItemNode[],
    workItemMetadata: WorkItemMetadata,
    _currentLanguage: string,
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

        const isChecked = activeTypes.includes(typeName);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.setAttribute('data-global-type', typeName);
        checkbox.checked = isChecked;

        const iconElem = createIconElement(iconInfo, typeMeta.color);
        const span = document.createElement('span');
        span.textContent = typeMeta.name;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' '));
        label.appendChild(iconElem);
        label.appendChild(document.createTextNode(' '));
        label.appendChild(span);

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
    _currentLanguage: string,
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

        const isChecked = activeTypes.includes(typeName);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.setAttribute('data-timeline-type', typeName);
        checkbox.checked = isChecked;

        const iconElem = createIconElement(iconInfo, typeMeta.color);
        const span = document.createElement('span');
        span.textContent = typeMeta.name;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' '));
        label.appendChild(iconElem);
        label.appendChild(document.createTextNode(' '));
        label.appendChild(span);

        checkbox.addEventListener('change', () => {
            const selectedTypes: string[] = [];
            container.querySelectorAll('input').forEach((cb) => {
                if ((cb as HTMLInputElement).checked) {
                    const val = cb.getAttribute('data-timeline-type');
                    if (val) selectedTypes.push(val);
                }
            });
            try {
                localStorage.setItem('timeline_active_types', JSON.stringify(selectedTypes));
            } catch {
                // ignore
            }
            onFilterChange(selectedTypes);
        });

        container.appendChild(label);
    });
}

export function renderTimelineStateFilters(
    items: WorkItemNode[],
    activeStates: string[],
    workItemMetadata: WorkItemMetadata,
    _currentLanguage: string,
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

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.setAttribute('data-timeline-state', stateName);
        checkbox.checked = isChecked;

        const dot = document.createElement('div');
        dot.className = 'status-dot';
        dot.style.background = statusInfo.color;
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.borderRadius = '50%';
        dot.style.display = 'inline-block';
        dot.style.marginRight = '4px';

        const span = document.createElement('span');
        span.textContent = stateName;

        label.appendChild(checkbox);
        label.appendChild(dot);
        label.appendChild(span);

        checkbox.addEventListener('change', () => {
            const selectedStates: string[] = [];
            container.querySelectorAll('input').forEach((cb) => {
                if ((cb as HTMLInputElement).checked) {
                    const val = cb.getAttribute('data-timeline-state');
                    if (val) selectedStates.push(val);
                }
            });
            try {
                localStorage.setItem('timeline_active_states', JSON.stringify(selectedStates));
            } catch {
                // ignore
            }
            onFilterChange(selectedStates);
        });

        container.appendChild(label);
    });
}
