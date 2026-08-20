import { getItemIcon, getStatusInfo, calculateProgress, getWorkItemUrl } from '../utils.ts';
import type { WorkItemNode, WorkItemMetadata, AzureConfig } from '../types.ts';

export function renderProgress(
    items: WorkItemNode[],
    progressList: HTMLElement | null,
    translations: Record<string, Record<string, string>>,
    currentLanguage: string,
    workItemMetadata: WorkItemMetadata,
    azureConfig: AzureConfig | null
) {
    if (!progressList) return;
    progressList.innerHTML = '';

    const activeFilters = new Set(
        Array.from(document.querySelectorAll('#portfolio-status-filters input:checked')).map(
            (cb) => (cb as HTMLInputElement).value
        )
    );

    const filteredItems = items.filter((item) => {
        const iconInfo = getItemIcon(item.fields['System.WorkItemType'] as string, workItemMetadata);
        const state = item.fields['System.State'] as string;
        return iconInfo.isPortfolio && activeFilters.has(state);
    });

    if (filteredItems.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.textAlign = 'center';
        emptyDiv.style.opacity = '0.5';
        emptyDiv.style.fontSize = '0.8rem';
        emptyDiv.style.padding = '1rem';
        emptyDiv.textContent = translations[currentLanguage]?.['msg-portfolio-empty'] || '';
        progressList.appendChild(emptyDiv);
        return;
    }

    filteredItems.forEach((item) => {
        const progress = calculateProgress(item, workItemMetadata);
        const iconInfo = getItemIcon(item.fields['System.WorkItemType'] as string, workItemMetadata);
        const statusInfo = getStatusInfo(item.fields['System.State'] as string, workItemMetadata);
        const card = document.createElement('div');
        card.className = 'progress-item';

        const header = document.createElement('div');
        header.className = 'progress-header';

        const link = document.createElement('a');
        link.href = getWorkItemUrl(azureConfig, item.id);
        link.target = '_blank';
        link.className = 'item-link';
        link.style.display = 'flex';
        link.style.alignItems = 'center';
        link.style.gap = '0.5rem';
        link.style.flex = '1';

        if (iconInfo.iconData) {
            const img = document.createElement('img');
            img.src = iconInfo.iconData;
            img.style.width = '18px';
            img.style.height = '18px';
            img.alt = '';
            link.appendChild(img);
        } else {
            const iconElem = document.createElement('i');
            iconElem.className = `${iconInfo.icon} ${iconInfo.iconClass}`;
            iconElem.style.color = iconInfo.color;
            link.appendChild(iconElem);
        }

        const titleSpan = document.createElement('span');
        titleSpan.style.fontWeight = '600';
        titleSpan.textContent = String(item.fields['System.Title'] || '');
        link.appendChild(titleSpan);

        const progressSpan = document.createElement('span');
        progressSpan.style.fontWeight = 'bold';
        progressSpan.style.marginLeft = '0.5rem';
        progressSpan.textContent = `${progress}%`;

        header.appendChild(link);
        header.appendChild(progressSpan);

        const barBg = document.createElement('div');
        barBg.className = 'progress-bar-bg';

        const barFill = document.createElement('div');
        barFill.className = 'progress-bar-fill';
        barFill.style.width = `${progress}%`;
        barFill.style.background = statusInfo.color;

        barBg.appendChild(barFill);

        card.appendChild(header);
        card.appendChild(barBg);

        progressList.appendChild(card);
    });
}
