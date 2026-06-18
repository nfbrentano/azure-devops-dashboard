/**
 * UI Orchestration for Azure DevOps Dashboard
 */
import { translations } from './translations.ts';
import { renderLegends } from './charts/index.ts';
import type { DashboardElements, WorkItemMetadata } from './types.ts';

export function switchTab(tabId: string, elements: DashboardElements) {
    const { tabDashboard, tabItems, tabTimeline, tabSetup, dashboardView, itemsView, timelineView, setupView, unlockView, dataControls } =
        elements;

    tabDashboard?.classList.toggle('active', tabId === 'dashboard');
    tabItems?.classList.toggle('active', tabId === 'items');
    tabTimeline?.classList.toggle('active', tabId === 'timeline');
    tabSetup?.classList.toggle('active', tabId === 'setup');
    dashboardView?.classList.toggle('hidden', tabId !== 'dashboard');
    itemsView?.classList.toggle('hidden', tabId !== 'items');
    timelineView?.classList.toggle('hidden', tabId !== 'timeline');
    setupView?.classList.toggle('hidden', tabId !== 'setup');
    unlockView?.classList.toggle('hidden', tabId !== 'unlock');
    dataControls?.classList.toggle('hidden', tabId === 'setup' || tabId === 'unlock');

    // Hide tabs if in setup or unlock
    const tabs = document.querySelector('.tabs') as HTMLElement | null;
    if (tabs) tabs.style.display = tabId === 'setup' || tabId === 'unlock' ? 'none' : 'flex';
}

export function updateThemeIcon(themeToggle: HTMLButtonElement | null, currentTheme: 'dark' | 'light') {
    const icon = themeToggle?.querySelector('i');
    if (icon) {
        icon.className = currentTheme === 'dark' ? 'ph ph-sun-dim' : 'ph ph-moon-stars';
    }
}

export interface ApplyTranslationsOptions {
    currentLanguage: string;
    currentData: {
        items: any[];
        tree: any[];
        revisions?: any;
    };
    workItemMetadata: WorkItemMetadata;
    langToggle: HTMLButtonElement | null;
    themeToggle: HTMLButtonElement | null;
    refreshBtn: HTMLButtonElement | null;
    querySelector: HTMLSelectElement | null;
    callRenderGantt?: () => void;
}

export function applyTranslations(options: ApplyTranslationsOptions) {
    const {
        currentLanguage,
        currentData,
        workItemMetadata,
        langToggle,
        themeToggle,
        refreshBtn,
        querySelector,
        callRenderGantt
    } = options;

    const lang = translations[currentLanguage];
    document.documentElement.lang = currentLanguage.split('-')[0];

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (key && lang[key]) {
            const icon = el.querySelector('i, img');
            if (icon) {
                let foundTextNode = false;
                Array.from(el.childNodes).forEach((node) => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim() !== '') {
                        node.textContent = ' ' + lang[key];
                        foundTextNode = true;
                    }
                });
                if (!foundTextNode) el.appendChild(document.createTextNode(' ' + lang[key]));
            } else {
                el.innerHTML = lang[key];
            }
        }
    });

    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        const key = el.getAttribute('data-i18n-aria');
        if (key && lang[key]) {
            el.setAttribute('aria-label', lang[key]);
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && lang[key]) {
            el.setAttribute('placeholder', lang[key]);
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const key = el.getAttribute('data-i18n-title');
        if (key && lang[key]) {
            el.setAttribute('title', lang[key]);
        }
    });

    if (langToggle) {
        langToggle.title = lang['lang-toggle-title'];
        const span = langToggle.querySelector('span');
        if (span) span.textContent = currentLanguage === 'pt-br' ? 'EN' : 'PT';
    }

    if (themeToggle) themeToggle.title = lang['theme-toggle-title'];
    if (refreshBtn) refreshBtn.title = lang['refresh-btn-title'];
    if (querySelector) {
        querySelector.setAttribute('title', lang['query-selector-placeholder']);
    }

    if (currentData.tree.length > 0 && callRenderGantt) callRenderGantt();
    renderLegends(currentData.items, workItemMetadata, translations, currentLanguage);
}

export function showEmptyState(show: boolean) {
    const dashboardEmpty = document.getElementById('dashboard-empty-state');
    const dashboardContent = document.getElementById('dashboard-content');
    const itemsEmpty = document.getElementById('items-empty-state');
    const itemsContent = document.getElementById('items-content');

    if (show) {
        dashboardEmpty?.classList.remove('hidden');
        dashboardContent?.classList.add('hidden');
        itemsEmpty?.classList.remove('hidden');
        itemsContent?.classList.add('hidden');
    } else {
        dashboardEmpty?.classList.add('hidden');
        dashboardContent?.classList.remove('hidden');
        itemsEmpty?.classList.add('hidden');
        itemsContent?.classList.remove('hidden');
    }
}

export function populateQueries(queries: any[] | null, querySelector: HTMLSelectElement | null, currentLanguage: string) {
    if (!querySelector) return;
    const currentVal = querySelector.value;
    const lang = translations[currentLanguage];
    querySelector.innerHTML = `<option value="">${lang['query-selector-placeholder']}</option>`;
    if (!queries) return;
    queries
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((q) => {
            const option = document.createElement('option');
            option.value = q.id;
            option.textContent = q.name;
            querySelector.appendChild(option);
        });
    if (currentVal) querySelector.value = currentVal;
}
