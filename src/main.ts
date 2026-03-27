// @ts-nocheck
/**
 * Main Entry Point for Azure DevOps Dashboard
 */

// Imports
import './style.css';
import { state } from './state.ts';
import { translations } from './translations.ts';
import {
    showLoading,
    showToast,
    encryptPAT,
    decryptPAT,
    updateLoadingProgress,
    setLoadingStatus,
    setLoadingStep
} from './utils.ts';
import {
    fetchQueries,
    fetchFullDetails,
    buildTree,
    fetchWithRetry,
    getAuthHeader,
    fetchMetadata,
    fetchRevisionsForItems
} from './api.ts';
import { apiCache } from './cache.ts';
import {
    renderCharts,
    renderThroughputChart,
    renderAgingChart,
    renderAssigneeChart,
    renderWIPChart,
    renderCFDChart,
    renderPortfolioFilters,
    renderProgress,
    renderLegends
} from './charts.ts';
import { renderGantt } from './gantt.ts';
import { switchTab, updateThemeIcon, applyTranslations, showEmptyState, populateQueries } from './ui.ts';
import { processAnalytics } from './analytics.ts';
import { initEvents } from './events.ts';
import { LOGO_LIGHT, LOGO_DARK } from './logos.ts';

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
    tabSetup: document.getElementById('tab-setup')
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
            if (state.azureConfig)
                fetchQueries(state.azureConfig).then((queries) =>
                    populateQueries(queries, elements.querySelector, state.currentLanguage)
                );
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
            await loadQueryData(elements.querySelector.value, { bust: true });
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

    const queries = initialQueries || (await fetchQueries(state.azureConfig));
    populateQueries(queries, elements.querySelector, state.currentLanguage);

    await metadataPromise;
}

async function loadQueryData(queryId, { bust = false } = {}) {
    if (!queryId) return;

    // ── Phase: start ──────────────────────────────────────────
    showLoading(true, 0);
    setLoadingStatus('Buscando consulta...');
    setLoadingStep('step-queries', 'active');

    // Capture hit count before load to detect cache usage
    const statsBefore = apiCache.getStats();

    try {
        const url = `https://dev.azure.com/${state.azureConfig.org}/${state.azureConfig.project}/_apis/wit/wiql/${queryId}?api-version=6.0`;
        const response = await fetchWithRetry(url, {
            headers: { Authorization: getAuthHeader(state.azureConfig.pat) },
            cache: 'no-cache'
        });
        const result = await response.json();
        setLoadingStep('step-queries', 'done');

        let ids = [];
        if (result.workItems) {
            ids = result.workItems.map((wi) => wi.id);
        } else if (result.workItemRelations) {
            ids = [
                ...new Set(result.workItemRelations.flatMap((r) => [r.source?.id, r.target?.id]).filter((id) => id))
            ];
        }

        if (ids.length === 0) {
            showEmptyState(true);
            showLoading(false);
            return;
        }

        // ── Phase: work items ─────────────────────────────────
        showEmptyState(false);
        setLoadingStatus(`Carregando ${ids.length} itens...`);
        setLoadingStep('step-items', 'active');
        const items = await fetchFullDetails(
            state.azureConfig,
            ids,
            (p) => {
                updateLoadingProgress(p);
            },
            { bust }
        );
        setLoadingStep('step-items', 'done');

        // ── Phase: revisions ──────────────────────────────────
        showLoading(true, 0); // Reset progress bar for revisions
        setLoadingStatus(`Carregando histórico de ${ids.length} itens...`);
        setLoadingStep('step-revisions', 'active');
        const revisions = await fetchRevisionsForItems(
            state.azureConfig,
            ids,
            (p) => {
                updateLoadingProgress(p);
            },
            { bust }
        );
        setLoadingStep('step-revisions', 'done');

        const { roots, nodes } = buildTree(items, state.workItemMetadata);
        state.currentData = { items: nodes, tree: roots, revisions: revisions };

        // Update cache stats in state
        const statsAfter = apiCache.getStats();
        state.cacheStats = statsAfter;
        const hitsThisLoad = statsAfter.hits - statsBefore.hits;
        const missesThisLoad = statsAfter.misses - statsBefore.misses;
        const fromCache = hitsThisLoad > 0 && missesThisLoad === 0;

        const activeNameEl = document.getElementById('active-query-name');
        if (activeNameEl) {
            const selectedOption = elements.querySelector.options[elements.querySelector.selectedIndex];
            const queryLabel = `${translations[state.currentLanguage]['label-query']}: ${selectedOption ? selectedOption.text : ''}`;
            const badgeClass = fromCache ? 'cache-badge cache-badge--hit' : 'cache-badge cache-badge--miss';
            const badgeIcon = fromCache ? '🗃' : '🌐';
            const badgeText = fromCache ? 'cached' : 'live';
            activeNameEl.innerHTML = `${queryLabel} <span class="${badgeClass}">${badgeIcon} ${badgeText}</span>`;
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
    document.querySelectorAll('.company-logo-img').forEach((img) => {
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
