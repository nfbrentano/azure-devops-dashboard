/**
 * Event Handlers for Azure DevOps Dashboard
 */
import { state } from './state.js';

export function initEvents(elements, handlers) {
    const { 
        setupForm, unlockForm, forgotPasswordBtn, logoutBtn, 
        themeToggle, langToggle, querySelector, refreshBtn,
        ganttPeriod, ganttPrev, ganttNext, tabDashboard, tabItems, tabSetup
    } = elements;

    const { 
        handleAuth, handleUnlock, handleThemeToggle, handleLangToggle, 
        handleQueryChange, handleRefresh, handleGanttPeriodChange, 
        handleGanttNav, handleTabSwitch 
    } = handlers;

    // Tabs
    tabDashboard.addEventListener('click', () => handleTabSwitch('dashboard'));
    tabItems.addEventListener('click', () => handleTabSwitch('items'));
    tabSetup.addEventListener('click', () => handleTabSwitch('setup'));

    // Auth Forms
    setupForm.addEventListener('submit', handleAuth);
    unlockForm.addEventListener('submit', handleUnlock);

    forgotPasswordBtn.addEventListener('click', () => {
        localStorage.removeItem('azure_config');
        state.azureConfig = { org: '', project: '', pat: '' };
        handleTabSwitch('setup');
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('azure_config');
        location.reload();
    });

    // Theme & Language
    themeToggle.addEventListener('click', handleThemeToggle);
    langToggle.addEventListener('click', handleLangToggle);

    // Data Controls
    querySelector.addEventListener('change', handleQueryChange);
    refreshBtn.addEventListener('click', handleRefresh);

    // Gantt
    ganttPeriod.addEventListener('change', handleGanttPeriodChange);
    ganttPrev.addEventListener('click', () => handleGanttNav(-1));
    ganttNext.addEventListener('click', () => handleGanttNav(1));

    document.querySelectorAll('.gantt-status-filters input').forEach(cb => {
        cb.addEventListener('change', () => {
            if (state.currentData.tree.length > 0) handlers.handleGanttFilterChange();
        });
    });

    const typeLegend = document.getElementById('type-legend');
    if (typeLegend) {
        typeLegend.addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT' && state.currentData.tree.length > 0) {
                handlers.handleGanttFilterChange();
            }
        });
    }
}
