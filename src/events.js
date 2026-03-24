/**
 * Event Handlers for Azure DevOps Dashboard
 */
import { state } from './state.js';

async function drawWatermark(canvas, isDark) {
    let { companyName, companyLogo } = state.azureConfig || {};
    
    // Fixed default logo
    const fixedLogo = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB3aWR0aD0iMTA1Ljk5OTk5bW0iCiAgIGhlaWdodD0iNTYuMjYwOTk4bW0iCiAgIHZpZXdCb3g9IjAgMCAxMDYgNTYuMjYwOTk4IgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmc1IgogICB4bWw6c3BhY2U9InByZXNlcnZlIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIxLjIuMiAoYjBhODQ4NjU0MSwgMjAyMi0xMi0wMSkiCiAgIHNvZGlwb2RpOmRvY25hbWU9ImxvZ29fcGl4X2ZvcmNlLnN2ZyIKICAgeG1sbnM6aW5rc2NhcGU9Imh0dHA6Ly93d3cuaW5rc2NhcGUub3JnL25hbWVzcGFjZXMvaW5rc2NhcGUiCiAgIHhtbG5zOnNvZGlwb2RpPSJodHRwOi8vc29kaXBvZGkuc291cmNlZm9yZ2UubmV0L0RURC9zb2RpcG9kaS0wLmR0ZCIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzdmc9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48c29kaXBvZGk6bmFtZWR2aWV3CiAgICAgaWQ9Im5hbWVkdmlldzciCiAgICAgcGFnZWNvbG9yPSIjZmZmZmZmIgogICAgIGJvcmRlcmNvbG9yPSIjMDAwMDAwIgogICAgIGJvcmRlcm9wYWNpdHk9IjAuMjUiCiAgICAgaW5rc2NhcGU6c2hvd3BhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAuMCIKICAgICBpbmtzY2FwZTpwYWdlY2hlY2tlcmJvYXJkPSIwIgogICAgIGlua3NjYXBlOmRlc2tjb2xvcj0iI2QxZDFkMSIKICAgICBpbmtzY2FwZTpkb2N1bWVudC11bml0cz0ibW0iCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIGlua3NjYXBlOnpvb209IjMuMDAwMzkyOCIKICAgICBpbmtzY2FwZTpjeD0iMTk2LjY0MDkyIgogICAgIGlua3NjYXBlOmN5PSIxMzEuODE2MDciCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIyNTYwIgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjEwMTEiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9IjAiCiAgICAgaW5rc2NhcGU6d2luZG93LXk9IjMyIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiCiAgICAgaW5rc2NhcGU6Y3VycmVudC1sYXllcj0ibGF5ZXIxIiAvPjxkZWZzCiAgICAgaWQ9ImRlZnMyIiAvPjxnCiAgICAgaW5rc2NhcGU6bGFiZWw9IkxheWVyIDEiCiAgICAgaW5rc2NhcGU6Z3JvdXBtb2RlPSJsYXllciIKICAgICBpZD0ibGF5ZXIxIj48ZwogICAgICAgaWQ9ImczODg4Ij48cmVjdAogICAgICAgICBzdHlsZT0iZmlsbDojMmI1NzlmO2ZpbGwtb3BhY2l0eToxO3N0cm9rZS13aWR0aDowLjI2NTIxNCIKICAgICAgICAgaWQ9InJlY3QyNzciCiAgICAgICAgIHdpZHRoPSIxNi40NjcwNiIKICAgICAgICAgaGVpZ2h0PSIxNi41Mjc3MzkiCiAgICAgICAgIHg9IjcuMDY5Mzk2NGUtMDgiCiAgICAgICAgIHk9IjEuNjgxMDA3M2UtMDciIC8+PHJlY3QKICAgICAgICAgc3R5bGU9ImZpbGw6IzJmYWZiNztmaWxsLW9wYWNpdHk6MTtzdHJva2Utd2lkdGg6MC4xMzA2MTUiCiAgICAgICAgIGlkPSJyZWN0MTIzMiIKICAgICAgICAgd2lkdGg9IjguMTA5ODUyOCIKICAgICAgICAgaGVpZ2h0PSI4LjEzOTczNTIiCiAgICAgICAgIHg9Ijk3Ljg4OTM0MyIKICAgICAgICAgeT0iMjguMTY2MjkiIC8+PHJlY3QKICAgICAgICAgc3R5bGU9ImZpbGw6IzAwMDAwMDtmaWxsLW9wYWNpdHk6MTtzdHJva2Utd2lkdGg6MC4yMzk5ODIiCiAgICAgICAgIGlkPSJyZWN0MzQ4MSIKICAgICAgICAgd2lkdGg9IjguMTA5ODUyOCIKICAgICAgICAgaGVpZ2h0PSIyNy40Nzc5MjIiCiAgICAgICAgIHg9IjQ3LjE4MTQ4NCIKICAgICAgICAgeT0iOC44MzE5MDE2IiAvPjxwYXRoCiAgICAgICAgIGQ9Im0gMzEuOTMyNjI3LDQ3LjEyNjA3MSB2IDMuMDA4MDU2IGggNS40MDcxMTcgdiAxLjgwMzcyMSBIIDMxLjkzMjYyNyBWIDU1LjkwNjYyIEggMjkuOTM2OTg4IFYgNDUuNDMwOTY4IGggNy43MzgxMjYgdiAxLjY5NTEwMyB6IgogICAgICAgICBzdHlsZT0iZm9udC13ZWlnaHQ6Ym9sZDtmb250LXNpemU6Mi4xMTY2N3B4O2ZvbnQtZmFtaWx5OidMaWJlcmF0aW9uIFNhbnMgTmFycm93JzstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOidMaWJlcmF0aW9uIFNhbnMgTmFycm93IEJvbGQnO2ZpbGw6IzAwMDAwMDtzdHJva2Utd2lkdGg6Mi4xMDM2NCIKICAgICAgICAgaWQ9InBhdGgzNjAyIgogICAgICAgICBzb2RpcG9kaTpub2RldHlwZXM9ImNjY2NjY2NjY2NjIiAvPjxwYXRoCiAgICAgICAgIGQ9Im0gNTYuNDE5MjIsNTAuNjIyOTQ3IGMgMC4wMjc1NiwzLjM5OTEzNiAtMi40NDQ0ODEsNS42MDIxOTcgLTUuNTg5MzIzLDUuNjIwNTkxIC0zLjQ0NjQ0MiwwLjAzOTI5IC01LjU0MzkyOSwtMi40NjI5MTkgLTUuNTYwOTMzLC01LjYyMDgxMiAwLjEyODY5MywtMy42NjM1NjYgMi4wMTQ5NjksLTUuNTA4Njk1IDUuNTcwNDU1LC01LjUyODUzMiAzLjQxMzIzMiwtMC4wNDQ0MSA1LjU2MjIzOSwyLjM3NzkzNyA1LjU4MDA3Miw1LjUyODUzMiB6IG0gLTUuNTgwMzU1LC0zLjg0NDMzNiBjIC0yLjQ2OTM3NSwwLjAzNTc4IC0zLjUyODk2MSwyLjA3MTMyOCAtMy41NzQzNDcsMy43ODQxMjIgLTAuMDEwNTEsMi4wNjQ5MzMgMS40NzUwNjcsMy44ODI1MDcgMy41NjQ4MjQsMy44OTY4NzEgMi4yNzM5MjksLTAuMDMwNjcgMy42MjU2NzYsLTIuMDAyODU1IDMuNjA1MDY2LC0zLjcxNzM5NCAwLjA0Nzg5LC0xLjQ5MTY5OCAtMC45NzU0OTgsLTMuOTY5MDYyIC0zLjU5NTU0MywtMy45NjM1OTkgeiIKICAgICAgICAgc3R5bGU9ImZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjIuMTE2NjdweDtmb250LWZhbWlseTonTGliZXJhdGlvbiBTYW5zIE5hcnJvdyc7LWlua3NjYXBlLWZvbnQtc3BlY2lmaWNhdGlvbjonTGliZXJhdGlvbiBTYW5zIE5hcnJvdyBCb2xkJztmaWxsOiMwMDAwMDA7c3Ryb2tlLXdpZHRoOjIuMTk0MzEiCiAgICAgICAgIGlkPSJwYXRoMzYwNCIKICAgICAgICAgc29kaXBvZGk6bm9kZXR5cGVzPSJjY2NjY2NjY2NjY2MiAvPjxwYXRoCiAgICAgICAgIGQ9Im0gNzAuMTI4MzE0LDU1LjkwNjYyNyAtMi45OTcwMywtMy40MDgxOTkgaCA2LjA4NjY2IHYgMy40MDgxOTkgaCA2My4yMzg1NjMgViA0NS40MzA4NDQgaCA1LjA3NDg1MyBjIDIuMjEwMjc5LC0wLjAwNyAzLjczMjM5LDEuNTk3OTYyIDMuNzU3NTQsMy4xNDQ2MTEgMC4wMzQ0OCwxLjYwMjU2MyAtMC41ODQ5OTIsMy40MDkzMTEgLTIuNjQ1Nzk1LDMuNzI1OTA1IGwgMy4xODk2MDksMy42MDU0MDcgeiBtIDAuMDU2NDMsLTYuOTYwMDc5IGMgLTAuMDE5NTUsLTAuNzg3MDkyIC0wLjY0MDMyMywtMS42OTk5NDQgLTIuMDkxNDI1LC0xLjcwMzkzMyBoIC0zLjAwNjkwNCB2IDMuNTEzOTE5IGggMy4wNTk2NDkgYyAxLjQ0MDk1OCwtMC4wMDQgMi4wNDc0NzEsLTEuMDU4NDk4IDIuMDM3ODI4LC0xLjgxMDYzNyB6IgogICAgICAgICBzdHlsZT0iZm9udC13ZWlnaHQ6Ym9sZDtmb250LXNpemU6Mi4xMTY2N3B4O2ZvbnQtZmFtaWx5OidMaWJlcmF0aW9uIFNhbnMgTmFycm93JzstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOidMaWJlcmF0aW9uIFNhbnMgTmFycm93IEJvbGQnO2ZpbGw6IzAwMDAwMDtzdHJva2Utd2lkdGg6Mi4wNzAxNSIKICAgICAgICAgaWQ9InBhdGgzNjA2IgogICAgICAgICBzb2RpcG9kaTpub2RldHlwZXM9ImNjY2NjY2NjY2NjY2NjY2NjY2NjIiAvPjxwYXRoCiAgICAgICAgIGQ9Im0gODUuNTkzNDU2LDU0LjM4NDE3IGMgMS40MTgzMjQsLTAuMDAzIDEuOTc0ODc4LC0wLjMwOTk3OCAyLjkxMjE0OCwtMS4xNTUyNjkgbCAxLjMyMDMxMSwxLjM3NTgwNCBjIC0wLjkwNzE4OCwxLjAyMTk1MSAtMi4xMzkyNjksMS42MzAxNzggLTQuMjMzMDEsMS42Mzk3MzEgLTMuNDk5MTI1LDAuMDUzNzMgLTUuNTE5NDMxLC0yLjM0MzMwNSAtNS41MzU2MiwtNS41MzMwMDQgLTAuMDc3NDgsLTMuNDY4MjExIDIuMjY3NjE1LC01LjYwMDQxMyA1LjQ0MDE2MywtNS42MTc1MjQgMi4xOTc3MTgsLTAuMDM0MTggMi45NDQ4MDYsMC40NjQyMDQgNC4xNDA2ODEsMS42MTA4MjIgbCAtMS4zMDQ3NjUsMS4yMzEzNCBjIC0wLjg5MzA3NCwtMC42ODk2MzEgLTEuMzI2MzI1LC0wLjk5ODYwNiAtMi42NjczNDUsLTAuOTkyMjAxIC0yLjI3MjA5NiwwLjAxNzE0IC0zLjYzNDQwNywxLjcyNjE0NyAtMy42NDIzNDUsMy42Nzg5NDMgLTAuMDI4NjcsMi4xMzA3NzkgMS40NDM1ODQsMy43NDYyMzIgMy41NjkxNDEsMy43NTk3MTQgeiIKICAgICAgICAgc3R5bGU9ImZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjIuMTE2NjdweDtmb250LWZhbWlseTonTGliZXJhdGlvbiBTYW5zIE5hcnJvdyc7LWlua3NjYXBlLWZvbnQtc3BlY2lmaWNhdGlvbjonTGliZXJhdGlvbiBTYW5zIE5hcnJvdyBCb2xkJztmaWxsOiMwMDAwMDA7c3Ryb2tlLXdpZHRoOjIuMTkzODYiCiAgICAgICAgIGlkPSJwYXRoMzYwOCIKICAgICAgICAgc29kaXBvZGk6bm9kZXR5cGVzPSJjY2NjY2NjY2NjY2MiIC8+PHBhdGgKICAgICAgICAgZD0iTSA5Ny45MTM3MDYsNTUuOTA2NzU1IFYgNDUuNDMwODMzIGggOC4wNzQ3MTQgdiAxLjg0OTg0IGggLTYuMTc4NDAyIHYgMi40NzczMTQgaCA2LjE2OTg5MiB2IDEuOTcxNDUgaCAtNi4xNjk4OTIgdiAyLjQ4MjE2NSBoIDYuMTczNzgyIHYgMS42OTUxNTMgeiIKICAgICAgICAgc3R5bGU9ImZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjIuMTE2NjdweDtmb250LWZhbWlseTonTGliZXJhdGlvbiBTYW5zIE5hcnJvdyc7LWlua3NjYXBlLWZvbnQtc3BlY2lmaWNhdGlvbjonTGliZXJhdGlvbiBTYW5zIE5hcnJvdyBCb2xkJztmaWxsOiMwMDAwMDA7c3Ryb2tlLXdpZHRoOjIuMDQzMTMiCiAgICAgICAgIGlkPSJwYXRoMzYxMCIKICAgICAgICAgc29kaXBvZGk6bm9kZXR5cGVzPSJjY2NjY2NjY2NjY2NjIiAvPjxwYXRoCiAgICAgICAgIGlkPSJwYXRoMzU5NSIKICAgICAgICAgc3R5bGU9ImZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjIuMTE2NjdweDtmb250LWZhbWlseTonTGliZXJhdGlvbiBTYW5zJzstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOidMaWJlcmF0aW9uIFNhbnMgQm9sZCc7ZmlsbDojMDAwMDAwO3N0cm9rZS13aWR0aDo2Ljg0MjY5IgogICAgICAgICBkPSJNIDIyLjE3NTgxLDcuNTU3ODI4MSBWIDE0LjY0NTU0IGMgNi4zMTUxMzEsMC4wMTIyMyA4LjAzNzI3MSw0LjEyMTM1NSA4LjEyNzE3NSw3LjM2OTI2MiB2IDUuMjFlLTQgYyAtMC4wMjc3OSwzLjUzMTk3MyAtMi44NDY1NTEsNi45Njc1ODYgLTYuNTA3MzY2LDcuMTE2MDE5IEggMTYuNTU5NjkgdiAtNi44MzkxIEggOS40ODk1NTM5IFYgNDkuNTYxMTM1IEggMTYuNTU5MTcyIFYgMzYuMjMzNTU4IGggNy40NTAzNjggYyA2Ljc1NzY2MywtMC4wOTE0MiAxMy4yNTk5ODEsLTYuMjE1NDE2IDEzLjI1NzA2NiwtMTQuMjUyMjY2IGwgLTUuMThlLTQsLTAuMDAxIEMgMzcuMzQwODk2LDEzLjQ5MTQ1NCAzMC42NzU5OCw3LjUyOTExOTggMjIuMTc1ODEsNy41NTc4NTgyIFoiCiAgICAgICAgIHNvZGlwb2RpOm5vZGV0eXBlcz0iY2NjY2NjY2NjY2NjY2NjIiAvPjxwYXRoCiAgICAgICAgIGQ9Im0gODQuNTI4MzEyLDM2LjIyNDk4OCAtNi4wNTM0OTEsLTguMzgzNzU1IC02LjI3NDU5OCw4LjM4Mzc1NSBoIC03LjI2NTkyNiBsIDIuMDFlLTQsLTAuOTU0OTcyIDkuMjg2MDYyLC0xMi44NTM1OTkgLTkuMjg5MzcsLTEyLjU0OTM5NTMgMC4wMDIsLTEuMDI2NDAxOCBoIDcuODg3Nzk1IGwgNS44MzA0NzEsOC4wMTcyNTMxIDUuOTk4MjQsLTguMDE3MjUzMSBoIDcuNjkyMDE5IGwgMy4xZS01LDEuMDQyODMwOSAtOS40NTUxNTUsMTIuNDcwNDY3MiA5LjQ0OTYxMSwxMi44ODU3MDYgLTAuMDA5LDAuOTg1MzY0IHoiCiAgICAgICAgIGlkPSJwYXRoMzU5OSIKICAgICAgICAgc3R5bGU9ImZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjIuMTE2NjdweDtmb250LWZhbWlseTonTGliZXJhdGlvbiBTYW5zJzstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOidMaWJlcmF0aW9uIFNhbnMgQm9sZCc7ZmlsbDojMDAwMDAwO3N0cm9rZS13aWR0aDo1LjEyMTkxIgogICAgICAgICBzb2RpcG9kaTpub2RldHlwZXM9ImNjY2NjY2NjY2NjY2NjY2NjIiAvPjwvZz48L2c+PC9zdmc+Cg==';
    if (!companyLogo) companyLogo = fixedLogo;

    if (!companyName && !companyLogo) return canvas;
    
    const padding = 50;
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
            const h = 30;
            const w = h * aspect;
            ctx.drawImage(img, 20, 10, w, h);
            
            if (companyName) {
                ctx.fillStyle = textColor;
                ctx.font = 'bold 16px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(companyName, 20 + w + 15, 25);
            }
        } catch(e) {
            console.warn('Failed to load watermark logo', e);
            if (companyName) {
                ctx.fillStyle = textColor;
                ctx.font = 'bold 16px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(companyName, 20, 25);
            }
        }
    } else if (companyName) {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 16px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(companyName, 20, 25);
    }
    
    return newCanvas;
}

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
                console.error("Export failed", err);
            } finally {
                icon.className = originalClass;
                exportBtn.disabled = false;
            }
        }
    });

}
