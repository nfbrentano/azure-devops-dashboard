/**
 * Utility functions for Azure DevOps Dashboard
 */
import type { AzureConfig, WorkItemMetadata, WorkItemNode, StatusInfo, IconInfo } from './types.ts';

export function escapeHtml(str: unknown): string {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Legacy salt only retained for non-destructive migration of previously encrypted PATs
const LEGACY_SALT = new Uint8Array([71, 101, 109, 105, 110, 105, 32, 65, 105, 32, 82, 111, 99, 107, 115, 33]);

async function getEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as unknown as BufferSource,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptPAT(pat: string, password: string): Promise<string> {
    if (!pat || !password) return pat;
    try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await getEncryptionKey(password, salt);
        const encoder = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(pat));

        const saltBase64 = btoa(String.fromCharCode(...salt));
        const ivBase64 = btoa(String.fromCharCode(...iv));
        const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        return `v2:${saltBase64}:${ivBase64}:${encryptedBase64}`;
    } catch (e) {
        console.error('Encryption failed:', e);
        return pat;
    }
}

export async function decryptPAT(enc: string, password?: string): Promise<string | null> {
    if (!enc) return enc;

    // Format v2 (v2:saltBase64:ivBase64:encryptedBase64)
    if (enc.startsWith('v2:')) {
        if (!password) return null;
        try {
            const parts = enc.split(':');
            if (parts.length !== 4) return null;
            const [, saltBase64, ivBase64, encryptedBase64] = parts;
            const salt = new Uint8Array(
                atob(saltBase64)
                    .split('')
                    .map((c) => c.charCodeAt(0))
            );
            const iv = new Uint8Array(
                atob(ivBase64)
                    .split('')
                    .map((c) => c.charCodeAt(0))
            );
            const encrypted = new Uint8Array(
                atob(encryptedBase64)
                    .split('')
                    .map((c) => c.charCodeAt(0))
            );
            const key = await getEncryptionKey(password, salt);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error('Decryption failed:', e);
            return null;
        }
    }

    // Legacy v1 format (ivBase64:encryptedBase64)
    if (enc.includes(':')) {
        if (!password) return null;
        try {
            const [ivBase64, encryptedBase64] = enc.split(':');
            const iv = new Uint8Array(
                atob(ivBase64)
                    .split('')
                    .map((c) => c.charCodeAt(0))
            );
            const encrypted = new Uint8Array(
                atob(encryptedBase64)
                    .split('')
                    .map((c) => c.charCodeAt(0))
            );
            const key = await getEncryptionKey(password, LEGACY_SALT);

            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error('Decryption failed:', e);
            return null;
        }
    }

    // Return unencrypted plaintext directly if not encrypted
    return enc;
}

/**
 * Helper to identify whether a work item type is a requirement/story level item.
 */
export function isRequirementType(type: string, workItemMetadata?: WorkItemMetadata): boolean {
    const t = (type || '').toLowerCase();
    if (workItemMetadata?.backlogs) {
        const reqBacklog = workItemMetadata.backlogs.find((b) => b.name.toLowerCase().includes('requirement'));
        if (reqBacklog?.workItemTypes?.map((x) => x.toLowerCase()).includes(t)) {
            return true;
        }
    }
    return ['user story', 'product backlog item', 'requirement', 'issue'].includes(t);
}

export function getWorkItemUrl(azureConfig: AzureConfig | null, id: number | string, projectName?: string): string {
    if (!azureConfig) return '#';
    const project = projectName || azureConfig.project;
    return `https://dev.azure.com/${azureConfig.org}/${project}/_workitems/edit/${id}`;
}

