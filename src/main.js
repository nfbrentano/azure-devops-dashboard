/**
 * Main Entry Point for Azure DevOps Dashboard
 * Refactored into modules and centralized state.
 */

// Imports
import './style.css';
import { translations } from './translations.js';
import { state } from './state.js';
import { 
    encryptPAT, decryptPAT, getWorkItemUrl, getStatusInfo, 
    getItemIcon, calculateProgress, showLoading, showToast 
} from './utils.js';
import { 
    fetchQueries, fetchFullDetails, fetchMetadata, buildTree 
} from './api.js';
import { 
    renderCharts, renderThroughputChart, renderAgingChart, 
    renderAssigneeChart, renderCFDChart, renderPortfolioFilters, 
    renderProgress, renderLegends 
} from './charts.js';
import { renderGantt } from './gantt.js';
import { renderActivityHeatmap } from './heatmap.js';

// DOM Elements
const setupView = document.getElementById('setup-view');
const unlockView = document.getElementById('unlock-view');
const dashboardView = document.getElementById('dashboard-view');
const setupForm = document.getElementById('setup-form');
const unlockForm = document.getElementById('unlock-form');
const querySelector = document.getElementById('query-selector');
const progressList = document.getElementById('progress-list');
const ganttContainer = document.getElementById('gantt-container');
const itemsView = document.getElementById('items-view');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const themeToggle = document.getElementById('theme-toggle');
const langToggle = document.getElementById('lang-toggle');
const ganttPeriod = document.getElementById('gantt-period');
const ganttPrev = document.getElementById('gantt-prev');
const ganttNext = document.getElementById('gantt-next');
const dataControls = document.getElementById('data-controls');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');

// Initialize application
async function initApp() {
    // Apply Theme and Language on Load
    document.documentElement.setAttribute('data-theme', state.currentTheme);
    updateThemeIcon();
    applyTranslations();

    // Check for saved config
    if (state.azureConfig.org && state.azureConfig.project && state.azureConfig.pat) {
        // If it looks like a new format (encrypted), show unlock view
        if (state.azureConfig.pat.includes(':')) {
            switchTab('unlock');
        } else {
            // Legacy XOR format - try to decrypt without password (old secret)
            state.azureConfig.pat = await decryptPAT(state.azureConfig.pat);
            showDashboard();
        }
    } else {
        switchTab('setup');
    }
}

// Tab Elements
const tabDashboard = document.getElementById('tab-dashboard');
const tabItems = document.getElementById('tab-items');
const tabSetup = document.getElementById('tab-setup');

// Run initialization
initApp();

// Tab Switching
function switchTab(tabId) {
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

tabDashboard.addEventListener('click', () => switchTab('dashboard'));
tabItems.addEventListener('click', () => switchTab('items'));
tabSetup.addEventListener('click', () => switchTab('setup'));

setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const config = {
        org: document.getElementById('org').value,
        project: document.getElementById('project').value,
        pat: document.getElementById('pat').value
    };
    const password = document.getElementById('security-password').value;
    const save = document.getElementById('save-credentials').checked;
    
    const queries = await fetchQueries(config);
    if (queries) {
        state.azureConfig = config;
        if (save) {
            const safeConfig = { ...config, pat: await encryptPAT(config.pat, password) };
            localStorage.setItem('azure_config', JSON.stringify(safeConfig));
        } else {
            localStorage.removeItem('azure_config');
        }
        showDashboard(queries);
    } else {
        showToast(translations[state.currentLanguage]['msg-auth-failed'], 'error');
    }
});

unlockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('unlock-password').value;
    const decryptedPat = await decryptPAT(state.azureConfig.pat, password);
    
    if (decryptedPat) {
        state.azureConfig.pat = decryptedPat;
        showDashboard();
    } else {
        showToast(translations[state.currentLanguage]['msg-invalid-password'] || 'Senha incorreta', 'error');
    }
});

