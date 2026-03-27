// @ts-nocheck
/**
 * UI Orchestration for Azure DevOps Dashboard
 */
import { translations } from './translations.ts';
import { renderLegends } from './charts.ts';

export function switchTab(tabId, elements) {
    const { 
        tabDashboard, tabItems, tabSetup, dashboardView, 
        itemsView, setupView, unlockView, dataControls 
    } = elements;

    tabDashboard.classList.toggle('active', tabId === 'dashboard');
    tabItems.classList.toggle('active', tabId === 'items');
    tabSetup.classList.toggle('active', tabId === 'setup');
    dashboardView.classList.toggle('hidden', tabId !== 'dashboard');
    itemsView.classList.toggle('hidden', tabId !== 'items');
    setupView.classList.toggle('hidden', tabId !== 'setup');
    unlockView.classList.toggle('hidden', tabId !== 'unlock');
    dataControls.classList.toggle('hidden', tabId === 'setup' || tabId === 'unlock');
    
    // Hide tabs if in setup or unlock
    const tabs = document.querySelector('.tabs');
    if (tabs) tabs.style.display = (tabId === 'setup' || tabId === 'unlock') ? 'none' : 'flex';
}

export function updateThemeIcon(themeToggle, currentTheme) {
    const icon = themeToggle.querySelector('i');
    if (icon) {
        icon.className = currentTheme === 'dark' ? 'ph ph-sun-dim' : 'ph ph-moon-stars';
    }
}

export function applyTranslations(options) {
    const { 
        currentLanguage, currentData, workItemMetadata, 
        langToggle, themeToggle, refreshBtn, querySelector, 
        callRenderGantt 
    } = options;

    const lang = translations[currentLanguage];
    document.documentElement.lang = currentLanguage.split('-')[0]; 
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (lang[key]) {
            const icon = el.querySelector('i, img');
            if (icon) {
                let foundTextNode = false;
                Array.from(el.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
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

    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (lang[key]) {
            el.setAttribute('aria-label', lang[key]);
        }
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (lang[key]) {
            el.setAttribute('placeholder', lang[key]);
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (lang[key]) {
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

export function showEmptyState(show) {
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

export function populateQueries(queries, querySelector, currentLanguage) {
    const currentVal = querySelector.value;
    const lang = translations[currentLanguage];
    querySelector.innerHTML = `<option value="">${lang['query-selector-placeholder']}</option>`;
    queries.sort((a, b) => a.name.localeCompare(b.name)).forEach(q => {
        const option = document.createElement('option');
        option.value = q.id;
        option.textContent = q.name;
        querySelector.appendChild(option);
    });
    if (currentVal) querySelector.value = currentVal;
}
