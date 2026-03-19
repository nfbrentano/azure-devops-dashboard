/**
 * Utility functions for Azure DevOps Dashboard
 */

export function encryptPAT(pat) {
    if (!pat) return pat;
    return btoa(pat.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ 42)).join(''));
}

export function decryptPAT(enc) {
    if (!enc) return enc;
    try {
        return atob(enc).split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ 42)).join('');
    } catch {
        return enc;
    }
}

export function getWorkItemUrl(azureConfig, id) {
    if (!azureConfig) return '#';
    return `https://dev.azure.com/${azureConfig.org}/${azureConfig.project}/_workitems/edit/${id}`;
}

export function getStatusInfo(state, workItemMetadata) {
    const s = (state || '').toLowerCase();
    const meta = workItemMetadata.states[s];
    
    if (meta) {
        if (meta.category === 'Completed') return { label: 'Done', class: 'bg-done', color: meta.color };
        if (meta.category === 'Removed') return { label: 'Removed', class: 'bg-removed', color: meta.color };
        if (meta.category === 'InProgress') return { label: 'In Progress', class: 'bg-inprogress', color: meta.color };
        return { label: 'Backlog', class: 'bg-backlog', color: meta.color };
    }

    // Fallback logic
    if (['done', 'closed', 'resolved', 'concluído', 'concluido'].includes(s)) {
        return { label: 'Done', class: 'bg-done', color: '#10b981' };
    }
    if (['removed', 'removido'].includes(s)) {
        return { label: 'Removed', class: 'bg-removed', color: '#64748b' };
    }
    if (['active', 'in progress', 'committed', 'doing', 'em progresso', 'ativo'].includes(s)) {
        return { label: 'In Progress', class: 'bg-inprogress', color: '#0078d4' };
    }
    return { label: 'Backlog', class: 'bg-backlog', color: '#b2b2b2' };
}

export function getItemIcon(type, workItemMetadata) {
    const t = type.toLowerCase();
    const meta = workItemMetadata.types[t];
    
    // Determine if it's a portfolio item based on backlog levels or common types
    const isPortfolio = workItemMetadata.backlogs.some(b => b.type === 'portfolio' && b.workItemTypes.includes(t)) || 
                        t === 'epic' || t === 'feature';
    
    // Basic defaults with dynamic color
    const base = { 
        icon: 'ph-fill ph-square', 
        iconClass: '', 
        isPortfolio,
        color: meta?.color || '#64748b',
        iconData: meta?.iconData || null
    };

    if (t === 'epic') return { ...base, icon: 'ph-fill ph-crown', iconClass: 'icon-epic' };
    if (t === 'feature') return { ...base, icon: 'ph-fill ph-trophy', iconClass: 'icon-feature' };
    if (t.includes('requirement') || t === 'user story' || t === 'product backlog item' || t === 'issue') {
        return { ...base, icon: 'ph-fill ph-notebook', iconClass: 'icon-userstory' };
    }
    if (t === 'task') return { ...base, icon: 'ph-fill ph-check-square', iconClass: 'icon-task' };
    if (t === 'bug') return { ...base, icon: 'ph-fill ph-bug', iconClass: 'icon-bug' };
    
    return base;
}

export function calculateProgress(item, workItemMetadata) {
    if (!item.children || item.children.length === 0) {
        const state = item.fields['System.State'];
        const info = getStatusInfo(state, workItemMetadata);
        return (info.label === 'Done') ? 100 : 0;
    }
    const totalChildren = item.children.length;
    const completedChildren = item.children.filter(child => {
        const state = child.fields['System.State'];
        const info = getStatusInfo(state, workItemMetadata);
        return info.label === 'Done';
    }).length;
    return Math.floor((completedChildren / totalChildren) * 100);
}

export function showLoading(container) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<i class="ph ph-circle-notch spinning" style="font-size: 2rem; color: var(--primary);"></i>';
    container.style.position = 'relative';
    container.appendChild(overlay);
    return overlay;
}
