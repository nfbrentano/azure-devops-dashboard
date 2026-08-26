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
        const childCount = item.allChildren ? item.allChildren.length : 0;
        
        const card = document.createElement('div');
        card.className = 'progress-item';
        card.style.borderLeftColor = statusInfo.color;

        const header = document.createElement('div');
        header.className = 'progress-header';

        const wrapper = document.createElement('div');
        wrapper.className = 'progress-item-title-wrapper';

        const titleRow = document.createElement('div');
        titleRow.className = 'progress-title-row';

        if (iconInfo.iconData) {
            const img = document.createElement('img');
            img.src = iconInfo.iconData;
            img.style.width = '16px';
            img.style.height = '16px';
            img.alt = '';
            titleRow.appendChild(img);
        } else {
            const iconElem = document.createElement('i');
            iconElem.className = `${iconInfo.icon} ${iconInfo.iconClass}`;
            iconElem.style.color = iconInfo.color;
            iconElem.style.fontSize = '1.1rem';
            titleRow.appendChild(iconElem);
        }

        const link = document.createElement('a');
        link.href = getWorkItemUrl(azureConfig, item.id);
        link.target = '_blank';
        link.className = 'item-link progress-title-text';
        link.textContent = String(item.fields['System.Title'] || '');
        link.title = String(item.fields['System.Title'] || '');
        titleRow.appendChild(link);
        
        wrapper.appendChild(titleRow);

        // Status pill & Child count row
        const metaRow = document.createElement('div');
        metaRow.style.display = 'flex';
        metaRow.style.gap = '0.5rem';
        metaRow.style.alignItems = 'center';
        
        const statusBadge = document.createElement('div');
        statusBadge.style.display = 'flex';
        statusBadge.style.alignItems = 'center';
        statusBadge.style.gap = '0.3rem';
        statusBadge.style.fontSize = '0.7rem';
        statusBadge.style.color = 'var(--text-muted)';
        
        const dot = document.createElement('div');
        dot.style.width = '6px';
        dot.style.height = '6px';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = statusInfo.color;
        
        const stateText = document.createElement('span');
        stateText.textContent = item.fields['System.State'] as string;
        
        statusBadge.appendChild(dot);
        statusBadge.appendChild(stateText);
        metaRow.appendChild(statusBadge);

        if (childCount > 0) {
            const childBadge = document.createElement('div');
            childBadge.style.fontSize = '0.7rem';
            childBadge.style.color = 'var(--text-muted)';
            childBadge.style.display = 'flex';
            childBadge.style.alignItems = 'center';
            childBadge.style.gap = '0.2rem';
            childBadge.innerHTML = `<i class="ph ph-files"></i> ${childCount}`;
            childBadge.title = `Total Items: ${childCount}`;
            metaRow.appendChild(childBadge);
        }
        
        wrapper.appendChild(metaRow);

        const progressBadge = document.createElement('div');
        progressBadge.className = 'progress-badge';
        progressBadge.textContent = `${progress}%`;

        header.appendChild(wrapper);
        header.appendChild(progressBadge);

        const barBg = document.createElement('div');
        barBg.className = 'progress-bar-bg';

        const barFill = document.createElement('div');
        barFill.className = 'progress-bar-fill';
        
        // Use a tiny timeout to allow CSS animation to run from 0 to width
        setTimeout(() => {
            barFill.style.width = `${progress}%`;
        }, 50);

        barBg.appendChild(barFill);

        card.appendChild(header);
        card.appendChild(barBg);

        progressList.appendChild(card);
    });
}