forgotPasswordBtn.addEventListener('click', () => {
    localStorage.removeItem('azure_config');
    state.azureConfig = { org: '', project: '', pat: '' };
    switchTab('setup');
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('azure_config');
    location.reload();
});

themeToggle.addEventListener('click', () => {
    state.currentTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.currentTheme);
    localStorage.setItem('theme', state.currentTheme);
    updateThemeIcon();
    if (querySelector.value) processAnalytics(state.currentData.items, state.currentData.tree);
});

function updateThemeIcon() {
    const icon = themeToggle.querySelector('i');
    icon.className = state.currentTheme === 'dark' ? 'ph ph-sun-dim' : 'ph ph-moon-stars';
}

langToggle.addEventListener('click', () => {
    state.currentLanguage = state.currentLanguage === 'pt-br' ? 'en' : 'pt-br';
    localStorage.setItem('language', state.currentLanguage);
    applyTranslations();
    if (state.currentData.items.length > 0) processAnalytics(state.currentData.items, state.currentData.tree);
    if (state.azureConfig) fetchQueries(state.azureConfig).then(queries => populateQueries(queries));
});

function applyTranslations() {
    const lang = translations[state.currentLanguage];
    document.documentElement.lang = state.currentLanguage.split('-')[0]; // Set HTML lang attribute (e.g., 'en' or 'pt')
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

    // Apply translations to ARIA labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (lang[key]) {
            el.setAttribute('aria-label', lang[key]);
        }
    });

    langToggle.title = lang['lang-toggle-title'];
    langToggle.querySelector('span').textContent = state.currentLanguage === 'pt-br' ? 'EN' : 'PT';
    themeToggle.title = lang['theme-toggle-title'];
    refreshBtn.title = lang['refresh-btn-title'];
    querySelector.setAttribute('title', lang['query-selector-placeholder']);
    
    document.getElementById('org').placeholder = state.currentLanguage === 'pt-br' ? 'ex: minha-empresa' : 'ex: my-company';
    document.getElementById('project').placeholder = state.currentLanguage === 'pt-br' ? 'ex: meu-projeto' : 'ex: my-project';
    document.getElementById('pat').placeholder = state.currentLanguage === 'pt-br' ? 'Seu Token do Azure' : 'Your Azure Token';

    if (state.currentData.tree.length > 0) callRenderGantt();
    renderLegends(state.currentData.items, state.workItemMetadata, translations, state.currentLanguage);
}

querySelector.addEventListener('change', (e) => {
    state.ganttOffset = 0;
    loadQueryData(e.target.value);
});

refreshBtn.addEventListener('click', async () => {
    if (refreshBtn.classList.contains('spinning') || !querySelector.value) return;
    refreshBtn.classList.add('spinning');
    await loadQueryData(querySelector.value);
    refreshBtn.classList.remove('spinning');
});

ganttPeriod.addEventListener('change', () => {
    state.ganttOffset = 0;
    const isTotal = ganttPeriod.value === 'total';
    ganttPrev.disabled = ganttNext.disabled = isTotal;
    ganttPrev.style.opacity = ganttNext.style.opacity = isTotal ? '0.3' : '1';
    if (state.currentData.tree.length > 0) callRenderGantt();
});

ganttPrev.addEventListener('click', () => {
    if (ganttPeriod.value === 'total') return;
    state.ganttOffset--;
    callRenderGantt();
});

ganttNext.addEventListener('click', () => {
    if (ganttPeriod.value === 'total') return;
    state.ganttOffset++;
    callRenderGantt();
});

document.querySelectorAll('.gantt-status-filters input').forEach(cb => {
    cb.addEventListener('change', () => {
        if (state.currentData.tree.length > 0) callRenderGantt();
    });
});

async function showDashboard(initialQueries = null) {
    switchTab('dashboard');
    if (Object.keys(state.workItemMetadata.types).length === 0) {
        await fetchMetadata(state.azureConfig, state.workItemMetadata, () => renderLegends(state.currentData?.items || [], state.workItemMetadata, translations, state.currentLanguage));
    }
    const queries = initialQueries || await fetchQueries(state.azureConfig);
    populateQueries(queries);
}

