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
        Array.from(document.querySelectorAll('#portfolio-status-filters input:checked')).map((cb) => (cb as HTMLInputElement).value)
    );

    const filteredItems = items.filter((item) => {
        const iconInfo = getItemIcon(item.fields['System.WorkItemType'] as string, workItemMetadata);
        const state = item.fields['System.State'] as string;
        return iconInfo.isPortfolio && activeFilters.has(state);
    });

    if (filteredItems.length === 0) {
        progressList.innerHTML = `<div style="text-align: center; opacity: 0.5; font-size: 0.8rem; padding: 1rem;">${translations[currentLanguage]['msg-portfolio-empty']}</div>`;
        return;
    }

    filteredItems.forEach((item) => {
        const progress = calculateProgress(item, workItemMetadata);
        const iconInfo = getItemIcon(item.fields['System.WorkItemType'] as string, workItemMetadata);
        const statusInfo = getStatusInfo(item.fields['System.State'] as string, workItemMetadata);
        const card = document.createElement('div');
        card.className = 'progress-item';

        let iconHtml = `<i class="${iconInfo.icon} ${iconInfo.iconClass}" style="color: ${iconInfo.color}"></i>`;
        if (iconInfo.iconData) {
            iconHtml = `<img src="${iconInfo.iconData}" style="width: 18px; height: 18px;" alt="">`;
        }

        card.innerHTML = `
            <div class="progress-header">
                <a href="${getWorkItemUrl(azureConfig, item.id)}" target="_blank" class="item-link" style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                    ${iconHtml}
                    <span style="font-weight: 600;">${String(item.fields['System.Title'] || '')}</span>
                </a>
                <span style="font-weight: bold; margin-left: 0.5rem;">${progress}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progress}%; background: ${statusInfo.color}"></div>
            </div>
        `;
        progressList.appendChild(card);
    });
}
