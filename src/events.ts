/**
 * Event Handlers for Azure DevOps Dashboard
 */
import { state } from './state.ts';
import { LOGO_LIGHT, LOGO_DARK } from './logos.ts';
import type { DashboardElements } from './types.ts';


async function drawWatermark(canvas: HTMLCanvasElement, isDark: boolean): Promise<HTMLCanvasElement> {
    const { companyName } = state.azureConfig || {};

    // Use hardcoded theme-aware logo
    const companyLogo = isDark ? LOGO_DARK : LOGO_LIGHT;

    if (!companyName && !companyLogo) return canvas;

    const padding = 80;
    const newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height + padding;
    const ctx = newCanvas.getContext('2d');
    if (!ctx) return canvas;

    // Use solid theme colors
    ctx.fillStyle = isDark ? '#0f172a' : '#f8fafc';
    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    ctx.drawImage(canvas, 0, padding);

    const textColor = isDark ? '#e2e8f0' : '#1e293b';

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
            const h = 40; 
            const w = h * aspect;
            const logoY = (padding - h) / 2;
            
            // Draw logo with smooth scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 30, logoY, w, h);

            if (companyName) {
                ctx.fillStyle = textColor;
                ctx.font = '600 20px "Inter", sans-serif'; 
                ctx.textBaseline = 'middle';
                const textY = padding / 2;
                ctx.fillText(companyName, 30 + w + 15, textY);
            }
        } catch (e) {
            console.warn('Failed to load watermark logo', e);
            if (companyName) {
                ctx.fillStyle = textColor;
                ctx.font = '600 20px "Inter", sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(companyName, 30, padding / 2);
            }
        }
    } else if (companyName) {
        ctx.fillStyle = textColor;
        ctx.font = '600 20px "Inter", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(companyName, 30, padding / 2);
    }

    return newCanvas;
}

export function initEvents(
    elements: DashboardElements,
    handlers: {
        handleAuth: (e: Event) => void;
        handleUnlock: (e: Event) => void;
        handleThemeToggle: () => void;
        handleLangToggle: () => void;
        handleQueryChange: (e: any) => void;
        handleRefresh: () => void;
        handleGanttPeriodChange: () => void;
        handleGanttNav: (dir: number) => void;
        handleTabSwitch: (tabId: string) => void;
        handleTimelinePeriodChange: () => void;
        handleTimelineNav: (dir: number) => void;
        handleGanttFilterChange: () => void;
    }
) {
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
        tabTimeline,
        tabSetup,
        timelineGanttPeriod,
        timelineGanttPrev,
        timelineGanttNext
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
        handleTabSwitch,
        handleTimelinePeriodChange,
        handleTimelineNav
    } = handlers;

    // Tabs
    tabDashboard?.addEventListener('click', () => handleTabSwitch('dashboard'));
    tabItems?.addEventListener('click', () => handleTabSwitch('items'));
    tabTimeline?.addEventListener('click', () => handleTabSwitch('timeline'));
    tabSetup?.addEventListener('click', () => handleTabSwitch('setup'));

    // Auth Forms
    setupForm?.addEventListener('submit', handleAuth);
    unlockForm?.addEventListener('submit', handleUnlock);

    forgotPasswordBtn?.addEventListener('click', () => {
        localStorage.removeItem('azure_config');
        state.azureConfig = { org: '', project: '', pat: '' };
        handleTabSwitch('setup');
    });

    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('azure_config');
        location.reload();
    });

    // Theme & Language
    themeToggle?.addEventListener('click', handleThemeToggle);
    langToggle?.addEventListener('click', handleLangToggle);

    // Data Controls
    querySelector?.addEventListener('change', handleQueryChange);
    refreshBtn?.addEventListener('click', handleRefresh);

    // Gantt
    ganttPeriod?.addEventListener('change', handleGanttPeriodChange);
    ganttPrev?.addEventListener('click', () => handleGanttNav(-1));
    ganttNext?.addEventListener('click', () => handleGanttNav(1));

    // Timeline
    timelineGanttPeriod?.addEventListener('change', handleTimelinePeriodChange);
    timelineGanttPrev?.addEventListener('click', () => handleTimelineNav(-1));
    timelineGanttNext?.addEventListener('click', () => handleTimelineNav(1));

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
            let element = document.getElementById(targetId);

            if (!element) return;

            // Better context: If target is inside a card, export the card instead
            const card = element.closest('.card');
            const targetToCapture = card || element;

            const isDark = state.currentTheme === 'dark';
            const bgColor = isDark ? '#0f172a' : '#f8fafc'; // Matches --bg-color

            const icon = exportBtn.querySelector('i');
            const originalClass = icon.className;
            icon.className = 'ph-bold ph-spinner ph-spin';
            exportBtn.disabled = true;

            // Add exporting class to cleanup UI
            targetToCapture.classList.add('exporting');

            try {
                // If it's a simple canvas, we still want the card if possible
                // But specifically for Chart.js, we might need a small delay for CSS to apply
                await new Promise(r => setTimeout(r, 100));

                const { default: html2canvas } = await import('html2canvas');
                const canvas = await html2canvas(targetToCapture as HTMLElement, {
                    backgroundColor: bgColor,
                    scale: window.devicePixelRatio || 2,
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                });

                const withWatermark = await drawWatermark(canvas, isDark);
                const link = document.createElement('a');
                link.download = `${targetId}_export.png`;
                link.href = withWatermark.toDataURL('image/png');
                link.click();
            } catch (err) {
                console.error('Export failed', err);
            } finally {
                targetToCapture.classList.remove('exporting');
                icon.className = originalClass;
                exportBtn.disabled = false;
            }
        }
    });
}