export function getStatusInfo(stateName: string, workItemMetadata: WorkItemMetadata): StatusInfo {
    const s = (stateName || '').toLowerCase();
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

export function getItemIcon(type: string, workItemMetadata: WorkItemMetadata): IconInfo {
    const t = (type || '').toLowerCase();
    const meta = workItemMetadata.types[t];

    // Determine if it's a portfolio item based on backlog levels or common types
    const isPortfolio =
        workItemMetadata.backlogs.some((b) => b.type === 'portfolio' && b.workItemTypes.includes(t)) ||
        t === 'epic' ||
        t === 'feature';

    // Basic defaults with dynamic color
    const base: IconInfo = {
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

export function calculateProgress(item: WorkItemNode, workItemMetadata: WorkItemMetadata): number {
    const descendants: WorkItemNode[] = [];
    const collectLeafNodes = (node: WorkItemNode): void => {
        const children = node.allChildren || node.children;
        if (!children || children.length === 0) {
            descendants.push(node);
        } else {
            children.forEach(collectLeafNodes);
        }
    };

    collectLeafNodes(item);

    if (descendants.length === 0) return 0;

    let totalWeight = 0;
    descendants.forEach((d) => {
        const state = (d.fields['System.State'] || '').toLowerCase();

        // Specific user request for "resolved" to be 50%
        if (state === 'resolved') {
            totalWeight += 0.5;
            return;
        }

        const info = getStatusInfo(d.fields['System.State'], workItemMetadata);
        if (info.label === 'Done' || info.label === 'Removed') {
            totalWeight += 1.0;
        }
    });

    return Math.floor((totalWeight / descendants.length) * 100);
}

export function showLoading(show = true, progress: number | null = null): void {
    const loading = document.getElementById('loading');
    if (!loading) return;

    if (show) {
        loading.classList.remove('hidden');
        if (progress !== null) {
            updateLoadingProgress(progress);
        }
    } else {
        loading.classList.add('hidden');
        updateLoadingProgress(0); // Reset for next time
        // Reset all steps to pending
        (['step-queries', 'step-items', 'step-revisions'] as const).forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.className = 'loading-step step-pending';
        });
        setLoadingStatus('');
    }
}

/**
 * Updates the status label text inside the loading overlay.
 */
export function setLoadingStatus(text: string): void {
    const el = document.getElementById('loading-status-label');
    if (el) el.textContent = text || 'Carregando...';
}

/**
 * Marks a loading step as active or done.
 */
export function setLoadingStep(
    stepId: 'step-queries' | 'step-items' | 'step-revisions',
    stepState: 'active' | 'done' | 'pending'
): void {
    const el = document.getElementById(stepId);
    if (!el) return;
    el.className = `loading-step step-${stepState}`;
}

export function updateLoadingProgress(percentage: number): void {
    const container = document.getElementById('loading-progress-container');
    const fill = document.getElementById('loading-progress-fill') as HTMLElement | null;
    const text = document.getElementById('loading-progress-text');

    if (!container || !fill || !text) return;

    if (percentage > 0) {
        container.classList.remove('hidden');
        const p = Math.min(100, Math.max(0, percentage));
        fill.style.width = `${p}%`;
        text.textContent = `${Math.round(p)}%`;
    } else {
        container.classList.add('hidden');
        fill.style.width = '0%';
        text.textContent = '0%';
    }
}

export function showToast(message: string, type: 'error' | 'success' | 'info' | 'warning' = 'error'): void {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ph-info';
    let color = 'var(--primary)';

    if (type === 'error') {
        icon = 'ph-fill ph-x-circle';
        color = '#ef4444';
    } else if (type === 'success') {
        icon = 'ph-fill ph-check-circle';
        color = '#10b981';
    } else if (type === 'info') {
        icon = 'ph-fill ph-info';
        color = '#3b82f6';
    }

    const iconElem = document.createElement('i');
    iconElem.className = icon;
    iconElem.style.color = color;
    iconElem.style.fontSize = '1.25rem';
    iconElem.style.flexShrink = '0';

    const textElem = document.createElement('span');
    textElem.textContent = message;

    toast.appendChild(iconElem);
    toast.appendChild(textElem);

    container.appendChild(toast);

    // Auto remove after 5 seconds
    const timeout = setTimeout(() => {
        toast.style.animation = 'toast-fade-out 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 301);
    }, 5000);

    // Allow manual dismiss on click
    toast.addEventListener('click', () => {
        clearTimeout(timeout);
        toast.style.animation = 'toast-fade-out 0.2s ease-in forwards';
        setTimeout(() => toast.remove(), 201);
    });
}
