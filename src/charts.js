import Chart from 'chart.js/auto';
import { getWorkItemUrl, getStatusInfo, getItemIcon, calculateProgress } from './utils.js';

/**
 * Analytics and Charting logic
 */

export function renderCharts(labels, leadTimes, cycleTimes, charts, currentTheme, currentLanguage, translations, azureConfig) {
    if (charts.comparison) charts.comparison.destroy();

    const isLight = currentTheme === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { 
                beginAtZero: true, 
                grid: { color: gridColor }, 
                ticks: { color: textColor },
                title: { display: true, text: translations[currentLanguage]['label-days'], color: textColor }
            },
            x: { 
                grid: { display: false }, 
                ticks: { color: textColor, maxRotation: 45, minRotation: 45 } 
            }
        },
        plugins: { 
            legend: { 
                display: true, 
                position: 'top', 
                labels: { color: textColor, font: { weight: 'bold' } } 
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        },
        onClick: (e, elements) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const label = labels[index];
                const id = label.replace('ID ', '');
                window.open(getWorkItemUrl(azureConfig, id), '_blank');
            }
        }
    };

    charts.comparison = new Chart(document.getElementById('comparisonChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: translations[currentLanguage]['metric-lead-time-title'],
                    data: leadTimes,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: translations[currentLanguage]['metric-cycle-time-title'],
                    data: cycleTimes,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: chartOptions
    });
}

export function renderThroughputChart(throughputData, charts, currentTheme, currentLanguage, translations) {
    if (charts.throughput) charts.throughput.destroy();

    const isLight = currentTheme === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    charts.throughput = new Chart(document.getElementById('throughputChart'), {
        type: 'bar',
        data: {
            labels: throughputData.map(d => d.label),
            datasets: [{
                label: translations[currentLanguage]['label-delivered-items'],
                data: throughputData.map(d => d.count),
                backgroundColor: '#3b82f6',
                borderRadius: 6,
                hoverBackgroundColor: '#2563eb'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: gridColor }, 
                    ticks: { color: textColor, stepSize: 1 },
                    title: { display: true, text: translations[currentLanguage]['label-quantity'], color: textColor }
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: textColor } 
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => throughputData[items[0].dataIndex].range,
                        label: (item) => `${translations[currentLanguage]['label-delivered']}: ${item.raw} ${translations[currentLanguage]['label-items']}`
                    }
                }
            }
        }
    });
}

export function renderAgingChart(agingData, charts, currentTheme, currentLanguage, translations, azureConfig) {
    let canvas = document.getElementById('agingChart');
    const container = document.querySelector('#items-view .dashboard-grid .card.glass div[style*="height: 500px"]');
    if (!container) return;

    if (charts.aging) charts.aging.destroy();
    
    if (!agingData || agingData.length === 0) {
        container.innerHTML = `<div id="aging-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>${translations[currentLanguage]['msg-aging-empty']}</p>
        </div>`;
        return;
    }

    if (document.getElementById('aging-empty-msg')) {
        container.innerHTML = '<canvas id="agingChart"></canvas>';
        canvas = document.getElementById('agingChart');
    }

    if (!canvas) return;

    agingData.sort((a, b) => b.age - a.age);
    
    const labels = agingData.map(d => `ID ${d.id} - ${d.title.substring(0, 30)}${d.title.length > 30 ? '...' : ''}`);
    const values = agingData.map(d => d.age);
    
    const isLight = currentTheme === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    charts.aging = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: translations[currentLanguage]['label-days-inactive'],
                data: values,
                backgroundColor: values.map(v => v > 15 ? '#ef4444' : (v > 7 ? '#f59e0b' : '#3b82f6')),
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    beginAtZero: true, 
                    grid: { color: gridColor }, 
                    ticks: { color: textColor },
                    title: { display: true, text: translations[currentLanguage]['label-days-since-update'], color: textColor }
                },
                y: { 
                    grid: { display: false }, 
                    ticks: { color: textColor, font: { size: 10 } } 
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const item = agingData[context.dataIndex];
                            return `${translations[currentLanguage]['label-days-inactive']}: ${item.age} | ${item.state}`;
                        }
                    }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const item = agingData[index];
                    window.open(getWorkItemUrl(azureConfig, item.id), '_blank');
                }
            }
        }
    });
}

