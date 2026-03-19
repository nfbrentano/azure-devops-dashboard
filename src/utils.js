/**
 * Utility functions for Azure DevOps Dashboard
 */

// Encryption constants
const ENCRYPTION_SECRET = 'azure-devops-dashboard-secret-2026';
const SALT = new Uint8Array([71, 101, 109, 105, 110, 105, 32, 65, 105, 32, 82, 111, 99, 107, 115, 33]); // 'Gemini Ai Rocks!'

async function getEncryptionKey() {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        'raw', 
        encoder.encode(ENCRYPTION_SECRET), 
        'PBKDF2', 
        false, 
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: SALT,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptPAT(pat) {
    if (!pat) return pat;
    try {
        const key = await getEncryptionKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(pat)
        );
        
        const ivBase64 = btoa(String.fromCharCode(...iv));
        const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        return `${ivBase64}:${encryptedBase64}`;
    } catch (e) {
        console.error('Encryption failed:', e);
        return pat;
    }
}

export async function decryptPAT(enc) {
    if (!enc) return enc;
    
    // Check if it's the new format (base64:base64)
    if (enc.includes(':')) {
        try {
            const [ivBase64, encryptedBase64] = enc.split(':');
            const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
            const encrypted = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
            const key = await getEncryptionKey();
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encrypted
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error('Decryption failed, falling back to original:', e);
            return enc;
        }
    }

    // Backward compatibility with XOR(42) + base64
    try {
        const xorDecoded = atob(enc).split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ 42)).join('');
        // If it looks like a PAT (mostly alphanumeric), it's probably correct
        if (/^[a-z0-9]+$/i.test(xorDecoded)) {
            return xorDecoded;
        }
        return enc;
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

export function showToast(message, type = 'error') {
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
    
    toast.innerHTML = `
        <i class="${icon}" style="color: ${color}; font-size: 1.25rem; flex-shrink: 0;"></i>
        <span>${message}</span>
    `;

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
