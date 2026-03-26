/**
 * Main Entry Point for Azure DevOps Dashboard
 */

// Imports
import './style.css';
import { state } from './state.js';
import { translations } from './translations.js';
import { 
    showLoading, showToast, encryptPAT, decryptPAT, updateLoadingProgress 
} from './utils.js';
import { 
    fetchQueries, fetchFullDetails, buildTree, fetchWithRetry, getAuthHeader, fetchMetadata,
    fetchRevisionsForItems, saveSetup, retrieveSetup
} from './api.js';
import { 
    renderCharts, renderThroughputChart, renderAgingChart, 
    renderAssigneeChart, renderWIPChart, renderCFDChart, renderPortfolioFilters, 
    renderProgress, renderLegends 
} from './charts.js';
import { renderGantt } from './gantt.js';
import { 
    switchTab, updateThemeIcon, applyTranslations, 
    showEmptyState, populateQueries 
} from './ui.js';
import { processAnalytics } from './analytics.js';
import { initEvents } from './events.js';
import { LOGO_LIGHT, LOGO_DARK } from './logos.js';

// DOM Elements
const elements = {
    setupView: document.getElementById('setup-view'),
    unlockView: document.getElementById('unlock-view'),
    dashboardView: document.getElementById('dashboard-view'),
    setupForm: document.getElementById('setup-form'),
    unlockForm: document.getElementById('unlock-form'),
    querySelector: document.getElementById('query-selector'),
    progressList: document.getElementById('progress-list'),
    ganttContainer: document.getElementById('gantt-container'),
    itemsView: document.getElementById('items-view'),
    logoutBtn: document.getElementById('logout-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    langToggle: document.getElementById('lang-toggle'),
    ganttPeriod: document.getElementById('gantt-period'),
    ganttPrev: document.getElementById('gantt-prev'),
    ganttNext: document.getElementById('gantt-next'),
    dataControls: document.getElementById('data-controls'),
    forgotPasswordBtn: document.getElementById('forgot-password-btn'),
    tabDashboard: document.getElementById('tab-dashboard'),
    tabItems: document.getElementById('tab-items'),
    tabSetup: document.getElementById('tab-setup'),
    saveCloudBtn: document.getElementById('save-cloud-btn'),
    retrieveCloudBtn: document.getElementById('retrieve-cloud-btn')
};

// Initialize application
async function initApp() {
    document.documentElement.setAttribute('data-theme', state.currentTheme);
    updateThemeIcon(elements.themeToggle, state.currentTheme);
    
    const uiOptions = {
        currentLanguage: state.currentLanguage,
        currentData: state.currentData,
        workItemMetadata: state.workItemMetadata,
        langToggle: elements.langToggle,
        themeToggle: elements.themeToggle,
        refreshBtn: elements.refreshBtn,
        querySelector: elements.querySelector,
        callRenderGantt
    };
    applyTranslations(uiOptions);

    if (state.azureConfig) {
        document.getElementById('org').value = state.azureConfig.org || '';
        document.getElementById('project').value = state.azureConfig.project || '';
        document.getElementById('company-name').value = state.azureConfig.companyName || '';
    }
    
    updateLogos();

    // Auto-retrieve from server if Org/Project are present in state/locally
    if (state.azureConfig?.org && state.azureConfig?.project && !state.azureConfig?.pat) {
        const serverConfig = await retrieveSetup(state.azureConfig.org, state.azureConfig.project);
        if (serverConfig) {
            state.azureConfig = { ...state.azureConfig, ...serverConfig };
            document.getElementById('pat').value = serverConfig.encryptedPat;
            document.getElementById('company-name').value = serverConfig.companyName || '';
        }
    }

    if (state.azureConfig?.org && state.azureConfig?.project && state.azureConfig?.pat) {
        if (state.azureConfig.pat.includes(':')) {
            switchTab('unlock', elements);
        } else {
            state.azureConfig.pat = await decryptPAT(state.azureConfig.pat);
            showDashboard();
        }
    } else {
        switchTab('setup', elements);
    }

    const handlers = {
        handleTabSwitch: (tabId) => switchTab(tabId, elements),
        
        handleAuth: async (e) => {
            e.preventDefault();
            const config = {
                org: document.getElementById('org').value,
                project: document.getElementById('project').value,
                pat: document.getElementById('pat').value,
                companyName: document.getElementById('company-name').value
            };
            const password = document.getElementById('security-password').value;
            const save = document.getElementById('save-credentials').checked;
            
            showLoading(true);
            try {
                const queries = await fetchQueries(config);
                if (queries) {
                    state.azureConfig = config;
                    
                    // Always save to cloud when connecting from setup form
                    const encryptedPat = await encryptPAT(config.pat, password);
                    await saveSetup({ ...config, pat: encryptedPat }, password);

                    if (save) {
                        const safeConfig = { ...config, pat: encryptedPat };
                        localStorage.setItem('azure_config', JSON.stringify(safeConfig));
                    } else {
                        localStorage.removeItem('azure_config');
                    }
                    showDashboard(queries);
                    showLoading(false);
                } else {
                    showToast(translations[state.currentLanguage]['msg-auth-failed'], 'error');
                    showLoading(false);
                }
            } catch (error) {
                console.error('Auth error:', error);
                showToast(translations[state.currentLanguage]['msg-auth-failed'], 'error');
                showLoading(false);
            }
        },

        handleUnlock: async (e) => {
            e.preventDefault();
            const password = document.getElementById('unlock-password').value;
            const decryptedPat = await decryptPAT(state.azureConfig.pat, password);
            
            if (decryptedPat) {
                state.azureConfig.pat = decryptedPat;
                showDashboard();
            } else {
                showToast(translations[state.currentLanguage]['msg-invalid-password'], 'error');
            }
        },

        handleThemeToggle: () => {
            state.currentTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', state.currentTheme);
            localStorage.setItem('theme', state.currentTheme);
            updateThemeIcon(elements.themeToggle, state.currentTheme);
            updateLogos();
            if (elements.querySelector.value) runAnalytics();
        },

        handleLangToggle: () => {
            state.currentLanguage = state.currentLanguage === 'pt-br' ? 'en' : 'pt-br';
            localStorage.setItem('language', state.currentLanguage);
            applyTranslations({
                currentLanguage: state.currentLanguage,
                currentData: state.currentData,
                workItemMetadata: state.workItemMetadata,
                langToggle: elements.langToggle,
                themeToggle: elements.themeToggle,
                refreshBtn: elements.refreshBtn,
                querySelector: elements.querySelector,
                callRenderGantt
            });
            if (state.currentData.items.length > 0) runAnalytics();
            if (state.azureConfig) fetchQueries(state.azureConfig).then(queries => populateQueries(queries, elements.querySelector, state.currentLanguage));
        },

        handleQueryChange: (e) => {
            state.ganttOffset = 0;
            loadQueryData(e.target.value);
        },

        handleRefresh: async () => {
            if (!state.azureConfig || !state.azureConfig.org || !state.azureConfig.project || !state.azureConfig.pat) {
                showToast(translations[state.currentLanguage]['msg-missing-config'], 'error');
                switchTab('setup', elements);
                return;
            }
            if (elements.refreshBtn.classList.contains('spinning') || !elements.querySelector.value) return;
            elements.refreshBtn.classList.add('spinning');
            await loadQueryData(elements.querySelector.value);
            elements.refreshBtn.classList.remove('spinning');
        },

        handleGanttPeriodChange: () => {
            state.ganttOffset = 0;
            const isTotal = elements.ganttPeriod.value === 'total';
            elements.ganttPrev.disabled = elements.ganttNext.disabled = isTotal;
            elements.ganttPrev.style.opacity = elements.ganttNext.style.opacity = isTotal ? '0.3' : '1';
            if (state.currentData.tree.length > 0) callRenderGantt();
        },

        handleGanttNav: (dir) => {
            if (elements.ganttPeriod.value === 'total') return;
            state.ganttOffset += dir;
            callRenderGantt();
        },

        handleGanttFilterChange: () => {
            if (state.currentData.tree.length > 0) callRenderGantt();
        },

        handleRetrieveCloud: async () => {
            const org = document.getElementById('org').value;
            const project = document.getElementById('project').value;

            if (!org || !project) {
                showToast(translations[state.currentLanguage]['msg-missing-config'], 'error');
                return;
            }

            showLoading(true);
            const config = await retrieveSetup(org, project);
            showLoading(false);

            if (config) {
                document.getElementById('org').value = config.org || '';
                document.getElementById('project').value = config.project || '';
                document.getElementById('company-name').value = config.companyName || '';
                document.getElementById('pat').value = config.encryptedPat;
                showToast(translations[state.currentLanguage]['msg-retrieve-success'], 'success');
            } else {
                showToast(translations[state.currentLanguage]['msg-retrieve-error'], 'error');
            }
        }
    };

    initEvents(elements, handlers);
}

async function showDashboard(initialQueries = null) {
    switchTab('dashboard', elements);
    
    // Fetch metadata in parallel with queries
    const metadataPromise = fetchMetadata(state.azureConfig, state.workItemMetadata, () => {
        if (state.currentData.items.length > 0) {
            runAnalytics();
        } else {
            renderLegends(null, state.workItemMetadata, translations, state.currentLanguage);
        }
    });

    const queries = initialQueries || await fetchQueries(state.azureConfig);
    populateQueries(queries, elements.querySelector, state.currentLanguage);
    
    await metadataPromise;
}

async function loadQueryData(queryId) {
    if (!queryId) return;
    showLoading(true, 0);

    try {
        const url = `https://dev.azure.com/${state.azureConfig.org}/${state.azureConfig.project}/_apis/wit/wiql/${queryId}?api-version=6.0`;
        const response = await fetchWithRetry(url, {
            headers: { 'Authorization': getAuthHeader(state.azureConfig.pat) },
            cache: 'no-cache'
        });
        const result = await response.json();
        
        let ids = [];
        if (result.workItems) {
            ids = result.workItems.map(wi => wi.id);
        } else if (result.workItemRelations) {
            ids = [...new Set(result.workItemRelations.flatMap(r => [r.source?.id, r.target?.id]).filter(id => id))];
        }
        
        if (ids.length === 0) {
            showEmptyState(true);
            showLoading(false);
            return;
        }

        showEmptyState(false);
        const items = await fetchFullDetails(state.azureConfig, ids, (p) => {
            updateLoadingProgress(p);
        });

        // 2. Fetch Revisions for Bottleneck analysis
        showLoading(true, 0); // Reset progress for revisions
        const revisions = await fetchRevisionsForItems(state.azureConfig, ids, (p) => {
            updateLoadingProgress(p);
        });

        const { roots, nodes } = buildTree(items, state.workItemMetadata);
        state.currentData = { items: nodes, tree: roots, revisions: revisions };

        const activeNameEl = document.getElementById('active-query-name');
        if (activeNameEl) {
            const selectedOption = elements.querySelector.options[elements.querySelector.selectedIndex];
            activeNameEl.textContent = `${translations[state.currentLanguage]['label-query']}: ${selectedOption ? selectedOption.text : ''}`;
        }

        runAnalytics();
    } catch (e) {
        console.error('Error loading query data:', e);
        showToast(translations[state.currentLanguage]['msg-error-loading'], 'error');
        showEmptyState(true);
    } finally {
        showLoading(false);
    }
}

function updateLogos() {
    const isDark = state.currentTheme === 'dark';
    const logoSrc = isDark ? LOGO_DARK : LOGO_LIGHT;
    document.querySelectorAll('.company-logo-img').forEach(img => {
        img.src = logoSrc;
    });
}

function runAnalytics() {
    processAnalytics(state.currentData.items, state.currentData.tree, {
        currentTheme: state.currentTheme,
        currentLanguage: state.currentLanguage,
        workItemMetadata: state.workItemMetadata,
        charts: state.charts,
        azureConfig: state.azureConfig,
        progressList: elements.progressList,
        revisionsData: state.currentData.revisions,
        callRenderGantt
    });
}

function callRenderGantt() {
    renderGantt(state.currentData.tree, {
        ganttPeriod: elements.ganttPeriod, 
        currentData: state.currentData, 
        ganttOffset: state.ganttOffset, 
        currentLanguage: state.currentLanguage, 
        translations, 
        workItemMetadata: state.workItemMetadata, 
        ganttContainer: elements.ganttContainer, 
        azureConfig: state.azureConfig
    });
}

// Run initialization
initApp();