export function renderAssigneeChart(workloadData, charts, currentTheme, currentLanguage, translations) {
    let canvas = document.getElementById('assigneeChart');
    const allContainers = document.querySelectorAll('#items-view .dashboard-grid .card.glass div[style*="height: 500px"]');
    const container = allContainers[1] || allContainers[0]?.parentElement?.querySelector('.card.glass:last-child div[style*="height: 500px"]');
    if (!container) return;

    if (charts.assignee) charts.assignee.destroy();

    const names = Object.keys(workloadData).sort((a, b) => workloadData[b] - workloadData[a]);
    const counts = names.map(name => workloadData[name]);

    if (names.length === 0) {
        container.innerHTML = `<div id="assignee-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>${translations[currentLanguage]['msg-assignee-empty']}</p>
        </div>`;
        return;
    }

    if (document.getElementById('assignee-empty-msg')) {
        container.innerHTML = '<canvas id="assigneeChart"></canvas>';
        canvas = document.getElementById('assigneeChart');
    }

    if (!canvas) return;

    const isLight = currentTheme === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    charts.assignee = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: names,
            datasets: [{
                label: translations[currentLanguage]['label-items-count'],
                data: counts,
                backgroundColor: '#8b5cf6',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    beginAtZero: true, 
                    grid: { color: gridColor }, 
                    ticks: { color: textColor, stepSize: 1 },
                    title: { display: true, text: translations[currentLanguage]['label-number-of-items'], color: textColor }
                },
                y: { 
                    grid: { display: false }, 
                    ticks: { color: textColor } 
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${translations[currentLanguage]['label-items']}: ${context.raw}`
                    }
                }
            }
        }
    });
}

export function renderWIPChart(boardColumnData, charts, currentTheme, currentLanguage, translations) {
    let canvas = document.getElementById('wipChart');
    const container = canvas?.parentElement;
    if (!container) return;

    if (charts.wip) charts.wip.destroy();

    const columns = Object.keys(boardColumnData);
    const counts = columns.map(col => boardColumnData[col]);

    if (columns.length === 0) {
        container.innerHTML = `<div id="wip-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>${translations[currentLanguage]['msg-wip-empty']}</p>
        </div>`;
        return;
    }

    if (document.getElementById('wip-empty-msg')) {
        container.innerHTML = '<canvas id="wipChart"></canvas>';
        canvas = document.getElementById('wipChart');
    }

    if (!canvas) return;

    const isLight = currentTheme === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    charts.wip = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: columns,
            datasets: [{
                label: translations[currentLanguage]['label-items-count'],
                data: counts,
                backgroundColor: '#f59e0b',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: gridColor }, 
                    ticks: { color: textColor, stepSize: 1 },
                    title: { display: true, text: translations[currentLanguage]['label-quantity'], color: textColor }
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: textColor } 
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${translations[currentLanguage]['label-items']}: ${context.raw}`
                    }
                }
            }
        }
    });
}

