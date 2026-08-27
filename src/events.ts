/**
 * Event Handlers for Azure DevOps Dashboard
 */
import { state } from './state.ts';
import { exportToCSV, exportToPDF } from './export.ts';
import type { DashboardElements } from './types.ts';

async function drawWatermark(canvas: HTMLCanvasElement, isDark: boolean): Promise<HTMLCanvasElement> {
    const { companyName } = state.azureConfig || {};
    const { LOGO_LIGHT, LOGO_DARK } = await import('./logos.ts');

    // Use hardcoded theme-aware logo
    const companyLogo = isDark ? LOGO_DARK : LOGO_LIGHT;

    if (!companyName && !companyLogo) return canvas;

    const padding = 120;
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
            const h = 72; 
            const w = h * aspect;
            const logoY = (padding - h) / 2;
            
            // Draw logo with smooth scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 40, logoY, w, h);

            if (companyName) {
                ctx.fillStyle = textColor;
                ctx.font = '600 28px "Inter", sans-serif'; 
                ctx.textBaseline = 'middle';
                const textY = padding / 2;
                ctx.fillText(companyName, 40 + w + 20, textY);
            }
        } catch (e) {
            console.warn('Failed to load watermark logo', e);
            if (companyName) {
                ctx.fillStyle = textColor;
                ctx.font = '600 28px "Inter", sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(companyName, 40, padding / 2);
            }
        }
    } else if (companyName) {
        ctx.fillStyle = textColor;
        ctx.font = '600 28px "Inter", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(companyName, 40, padding / 2);
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
        handleCFDPeriodChange: (days: number) => void;
        handleItemsSearch: (query: string) => void;
        handleExportPDF: () => void;
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
        timelineGanttNext,
        cfdPeriodSelect,
        itemsSearchInput
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
        handleTimelineNav,
        handleCFDPeriodChange,
        handleItemsSearch,
        handleExportPDF
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

    // PDF Export
    const pdfBtn = document.getElementById('pdf-export-btn');
    pdfBtn?.addEventListener('click', async () => {
        if (!state.currentData || state.currentData.items.length === 0) return;

        const originalHtml = pdfBtn.innerHTML;
        pdfBtn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i>';
        (pdfBtn as HTMLButtonElement).disabled = true;

        try {
            await exportToPDF(state.currentTheme === 'dark', state.azureConfig);
        } finally {
            pdfBtn.innerHTML = originalHtml;
            (pdfBtn as HTMLButtonElement).disabled = false;
        }
    });

    // CSV Export
    const csvBtn = document.getElementById('csv-export-btn');
    csvBtn?.addEventListener('click', () => {
        if (state.currentData && state.currentData.items.length > 0) {
            exportToCSV(state.currentData.items, state.workItemMetadata, state.currentLanguage);
        }
    });

    // Share URL View
    const shareBtn = document.getElementById('share-url-btn');
    shareBtn?.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            import('./utils.ts').then(({ showToast }) => {
                import('./translations.ts').then(({ translations }) => {
                    const msg = translations[state.currentLanguage]['msg-share-copied'] || 'Link copied to clipboard!';
                    showToast(msg, 'success');
                });
            });
        });
    });

    // Presentation / TV Mode
    const tvBtn = document.getElementById('tv-mode-btn');
    let tvCycleInterval: any = null;

    const toggleTVMode = () => {
        const isTv = document.body.classList.toggle('tv-mode');
        if (isTv) {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
            // Auto cycle tabs / views every 20s
            let currentTabIdx = 0;
            const tabs = ['dashboard', 'items', 'timeline'];
            tvCycleInterval = setInterval(() => {
                currentTabIdx = (currentTabIdx + 1) % tabs.length;
                handleTabSwitch(tabs[currentTabIdx]);
            }, 20000);
        } else {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            if (tvCycleInterval) clearInterval(tvCycleInterval);
        }
    };

    tvBtn?.addEventListener('click', toggleTVMode);

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && document.body.classList.contains('tv-mode')) {
            document.body.classList.remove('tv-mode');
            if (tvCycleInterval) clearInterval(tvCycleInterval);
        }
    });

    // Shortcuts Modal
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const shortcutsBtn = document.getElementById('shortcuts-help-btn');
    const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');

    const toggleShortcutsModal = (open?: boolean) => {
        if (!shortcutsModal) return;
        const shouldOpen = open !== undefined ? open : shortcutsModal.classList.contains('hidden');
        if (shouldOpen) {
            shortcutsModal.classList.remove('hidden');
        } else {
            shortcutsModal.classList.add('hidden');
        }
    };

    shortcutsBtn?.addEventListener('click', () => toggleShortcutsModal(true));
    closeShortcutsBtn?.addEventListener('click', () => toggleShortcutsModal(false));

    // Alerts Modal & Rules
    const alertsModal = document.getElementById('alerts-modal');
    const alertsBtn = document.getElementById('alerts-config-btn');
    const closeAlertsBtn = document.getElementById('close-alerts-btn');
    const saveAlertsBtn = document.getElementById('save-alerts-btn');
    const resetAlertsBtn = document.getElementById('reset-alerts-btn');
    const alertsRulesList = document.getElementById('alerts-rules-list');

    const renderAlertRulesUI = () => {
        if (!alertsRulesList) return;
        import('./alerts.ts').then(({ getAlertRules }) => {
            const rules = getAlertRules();
            alertsRulesList.innerHTML = rules
                .map(
                    (r) => `
                <div class="alert-rule-row">
                    <div class="alert-rule-info">
                        <label class="alert-rule-name">${r.name}</label>
                        <span class="alert-rule-sub">Condição: ${r.metric} ${r.operator} limite</span>
                    </div>
                    <div class="alert-rule-controls">
                        <input type="number" class="alert-threshold-input" data-rule-id="${r.id}" value="${r.threshold}" min="1" step="1">
                        <input type="checkbox" data-rule-enable="${r.id}" ${r.enabled ? 'checked' : ''}>
                    </div>
                </div>
            `
                )
                .join('');
        });
    };

    const toggleAlertsModal = (open?: boolean) => {
        if (!alertsModal) return;
        const shouldOpen = open !== undefined ? open : alertsModal.classList.contains('hidden');
        if (shouldOpen) {
            renderAlertRulesUI();
            alertsModal.classList.remove('hidden');
        } else {
            alertsModal.classList.add('hidden');
        }
    };

    alertsBtn?.addEventListener('click', () => toggleAlertsModal(true));
    closeAlertsBtn?.addEventListener('click', () => toggleAlertsModal(false));

    saveAlertsBtn?.addEventListener('click', () => {
        import('./alerts.ts').then(({ getAlertRules, saveAlertRules }) => {
            const rules = getAlertRules();
            rules.forEach((r) => {
                const input = alertsRulesList?.querySelector(`input[data-rule-id="${r.id}"]`) as HTMLInputElement | null;
                const enableCb = alertsRulesList?.querySelector(`input[data-rule-enable="${r.id}"]`) as HTMLInputElement | null;
                if (input) r.threshold = Number(input.value) || r.threshold;
                if (enableCb) r.enabled = enableCb.checked;
            });
            saveAlertRules(rules);
            toggleAlertsModal(false);
            import('./utils.ts').then((u) => u.showToast('Regras salvas com sucesso!', 'success'));
            if (state.currentData.items.length > 0) {
                handleRefresh();
            }
        });
    });

    resetAlertsBtn?.addEventListener('click', () => {
        import('./alerts.ts').then(({ DEFAULT_ALERT_RULES, saveAlertRules }) => {
            saveAlertRules([...DEFAULT_ALERT_RULES]);
            renderAlertRulesUI();
        });
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        const isInput = target?.tagName === 'INPUT' || target?.tagName === 'SELECT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

        if (e.key === 'Escape') {
            if (shortcutsModal && !shortcutsModal.classList.contains('hidden')) {
                toggleShortcutsModal(false);
                return;
            }
            if (alertsModal && !alertsModal.classList.contains('hidden')) {
                toggleAlertsModal(false);
                return;
            }
            if (document.body.classList.contains('tv-mode')) {
                toggleTVMode();
                return;
            }
        }

        // Do not trigger shortcuts when typing in form fields
        if (isInput) return;

        switch (e.key.toLowerCase()) {
            case '1':
                handleTabSwitch('dashboard');
                break;
            case '2':
                handleTabSwitch('items');
                break;
            case '3':
                handleTabSwitch('timeline');
                break;
            case '4':
                handleTabSwitch('setup');
                break;
            case 'r':
                handleRefresh();
                break;
            case 't':
                handleThemeToggle();
                break;
            case 'l':
                handleLangToggle();
                break;
            case 'f':
                toggleTVMode();
                break;
            case '?':
                toggleShortcutsModal();
                break;
        }
    });

    // CFD Period
    cfdPeriodSelect?.addEventListener('change', () => {
        const val = Number(cfdPeriodSelect.value) || 180;
        handleCFDPeriodChange(val);
    });

    // Items Search
    let searchDebounce: any = null;
    itemsSearchInput?.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            handleItemsSearch(itemsSearchInput.value);
        }, 300);
    });

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
            const target = e.target as HTMLElement | null;
            if (target?.tagName === 'INPUT' && state.currentData.tree.length > 0) {
                handlers.handleGanttFilterChange();
            }
        });
    }

    // Chart Export
    document.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement | null;
        const exportBtn = target?.closest('.export-btn') as HTMLButtonElement | null;
        if (exportBtn) {
            const targetId = exportBtn.getAttribute('data-target');
            if (!targetId) return;
            let element = document.getElementById(targetId);

            if (!element) return;

            // Better context: If target is inside a card, export the card instead
            const card = element.closest('.card');
            const targetToCapture = card || element;

            const isDark = state.currentTheme === 'dark';
            const bgColor = isDark ? '#0f172a' : '#f8fafc'; // Matches --bg-color

            const icon = exportBtn.querySelector('i');
            const originalClass = icon ? icon.className : '';
            if (icon) icon.className = 'ph-bold ph-spinner ph-spin';
            exportBtn.disabled = true;

            // Add exporting class to cleanup UI
            targetToCapture.classList.add('exporting');

            try {
                await new Promise((r) => setTimeout(r, 100));

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
                if (icon) icon.className = originalClass;
                exportBtn.disabled = false;
            }
        }
    });
}
