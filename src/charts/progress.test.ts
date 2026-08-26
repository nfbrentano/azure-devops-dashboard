import { describe, it, expect, beforeEach } from 'vitest';
import { renderProgress } from './progress.ts';
import type { WorkItemNode, WorkItemMetadata, AzureConfig } from '../types.ts';

describe('progress.ts', () => {
    let container: HTMLElement;
    const translations = {
        en: {
            'msg-portfolio-empty': 'No portfolio items found'
        }
    };
    const mockMetadata: WorkItemMetadata = {
        types: {
            Epic: { color: '#ff5722' }
        },
        states: {
            Active: { category: 'InProgress', color: '#0078d4' },
            Done: { category: 'Completed', color: '#10b981' }
        },
        backlogs: [{ name: 'Epics', type: 'portfolio', workItemTypes: ['Epic'] }]
    } as unknown as WorkItemMetadata;

    const mockConfig: AzureConfig = {
        org: 'my-org',
        project: 'my-project',
        pat: 'pat'
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="portfolio-status-filters">
                <input type="checkbox" value="Active" checked />
                <input type="checkbox" value="Done" checked />
            </div>
            <div id="progress-list"></div>
        `;
        container = document.getElementById('progress-list')!;
    });

    it('should display empty message when there are no matching items', () => {
        renderProgress([], container, translations, 'en', mockMetadata, mockConfig);
        expect(container.textContent).toContain('No portfolio items found');
    });

    it('should render progress items safely with textContent and proper DOM elements', () => {
        const items: WorkItemNode[] = [
            {
                id: 101,
                fields: {
                    'System.WorkItemType': 'Epic',
                    'System.State': 'Active',
                    'System.Title': '<img src=x onerror=alert(1)>Malicious Title'
                },
                children: []
            } as unknown as WorkItemNode
        ];

        renderProgress(items, container, translations, 'en', mockMetadata, mockConfig);

        const card = container.querySelector('.progress-item');
        expect(card).not.toBeNull();

        const link = card?.querySelector('a.item-link') as HTMLAnchorElement;
        expect(link).not.toBeNull();
        expect(link.href).toContain('101');

        // Check that System.Title was safely inserted as text without creating HTML img element
        expect(card?.querySelector('img')).toBeNull();
        expect(card?.textContent).toContain('<img src=x onerror=alert(1)>Malicious Title');
        expect(card?.querySelector('.progress-bar-fill')).not.toBeNull();
    });
});
