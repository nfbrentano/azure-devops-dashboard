import { describe, it, expect } from 'vitest';
import { calculateProgress, getStatusInfo, getItemIcon, encryptPAT, decryptPAT, escapeHtml, showToast, isRequirementType } from './utils.ts';
import type { WorkItemMetadata, WorkItemNode } from './types.ts';

describe('utils.ts', () => {
    describe('escapeHtml', () => {
        it('should escape &, <, >, ", and single quotes', () => {
            expect(escapeHtml('<script>alert("XSS" & \'test\')</script>')).toBe(
                '&lt;script&gt;alert(&quot;XSS&quot; &amp; &#39;test&#39;)&lt;/script&gt;'
            );
        });

        it('should return empty string for null and undefined', () => {
            expect(escapeHtml(null)).toBe('');
            expect(escapeHtml(undefined)).toBe('');
        });

        it('should handle numbers and boolean values safely', () => {
            expect(escapeHtml(123)).toBe('123');
            expect(escapeHtml(false)).toBe('false');
        });
    });
    const mockMetadata = {
        types: {
            epic: { color: '#ff0000' },
            feature: { color: '#00ff00' },
            'user story': { color: '#0000ff' },
            task: { color: '#cccccc' }
        },
        states: {
            done: { category: 'Completed', color: '#10b981' },
            closed: { category: 'Completed', color: '#10b981' },
            resolved: { category: 'InProgress', color: '#0078d4' }, // Specific case
            active: { category: 'InProgress', color: '#0078d4' },
            new: { category: 'Proposed', color: '#b2b2b2' }
        },
        backlogs: [
            { name: 'Epics', type: 'portfolio', workItemTypes: ['epic'] },
            { name: 'Features', type: 'portfolio', workItemTypes: ['feature'] },
            { name: 'Stories', type: 'requirement', workItemTypes: ['user story'] }
        ]
    } as unknown as WorkItemMetadata;

    describe('getStatusInfo', () => {
        it('should return correct info for mapped states', () => {
            const result = getStatusInfo('Done', mockMetadata);
            expect(result.label).toBe('Done');
            expect(result.class).toBe('bg-done');
        });

        it('should return correct info for Removed state', () => {
            const result = getStatusInfo('Removed', mockMetadata);
            expect(result.label).toBe('Removed');
            expect(result.class).toBe('bg-removed'); // Corrected from bg-done
        });

        it('should return fallback info for unmapped states', () => {
            const result = getStatusInfo('SomeRandomState', mockMetadata);
            expect(result.label).toBe('Backlog');
        });

        it('should handle "Resolved" specifically in fallback if needed', () => {
            // If not in metadata, it uses internal fallback
            const emptyMeta = { types: {}, states: {}, backlogs: [] } as unknown as WorkItemMetadata;
            const result = getStatusInfo('Resolved', emptyMeta);
            expect(result.label).toBe('Done'); // Fallback says Done for resolved
        });
    });

    describe('calculateProgress', () => {
        it('should return 0 for leaf items with no children', () => {
            const item = { fields: { 'System.State': 'New' } } as unknown as WorkItemNode;
            expect(calculateProgress(item, mockMetadata)).toBe(0);
        });

        it('should calculate progress for simple hierarchy (50%)', () => {
            const item = {
                children: [{ fields: { 'System.State': 'Done' } }, { fields: { 'System.State': 'New' } }]
            } as unknown as WorkItemNode;
            expect(calculateProgress(item, mockMetadata)).toBe(50);
        });

        it('should count "Removed" as 100% (same as Done)', () => {
            const item = {
                children: [{ fields: { 'System.State': 'Removed' } }, { fields: { 'System.State': 'New' } }]
            } as unknown as WorkItemNode;
            expect(calculateProgress(item, mockMetadata)).toBe(50);
        });

        it('should handle "Resolved" as 50% specifically', () => {
            const item = {
                children: [{ fields: { 'System.State': 'Resolved' } }]
            } as unknown as WorkItemNode;
            // Resolved is hardcoded to 0.5 in calculateProgress
            expect(calculateProgress(item, mockMetadata)).toBe(50);
        });

        it('should work recursively for deep hierarchies', () => {
            const item = {
                children: [
                    {
                        children: [
                            { fields: { 'System.State': 'Done' } }, // 1.0
                            { fields: { 'System.State': 'Removed' } } // 1.0
                        ]
                    },
                    { fields: { 'System.State': 'New' } } // 0.0
                ]
            } as unknown as WorkItemNode;
            // Leaves are: Done(1), Removed(1), New(0)
            // Total = (1 + 1 + 0) / 3 = 2 / 3 = 0.666... (66% with Math.floor)
            expect(calculateProgress(item, mockMetadata)).toBe(66);
        });

        it('should prefer allChildren over children if present', () => {
            const item = {
                allChildren: [{ fields: { 'System.State': 'Done' } }],
                children: [] // Filtered out
            } as unknown as WorkItemNode;
            expect(calculateProgress(item, mockMetadata)).toBe(100);
        });
    });

    describe('getItemIcon', () => {
        it('should return correct icon for Epic', () => {
            const result = getItemIcon('Epic', mockMetadata);
            expect(result.icon).toContain('ph-crown');
            expect(result.isPortfolio).toBe(true);
        });

        it('should return correct icon for Task', () => {
            const result = getItemIcon('Task', mockMetadata);
            expect(result.icon).toContain('ph-check-square');
            expect(result.isPortfolio).toBe(false);
        });
    });

    describe('isRequirementType', () => {
        it('should identify standard agile/scrum requirement types', () => {
            expect(isRequirementType('User Story')).toBe(true);
            expect(isRequirementType('Product Backlog Item')).toBe(true);
            expect(isRequirementType('Requirement')).toBe(true);
            expect(isRequirementType('Issue')).toBe(true);
            expect(isRequirementType('Task')).toBe(false);
            expect(isRequirementType('Epic')).toBe(false);
        });

        it('should respect workItemMetadata requirement backlog types', () => {
            const customMeta = {
                backlogs: [{ name: 'Custom Requirement Backlog', type: 'requirement', workItemTypes: ['Story', 'Enabler'] }]
            } as unknown as WorkItemMetadata;
            expect(isRequirementType('Enabler', customMeta)).toBe(true);
            expect(isRequirementType('Story', customMeta)).toBe(true);
            expect(isRequirementType('Bug', customMeta)).toBe(false);
        });
    });

    describe('encryptPAT and decryptPAT', () => {
        const testPAT = 'my-super-secret-pat';
        const password = 'my-secure-password';

        it('should encrypt with v2 format and decrypt correctly', async () => {
            const encrypted = await encryptPAT(testPAT, password);
            expect(encrypted.startsWith('v2:')).toBe(true);
            const parts = encrypted.split(':');
            expect(parts.length).toBe(4); // v2, salt, iv, encrypted

            const decrypted = await decryptPAT(encrypted, password);
            expect(decrypted).toBe(testPAT);
        });

        it('should produce unique ciphertexts and salts for the same input (random salt)', async () => {
            const enc1 = await encryptPAT(testPAT, password);
            const enc2 = await encryptPAT(testPAT, password);
            expect(enc1).not.toBe(enc2);

            const decrypted1 = await decryptPAT(enc1, password);
            const decrypted2 = await decryptPAT(enc2, password);
            expect(decrypted1).toBe(testPAT);
            expect(decrypted2).toBe(testPAT);
        });

        it('should return empty/original if pat or password is empty', async () => {
            expect(await encryptPAT('', password)).toBe('');
            expect(await encryptPAT(testPAT, '')).toBe(testPAT);
            expect(await decryptPAT('', password)).toBe('');
        });

        it('should return null if decrypted with wrong password', async () => {
            const encrypted = await encryptPAT(testPAT, password);
            const decrypted = await decryptPAT(encrypted, 'wrong-password');
            expect(decrypted).toBeNull();
        });

        it('should support legacy v1 format (iv:ciphertext) seamlessly', async () => {
            // Legacy encryption simulation using legacy salt
            const encoder = new TextEncoder();
            const legacySalt = new Uint8Array([71, 101, 109, 105, 110, 105, 32, 65, 105, 32, 82, 111, 99, 107, 115, 33]);
            const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
            const key = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt: legacySalt as unknown as BufferSource, iterations: 100000, hash: 'SHA-256' },
                baseKey,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(testPAT));
            const v1Format = `${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...new Uint8Array(encrypted)))}`;

            const decrypted = await decryptPAT(v1Format, password);
            expect(decrypted).toBe(testPAT);
        });
    });

    describe('showToast', () => {
        it('should create toast element safely with textContent and correct icon', () => {
            document.body.innerHTML = '';
            showToast('An error occurred: <img src=x onerror=alert(1)>', 'error');

            const container = document.querySelector('.toast-container');
            expect(container).not.toBeNull();

            const toast = container?.querySelector('.toast.error');
            expect(toast).not.toBeNull();

            const icon = toast?.querySelector('i');
            expect(icon?.className).toBe('ph-fill ph-x-circle');

            const span = toast?.querySelector('span');
            expect(span?.textContent).toBe('An error occurred: <img src=x onerror=alert(1)>');
            expect(toast?.querySelector('img')).toBeNull();
        });
    });
});
