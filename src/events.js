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

    // Chart Export
    document.addEventListener('click', async (e) => {
        const exportBtn = e.target.closest('.export-btn');
        if (exportBtn) {
            const targetId = exportBtn.getAttribute('data-target');
            const element = document.getElementById(targetId);
            
            if (!element) return;
            
            const isDark = state.currentTheme === 'dark';
            const bgColor = isDark ? '#1e293b' : '#ffffff';
            
            const icon = exportBtn.querySelector('i');
            const originalClass = icon.className;
            icon.className = 'ph-bold ph-spinner ph-spin';
            exportBtn.disabled = true;
            
            try {
                if (element.tagName === 'CANVAS') {
                    const canvas = element;
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    const ctx = tempCanvas.getContext('2d');
                    
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    ctx.drawImage(canvas, 0, 0);
                    
                    const link = document.createElement('a');
                    link.download = `${targetId}_export.png`;
                    link.href = tempCanvas.toDataURL('image/png');
                    link.click();
                } else {
                    // Export DOM Element (Gantt, Heatmap)
                    const originalOverflow = element.style.overflowX;
                    const originalMaxHeight = element.style.maxHeight;
                    element.style.overflowX = 'visible';
                    element.style.maxHeight = 'none';
                    
                    const canvas = await window.html2canvas(element, {
                        backgroundColor: bgColor,
                        scale: window.devicePixelRatio || 2,
                        logging: false
                    });
                    
                    element.style.overflowX = originalOverflow;
                    element.style.maxHeight = originalMaxHeight;
                    
                    const link = document.createElement('a');
                    link.download = `${targetId}_export.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                }
            } catch (err) {
                console.error("Export failed", err);
            } finally {
                icon.className = originalClass;
                exportBtn.disabled = false;
            }
        }
    });

}