function callRenderGantt() {
    renderGantt(state.currentData.tree, {
        ganttPeriod, 
        currentData: state.currentData, 
        ganttOffset: state.ganttOffset, 
        currentLanguage: state.currentLanguage, 
        translations, 
        workItemMetadata: state.workItemMetadata, 
        ganttContainer, 
        azureConfig: state.azureConfig
    });
}

function populateQueries(queries) {
    const currentVal = querySelector.value;
    const lang = translations[state.currentLanguage];
    querySelector.innerHTML = `<option value="">${lang['query-selector-placeholder']}</option>`;
    queries.sort((a, b) => a.name.localeCompare(b.name)).forEach(q => {
        const option = document.createElement('option');
        option.value = q.id;
        option.textContent = q.name;
        querySelector.appendChild(option);
    });
    if (currentVal) querySelector.value = currentVal;
}

async function loadQueryData(queryId) {
    if (!queryId) return;
    const itemCards = document.querySelectorAll('.card.glass');
    const loaders = Array.from(itemCards).map(card => showLoading(card));

    try {
        const url = `https://dev.azure.com/${state.azureConfig.org}/${state.azureConfig.project}/_apis/wit/wiql/${queryId}?api-version=6.0`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Basic ${btoa(':' + state.azureConfig.pat)}` },
            cache: 'no-store'
        });
        const result = await response.json();
        
        let ids = [];
        if (result.workItems) {
            ids = result.workItems.map(wi => wi.id);
        } else if (result.workItemRelations) {
            ids = [...new Set(result.workItemRelations.flatMap(r => [r.source?.id, r.target?.id]).filter(id => id))];
        }
        
        if (ids.length === 0) {
            showToast(translations[state.currentLanguage]['msg-no-items'], 'error');
            return;
        }

        const items = await fetchFullDetails(state.azureConfig, ids);
        const tree = buildTree(items, state.workItemMetadata);
        state.currentData = { items, tree };

        const activeNameEl = document.getElementById('active-query-name');
        if (activeNameEl) {
            const selectedOption = querySelector.options[querySelector.selectedIndex];
            activeNameEl.textContent = `${translations[state.currentLanguage]['label-query']}: ${selectedOption ? selectedOption.text : ''}`;
        }

        processAnalytics(items, tree);
    } catch (e) {
        showToast(e.message || 'Error loading data', 'error');
    } finally {
        loaders.forEach(l => l.remove());
    }
}

function processAnalytics(items, tree) {
    const leadTimes = [], cycleTimes = [], labels = [], agingData = [];
    const assigneeWorkload = {};
    const now = new Date();

    items.forEach(item => {
        const f = item.fields;
        const createdDate = new Date(f['System.CreatedDate']);
        const activatedDate = f['Microsoft.VSTS.Common.ActivatedDate'] ? new Date(f['Microsoft.VSTS.Common.ActivatedDate']) : null;
        const closedDate = f['Microsoft.VSTS.Common.ClosedDate'] ? new Date(f['Microsoft.VSTS.Common.ClosedDate']) : null;
        const stateName = f['System.State'];
        const changedDate = new Date(f['System.ChangedDate']);

        if (closedDate && !isNaN(closedDate)) {
            leadTimes.push(((closedDate - createdDate) / (1000 * 60 * 60 * 24)).toFixed(1));
            cycleTimes.push(activatedDate ? ((closedDate - activatedDate) / (1000 * 60 * 60 * 24)).toFixed(1) : 0);
            labels.push(`ID ${item.id}`);
        }

        const statusInfo = getStatusInfo(stateName, state.workItemMetadata);
        const type = f['System.WorkItemType']?.toLowerCase();
        const iconInfo = getItemIcon(type, state.workItemMetadata);
        
        if (statusInfo.label === 'In Progress' && !iconInfo.isPortfolio && !isNaN(changedDate)) {
            agingData.push({
                id: item.id,
                title: f['System.Title'] || 'No Title',
                age: Math.max(0, Math.floor((now - changedDate) / (1000 * 60 * 60 * 24))),
                state: stateName
            });
        }

        if (!iconInfo.isPortfolio) {
            let assignee = f['System.AssignedTo'];
            let name = assignee?.displayName || assignee?.uniqueName || (typeof assignee === 'string' ? assignee : 'Unassigned');
            assigneeWorkload[name] = (assigneeWorkload[name] || 0) + 1;
        }
    });

    // CFD and Heatmap processing
    const cfdSeries = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const counts = { date: d, Proposed: 0, InProgress: 0, Done: 0 };
        items.forEach(item => {
            const f = item.fields;
            if (getItemIcon(f['System.WorkItemType'], state.workItemMetadata).isPortfolio) return;
            const created = new Date(f['System.CreatedDate']);
            const activated = f['Microsoft.VSTS.Common.ActivatedDate'] ? new Date(f['Microsoft.VSTS.Common.ActivatedDate']) : null;
            const closed = f['Microsoft.VSTS.Common.ClosedDate'] ? new Date(f['Microsoft.VSTS.Common.ClosedDate']) : null;
            if (created <= d) {
                if (closed && closed <= d) counts.Done++;
                else if (activated && activated <= d) counts.InProgress++;
                else counts.Proposed++;
            }
        });
        cfdSeries.push(counts);
    }

    state.heatmapData = {};
    items.forEach(item => {
        const closedDate = item.fields['Microsoft.VSTS.Common.ClosedDate'];
        if (closedDate) {
            const dateStr = new Date(closedDate).toISOString().split('T')[0];
            state.heatmapData[dateStr] = (state.heatmapData[dateStr] || 0) + 1;
        }
    });

    const throughputData = [];
    const requirementBacklogTypes = state.workItemMetadata.backlogs.find(b => b.name.toLowerCase().includes('requirement'))?.workItemTypes || [];
    for (let i = 11; i >= 0; i--) {
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() - (i * 7)); startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23, 59, 59, 999);
        let count = 0;
        items.forEach(item => {
            const closedDateStr = item.fields['Microsoft.VSTS.Common.ClosedDate'];
            if (!closedDateStr) return;
            const type = item.fields['System.WorkItemType']?.toLowerCase();
            if (!(requirementBacklogTypes.includes(type) || ['user story', 'product backlog item', 'requirement', 'issue'].includes(type))) return;
            const closed = new Date(closedDateStr);
            if (closed >= startOfWeek && closed <= endOfWeek) count++;
        });
        throughputData.push({
            label: `W${12 - i}`,
            range: `${startOfWeek.toLocaleDateString(state.currentLanguage, { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString(state.currentLanguage, { day: 'numeric', month: 'short' })}`,
            count: count
        });
    }

    renderCharts(labels, leadTimes, cycleTimes, state.charts, state.currentTheme, state.currentLanguage, translations, state.azureConfig);
    renderAgingChart(agingData, state.charts, state.currentTheme, state.currentLanguage, translations, state.azureConfig);
    renderAssigneeChart(assigneeWorkload, state.charts, state.currentTheme, state.currentLanguage, translations);
    renderCFDChart(cfdSeries, state.charts, state.currentTheme, state.currentLanguage, translations);
    renderActivityHeatmap(state.heatmapData, state.currentLanguage, translations);
    renderThroughputChart(throughputData, state.charts, state.currentTheme, state.currentLanguage, translations);
    renderPortfolioFilters(items, state.workItemMetadata, translations, state.currentLanguage, () => renderProgress(items, progressList, translations, state.currentLanguage, state.workItemMetadata, state.azureConfig));
    renderProgress(items, progressList, translations, state.currentLanguage, state.workItemMetadata, state.azureConfig);
    callRenderGantt();
    renderLegends(items, state.workItemMetadata, translations, state.currentLanguage);
}