export function renderCFDChart(cfdSeries, charts, currentTheme, currentLanguage, translations) {
    let canvas = document.getElementById('cfdChart');
    const container = document.querySelector('#items-view .dashboard-grid .card.glass[style*="grid-column: 1 / -1"] div[style*="height: 500px"]');
    if (!container) return;

    if (charts.cfd) charts.cfd.destroy();

    if (!cfdSeries || cfdSeries.length === 0) {
        container.innerHTML = `<div id="cfd-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>${translations[currentLanguage]['msg-cfd-empty']}</p>
        </div>`;
        return;
    }

    if (document.getElementById('cfd-empty-msg')) {
        container.innerHTML = '<canvas id="cfdChart"></canvas>';
        canvas = document.getElementById('cfdChart');
    }

    if (!canvas) return;

    const isLight = currentTheme === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    const labels = cfdSeries.map(d => d.date.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' }));
    
    charts.cfd = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: translations[currentLanguage]['status-done'],
                    data: cfdSeries.map(d => d.Done),
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.3
                },
                {
                    label: translations[currentLanguage]['status-inprogress'],
                    data: cfdSeries.map(d => d.InProgress),
                    backgroundColor: '#0078d4',
                    borderColor: '#0078d4',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.3
                },
                {
                    label: translations[currentLanguage]['status-backlog'],
                    data: cfdSeries.map(d => d.Proposed),
                    backgroundColor: '#b2b2b2',
                    borderColor: '#b2b2b2',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { 
                    grid: { color: gridColor }, 
                    ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } 
                },
                y: { 
                    stacked: true,
                    beginAtZero: true, 
                    grid: { color: gridColor }, 
                    ticks: { color: textColor } 
                }
            },
            plugins: {
                legend: { 
                    position: 'top',
                    labels: { color: textColor, font: { size: 12 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.raw}`
                    }
                }
            }
        }
    });
}

export function renderPortfolioFilters(items, workItemMetadata, translations, currentLanguage, onFilterChange) {
    const container = document.getElementById('portfolio-status-filters');
    if (!container) return;

    const portfolioStatuses = new Set();
    items.forEach(item => {
        const iconInfo = getItemIcon(item.fields['System.WorkItemType'], workItemMetadata);
        if (iconInfo.isPortfolio) {
            portfolioStatuses.add(item.fields['System.State']);
        }
    });

    if (portfolioStatuses.size === 0) {
        container.innerHTML = '';
        return;
    }

    const previousSelection = new Set(
        Array.from(container.querySelectorAll('input:checked'))
            .map(cb => cb.value)
    );

    container.innerHTML = '';
    Array.from(portfolioStatuses).sort().forEach(state => {
        const label = document.createElement('label');
        label.className = 'filter-item';
        
        const statusInfo = getStatusInfo(state, workItemMetadata);
        const isChecked = previousSelection.size > 0 
            ? previousSelection.has(state) 
            : statusInfo.label !== 'Done';

        label.innerHTML = `
            <input type="checkbox" value="${state}" ${isChecked ? 'checked' : ''}>
            <span>${state}</span>
        `;
        
        label.querySelector('input').addEventListener('change', () => onFilterChange());
        container.appendChild(label);
    });
}

export function renderProgress(items, progressList, translations, currentLanguage, workItemMetadata, azureConfig) {
    if (!progressList) return;
    progressList.innerHTML = '';
    
    const activeFilters = new Set(
        Array.from(document.querySelectorAll('#portfolio-status-filters input:checked'))
            .map(cb => cb.value)
    );

    const filteredItems = items.filter(item => {
        const iconInfo = getItemIcon(item.fields['System.WorkItemType'], workItemMetadata);
        const state = item.fields['System.State'];
        return iconInfo.isPortfolio && activeFilters.has(state);
    });

    if (filteredItems.length === 0) {
        progressList.innerHTML = `<div style="text-align: center; opacity: 0.5; font-size: 0.8rem; padding: 1rem;">${translations[currentLanguage]['msg-portfolio-empty']}</div>`;
        return;
    }

    filteredItems.forEach(item => {
        const progress = calculateProgress(item, workItemMetadata);
        const iconInfo = getItemIcon(item.fields['System.WorkItemType'], workItemMetadata);
        const statusInfo = getStatusInfo(item.fields['System.State'], workItemMetadata);
        const card = document.createElement('div');
        card.className = 'progress-item';
        
        let iconHtml = `<i class="${iconInfo.icon} ${iconInfo.iconClass}" style="color: ${iconInfo.color}"></i>`;
        if (iconInfo.iconData) {
            iconHtml = `<img src="${iconInfo.iconData}" style="width: 18px; height: 18px;" alt="">`;
        }

        card.innerHTML = `
            <div class="progress-header">
                <a href="${getWorkItemUrl(azureConfig, item.id)}" target="_blank" class="item-link" style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                    ${iconHtml}
                    <span style="font-weight: 600;">${item.fields['System.Title']}</span>
                </a>
                <span style="font-weight: bold; margin-left: 0.5rem;">${progress}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progress}%; background: ${statusInfo.color}"></div>
            </div>
        `;
        progressList.appendChild(card);
    });
}

export function renderLegends(activeItems, workItemMetadata, translations, currentLanguage) {
    const statusLegend = document.getElementById('status-legend');
    const typeLegend = document.getElementById('type-legend');
    if (!statusLegend || !typeLegend) return;

    const activeStatesSet = new Set();
    const activeTypesSet = new Set();
    
    if (activeItems && activeItems.length > 0) {
        activeItems.forEach(item => {
            const state = item.fields['System.State'];
            const type = item.fields['System.WorkItemType'];
            if (state) activeStatesSet.add(state.toLowerCase());
            if (type) activeTypesSet.add(type.toLowerCase());
        });
    }

    const lang = translations[currentLanguage];
    const categories = {
        'Proposed': { label: lang['status-backlog'], class: 'bg-backlog' },
        'InProgress': { label: lang['status-inprogress'], class: 'bg-inprogress' },
        'Completed': { label: lang['status-done'], class: 'bg-done' },
        'Removed': { label: lang['status-removed'], class: 'bg-removed' }
    };

    statusLegend.innerHTML = '';
    Object.entries(categories).forEach(([cat, info]) => {
        if (activeItems && activeItems.length > 0) {
            const hasCategory = Object.values(workItemMetadata.states).some(s => 
                s.category === cat && activeStatesSet.has(s.name.toLowerCase())
            );
            
            const fallbackHasCategory = activeItems.some(item => {
                const sInfo = getStatusInfo(item.fields['System.State'], workItemMetadata);
                return sInfo.label === info.label;
            });

            if (!hasCategory && !fallbackHasCategory) return;
        }

        const item = document.createElement('div');
        item.className = 'legend-item';
        const sampleState = Object.values(workItemMetadata.states).find(s => s.category === cat);
        let color = sampleState ? sampleState.color : null;

        if (!color) {
            if (cat === 'Completed') color = '#10b981';
            else if (cat === 'Removed') color = '#64748b';
            else if (cat === 'InProgress') color = '#3b82f6';
            else color = '#94a3b8';
        }
        
        item.innerHTML = `<div class="legend-color" style="background: ${color}"></div> ${info.label}`;
        statusLegend.appendChild(item);
    });

    typeLegend.innerHTML = '';
    let typesToRender = [];
    if (activeItems && activeItems.length > 0) {
        typesToRender = Array.from(activeTypesSet);
    } else {
        typesToRender = workItemMetadata.backlogs.length > 0 
            ? workItemMetadata.backlogs.flatMap(b => b.workItemTypes)
            : Object.keys(workItemMetadata.types);
    }

    const renderedTypes = new Set();
    typesToRender.forEach(typeName => {
        if (renderedTypes.has(typeName)) return;
        renderedTypes.add(typeName);
        
        const type = workItemMetadata.types[typeName];
        if (!type) return;
        const iconInfo = getItemIcon(typeName, workItemMetadata);
        
        const item = document.createElement('div');
        item.className = 'legend-item';
        
        let iconHtml = `<i class="${iconInfo.icon}" style="color: ${type.color}"></i>`;
        if (iconInfo.iconData) {
            iconHtml = `<img src="${iconInfo.iconData}" style="width: 16px; height: 16px;" alt="">`;
        }
        
        item.innerHTML = `${iconHtml} ${type.name}`;
        typeLegend.appendChild(item);
    });
}
