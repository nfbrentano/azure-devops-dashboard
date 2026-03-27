// @ts-nocheck
/**
 * Event Handlers for Azure DevOps Dashboard
 */
import { state } from './state.ts';
import { LOGO_LIGHT, LOGO_DARK } from './logos.ts';

async function drawWatermark(canvas, isDark) {
    let { companyName } = state.azureConfig || {};

    // Use hardcoded theme-aware logo
    const companyLogo = isDark ? LOGO_DARK : LOGO_LIGHT;

    if (!companyName && !companyLogo) return canvas;

    const padding = 80;
    const newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height + padding;
    const ctx = newCanvas.getContext('2d');

    ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    ctx.drawImage(canvas, 0, padding);

    const textColor = isDark ? '#e2e8f0' : '#334155';

    if (companyLogo) {
        try {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = companyLogo;
            });
            const aspect = img.width / img.height;
            const h = 50; // Increased from 30
            const w = h * aspect;
            const logoY = (padding - h) / 2;
            ctx.drawImage(img, 20, logoY, w, h);

            if (companyName) {
                ctx.fillStyle = textColor;
                ctx.font = 'bold 20px sans-serif'; // Slightly larger font too
                ctx.textBaseline = 'middle';
                const textY = padding / 2;
                ctx.fillText(companyName, 20 + w + 20, textY);
            }
        } catch (e) {
            console.warn('Failed to load watermark logo', e);
            if (companyName) {
                ctx.fillStyle = textColor;
                ctx.font = 'bold 20px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(companyName, 20, padding / 2);
            }
        }
    } else if (companyName) {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 20px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(companyName, 20, padding / 2);
    }

    return newCanvas;
}

export function initEvents(elements, handlers) {
    const {
        setupForm,
        unlockForm,
        forgotPasswordBtn,
        logoutBtn,
        themeToggle,
        langToggle,
        querySelector,
        refreshBtn,
        ganttPeriod,
        ganttPrev,
        ganttNext,
        tabDashboard,
        tabItems,
        tabSetup
    } = elements;

    const {
        handleAuth,
        handleUnlock,
        handleThemeToggle,
        handleLangToggle,
        handleQueryChange,
        handleRefresh,
        handleGanttPeriodChange,
        handleGanttNav,
        handleTabSwitch
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

    document.querySelectorAll('.gantt-status-filters input').forEach((cb) => {
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

                    const withWatermark = await drawWatermark(tempCanvas, isDark);
                    const link = document.createElement('a');
                    link.download = `${targetId}_export.png`;
                    link.href = withWatermark.toDataURL('image/png');
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

                    const withWatermark = await drawWatermark(canvas, isDark);
                    const link = document.createElement('a');
                    link.download = `${targetId}_export.png`;
                    link.href = withWatermark.toDataURL('image/png');
                    link.click();
                }
            } catch (err) {
                console.error('Export failed', err);
            } finally {
                icon.className = originalClass;
                exportBtn.disabled = false;
            }
        }
    });
}
