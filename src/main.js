import './style.css';
import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// State
let azureConfig = JSON.parse(localStorage.getItem('azure_config')) || null;
let currentData = { items: [], tree: [] };
let charts = {};
let ganttOffset = 0; 
let currentTheme = localStorage.getItem('theme') || 'dark';

// DOM Elements
const setupView = document.getElementById('setup-view');
const dashboardView = document.getElementById('dashboard-view');
const setupForm = document.getElementById('setup-form');
const querySelector = document.getElementById('query-selector');
const progressList = document.getElementById('progress-list');
const ganttContainer = document.getElementById('gantt-container');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const themeToggle = document.getElementById('theme-toggle');
const ganttPeriod = document.getElementById('gantt-period');
const ganttPrev = document.getElementById('gantt-prev');
const ganttNext = document.getElementById('gantt-next');

// Apply Theme on Load
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon();

// Initialize
if (azureConfig) {
    showDashboard();
}

setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const config = {
        org: document.getElementById('org').value,
        project: document.getElementById('project').value,
        pat: document.getElementById('pat').value
    };
    
    const queries = await fetchQueries(config);
    if (queries) {
        azureConfig = config;
        localStorage.setItem('azure_config', JSON.stringify(config));
        showDashboard(queries);
    } else {
        alert('Falha ao conectar. Verifique seu PAT e configurações.');
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('azure_config');
    location.reload();
});

themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon();
    
    // Refresh charts to match theme
    if (querySelector.value) {
        processAnalytics(currentData.items, currentData.tree);
    }
});

function updateThemeIcon() {
    const icon = themeToggle.querySelector('i');
    if (currentTheme === 'dark') {
        icon.className = 'ph ph-sun-dim';
    } else {
        icon.className = 'ph ph-moon-stars';
    }
}

querySelector.addEventListener('change', (e) => {
    ganttOffset = 0;
    loadQueryData(e.target.value);
});

refreshBtn.addEventListener('click', async () => {
    if (refreshBtn.classList.contains('spinning')) return;
    
    refreshBtn.classList.add('spinning');
    const currentQuery = querySelector.value;
    
    const queries = await fetchQueries(azureConfig);
    if (queries) {
        populateQueries(queries);
        querySelector.value = currentQuery;
    }
    
    if (querySelector.value) {
        await loadQueryData(querySelector.value);
    }
    
    refreshBtn.classList.remove('spinning');
});

ganttPeriod.addEventListener('change', () => {
    ganttOffset = 0;
    const isTotal = ganttPeriod.value === 'total';
    ganttPrev.disabled = isTotal;
    ganttNext.disabled = isTotal;
    ganttPrev.style.opacity = isTotal ? '0.3' : '1';
    ganttNext.style.opacity = isTotal ? '0.3' : '1';
    
    if (currentData.tree.length > 0) renderGantt(currentData.tree);
});

ganttPrev.addEventListener('click', () => {
    if (ganttPeriod.value === 'total') return;
    ganttOffset--;
    renderGantt(currentData.tree);
});

ganttNext.addEventListener('click', () => {
    if (ganttPeriod.value === 'total') return;
    ganttOffset++;
    renderGantt(currentData.tree);
});

async function showDashboard(initialQueries = null) {
    setupView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    
    const queries = initialQueries || await fetchQueries(azureConfig);
    populateQueries(queries);
}

function populateQueries(queries) {
    const currentVal = querySelector.value;
    querySelector.innerHTML = '<option value="">Selecionar Consulta...</option>';
    queries.sort((a, b) => a.name.localeCompare(b.name)).forEach(q => {
        const option = document.createElement('option');
        option.value = q.id;
        option.textContent = q.name;
        querySelector.appendChild(option);
    });
    if (currentVal) querySelector.value = currentVal;
}

// PDF Export Event Listeners
document.querySelectorAll('.export-chart-pdf').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        const chartId = button.getAttribute('data-chart');
        const elementId = button.getAttribute('data-element');
        const targetId = chartId || elementId;
        const targetElement = document.getElementById(targetId);
        const title = button.closest('.card')?.querySelector('.card-title div')?.textContent.trim() || 'Export';
        
        await exportToPDF(targetElement, `${title}.pdf`);
    });
});

document.getElementById('export-all-pdf').addEventListener('click', async () => {
    const btn = document.getElementById('export-all-pdf');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-circle-notch spinning"></i> Generating...';
    btn.disabled = true;

    try {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        
        // Add Title Page
        doc.setFontSize(22);
        doc.setTextColor(99, 102, 241); // Primary color
        doc.text('Azure DevOps Analytics Report', margin, 30);
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139); // Muted color
        doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, 40);
        doc.text(`Project: ${azureConfig.project}`, margin, 47);
        doc.text(`Organization: ${azureConfig.org}`, margin, 54);
        
        const cards = [
            { id: 'leadTimeChart', title: 'Lead Time' },
            { id: 'cycleTimeChart', title: 'Cycle Time' },
            { id: 'comparisonChart', title: 'Comparison' },
            { id: 'gantt-container', title: 'Gantt Chart' }
        ];

        for (const cardInfo of cards) {
            const el = document.getElementById(cardInfo.id);
            if (!el) continue;

            const canvas = await html2canvas(el, {
                scale: 2,
                backgroundColor: currentTheme === 'dark' ? '#0f172a' : '#f8fafc'
            });
            
            doc.addPage();
            doc.setFontSize(16);
            doc.setTextColor(30, 41, 59);
            doc.text(cardInfo.title, margin, 20);
            
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = pageWidth - (margin * 2);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            doc.addImage(imgData, 'PNG', margin, 30, pdfWidth, pdfHeight);
        }

        doc.save('Azure_DevOps_Report.pdf');
    } catch (err) {
        console.error('Export failed:', err);
        alert('Falha ao exportar PDF. Verifique o console.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

async function exportToPDF(element, filename) {
    if (!element) return;
    
    const loadingBtn = document.activeElement;
    const originalHtml = loadingBtn.innerHTML;
    loadingBtn.innerHTML = '<i class="ph ph-circle-notch spinning"></i>';
    
    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: currentTheme === 'dark' ? '#0f172a' : '#f8fafc',
            logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const doc = new jsPDF(canvas.width > canvas.height ? 'l' : 'p', 'mm', 'a4');
        
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth() - 20;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        doc.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight);
        doc.save(filename);
    } catch (err) {
        console.error('Export failed:', err);
    } finally {
        loadingBtn.innerHTML = originalHtml;
    }
}

function showLoading(container) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<i class="ph ph-circle-notch spinning" style="font-size: 2rem; color: var(--primary);"></i>';
    container.style.position = 'relative';
    container.appendChild(overlay);
    return overlay;
}

async function fetchQueries(config) {
    const url = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/queries?$depth=2&api-version=6.0`;
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Basic ${btoa(':' + config.pat)}` },
            cache: 'no-store'
        });
        const data = await response.json();
        
        const allQueries = [];
        const flatten = (items) => {
            items.forEach(item => {
                if (item.isFolder && item.children) {
                    flatten(item.children);
                } else if (!item.isFolder) {
                    allQueries.push(item);
                }
            });
        };
        
        flatten(data.value);
        return allQueries;
    } catch (e) {
        console.error('Error fetching queries:', e);
        return null;
    }
}

async function loadQueryData(queryId) {
    if (!queryId) return;
    
    const itemCards = document.querySelectorAll('.card.glass');
    const loaders = Array.from(itemCards).map(card => showLoading(card));

    try {
        const url = `https://dev.azure.com/${azureConfig.org}/${azureConfig.project}/_apis/wit/wiql/${queryId}?api-version=6.0`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Basic ${btoa(':' + azureConfig.pat)}` },
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
            alert('Nenhum item encontrado nesta consulta.');
            return;
        }

        const items = await fetchFullDetails(ids);
        const tree = buildTree(items);
        currentData = { items, tree };

        processAnalytics(items, tree);
    } catch (e) {
        console.error('Error loading data:', e);
    } finally {
        loaders.forEach(l => l.remove());
    }
}

async function fetchFullDetails(ids) {
    const chunkSize = 200;
    let allItems = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const url = `https://dev.azure.com/${azureConfig.org}/${azureConfig.project}/_apis/wit/workitems?ids=${chunk.join(',')}&$expand=all&api-version=6.0`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Basic ${btoa(':' + azureConfig.pat)}` },
            cache: 'no-store'
        });
        const data = await response.json();
        allItems = allItems.concat(data.value);
    }
    return allItems;
}

function buildTree(items) {
    const itemMap = new Map();
    items.forEach(item => {
        item.children = [];
        itemMap.set(item.id, item);
    });

    const roots = [];
    items.forEach(item => {
        const parentIdField = item.fields['System.Parent']?.id || item.fields['System.Parent'];
        let parentId = parentIdField ? parseInt(parentIdField) : null;

        if (!parentId) {
            const parentRelation = item.relations?.find(r => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
            if (parentRelation) {
                parentId = parseInt(parentRelation.url.split('/').pop());
            }
        }

        if (parentId) {
            const parent = itemMap.get(parentId);
            if (parent) {
                parent.children.push(item);
            } else {
                roots.push(item);
            }
        } else {
            roots.push(item);
        }
    });

    // Helper to get priority
    const getTypePriority = (type) => {
        const t = (type || '').toLowerCase();
        if (t === 'epic') return 1;
        if (t === 'feature') return 2;
        if (['user story', 'product backlog item', 'requirement', 'issue'].includes(t)) return 3;
        if (['task', 'bug'].includes(t)) return 4;
        return 5;
    };

    const sortByPriority = (a, b) => {
        const pA = getTypePriority(a.fields['System.WorkItemType']);
        const pB = getTypePriority(b.fields['System.WorkItemType']);
        if (pA !== pB) return pA - pB;
        return a.id - b.id; // Secondary sort by ID
    };

    // Sort roots
    roots.sort(sortByPriority);

    // Sort all children recursively
    const sortChildren = (node) => {
        if (node.children && node.children.length > 0) {
            node.children.sort(sortByPriority);
            node.children.forEach(sortChildren);
        }
    };
    roots.forEach(sortChildren);

    return roots;
}

function getWorkItemUrl(id) {
    if (!azureConfig) return '#';
    return `https://dev.azure.com/${azureConfig.org}/${azureConfig.project}/_workitems/edit/${id}`;
}

function getItemIcon(type) {
    const t = type.toLowerCase();
    if (t === 'epic') return { icon: 'ph-fill ph-crown', iconClass: 'icon-epic', isPortfolio: true };
    if (t === 'feature') return { icon: 'ph-fill ph-trophy', iconClass: 'icon-feature', isPortfolio: true };
    if (t.includes('requirement') || t === 'user story' || t === 'product backlog item' || t === 'issue') {
        return { icon: 'ph-fill ph-notebook', iconClass: 'icon-userstory', isPortfolio: false };
    }
    if (t === 'task') return { icon: 'ph-fill ph-check-square', iconClass: 'icon-task', isPortfolio: false };
    if (t === 'bug') return { icon: 'ph-fill ph-bug', iconClass: 'icon-bug', isPortfolio: false };
    return { icon: 'ph-fill ph-question', iconClass: '', isPortfolio: false };
}

function getStatusInfo(state) {
    const s = (state || '').toLowerCase();
    
    // Done (Closed, Resolved, etc)
    if (['done', 'closed', 'resolved', 'concluído', 'concluido'].includes(s)) {
        return { label: 'Done', class: 'bg-done' };
    }
    
    // Removed
    if (['removed', 'removido'].includes(s)) {
        return { label: 'Removed', class: 'bg-removed' };
    }
    
    // In Progress (Active, In Progress, Committed, etc)
    if (['active', 'in progress', 'committed', 'doing', 'em progresso', 'ativo'].includes(s)) {
        return { label: 'In Progress', class: 'bg-inprogress' };
    }
    
    // Backlog (New, To Do, Proposto, etc)
    return { label: 'Backlog', class: 'bg-backlog' };
}

function calculateProgress(item) {
    if (!item.children || item.children.length === 0) {
        const state = item.fields['System.State'];
        const info = getStatusInfo(state);
        return (info.label === 'Done') ? 100 : 0;
    }
    const totalChildren = item.children.length;
    const completedChildren = item.children.filter(child => {
        const state = child.fields['System.State'];
        const info = getStatusInfo(state);
        return info.label === 'Done';
    }).length;
    return Math.floor((completedChildren / totalChildren) * 100);
}

function processAnalytics(items, tree) {
    const leadTimes = [];
    const cycleTimes = [];
    const labels = [];

    items.forEach(item => {
        const fields = item.fields;
        const createdDate = new Date(fields['System.CreatedDate']);
        const activatedDate = fields['Microsoft.VSTS.Common.ActivatedDate'] ? new Date(fields['Microsoft.VSTS.Common.ActivatedDate']) : null;
        const closedDate = fields['Microsoft.VSTS.Common.ClosedDate'] ? new Date(fields['Microsoft.VSTS.Common.ClosedDate']) : null;

        if (closedDate && !isNaN(closedDate)) {
            const leadTime = (closedDate - createdDate) / (1000 * 60 * 60 * 24);
            leadTimes.push(leadTime.toFixed(1));
            const cycleTime = activatedDate ? (closedDate - activatedDate) / (1000 * 60 * 60 * 24) : 0;
            cycleTimes.push(cycleTime.toFixed(1));
            labels.push(`ID ${item.id}`);
        }
    });

    renderCharts(labels, leadTimes, cycleTimes);
    renderProgress(items);
    renderGantt(tree);
}

function renderCharts(labels, leadTimes, cycleTimes) {
    if (charts.lead) charts.lead.destroy();
    if (charts.cycle) charts.cycle.destroy();
    if (charts.comparison) charts.comparison.destroy();

    const isLight = currentTheme === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
            x: { grid: { display: false }, ticks: { color: textColor } }
        },
        plugins: { legend: { display: false } }
    };

    charts.lead = new Chart(document.getElementById('leadTimeChart'), {
        type: 'line',
        data: { 
            labels, 
            datasets: [{ 
                label: 'Days', 
                data: leadTimes, 
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4
            }] 
        },
        options: {
            ...chartOptions,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const label = labels[index];
                    const id = label.replace('ID ', '');
                    window.open(getWorkItemUrl(id), '_blank');
                }
            }
        }
    });

    charts.cycle = new Chart(document.getElementById('cycleTimeChart'), {
        type: 'line',
        data: { labels, datasets: [{ label: 'Days', data: cycleTimes, borderColor: '#10b981', tension: 0.4 }] },
        options: {
            ...chartOptions,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const label = labels[index];
                    const id = label.replace('ID ', '');
                    window.open(getWorkItemUrl(id), '_blank');
                }
            }
        }
    });

    // Combined Comparison Chart
    charts.comparison = new Chart(document.getElementById('comparisonChart'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Lead Time',
                    data: leadTimes,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Cycle Time',
                    data: cycleTimes,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            ...chartOptions,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const label = labels[index];
                    const id = label.replace('ID ', '');
                    window.open(getWorkItemUrl(id), '_blank');
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: textColor, font: { weight: 'bold' } }
                }
            }
        }
    });
}

function renderProgress(items) {
    progressList.innerHTML = '';
    
    const filteredItems = items.filter(item => {
        const iconInfo = getItemIcon(item.fields['System.WorkItemType']);
        const statusInfo = getStatusInfo(item.fields['System.State']);
        return iconInfo.isPortfolio && (statusInfo.label === 'Backlog' || statusInfo.label === 'In Progress');
    });

    if (filteredItems.length === 0) {
        progressList.innerHTML = '<div style="text-align: center; opacity: 0.5; font-size: 0.8rem; padding: 1rem;">Nenhuma Feature/Epic ativa encontrada.</div>';
        return;
    }

    filteredItems.forEach(item => {
        const progress = calculateProgress(item);
        const iconInfo = getItemIcon(item.fields['System.WorkItemType']);
        const statusInfo = getStatusInfo(item.fields['System.State']);
        const card = document.createElement('div');
        card.className = 'progress-item';
        card.innerHTML = `
            <div class="progress-header">
                <a href="${getWorkItemUrl(item.id)}" target="_blank" class="item-link" style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                    <i class="${iconInfo.icon} ${iconInfo.iconClass}"></i>
                    <span style="font-weight: 600;">${item.fields['System.Title']}</span>
                </a>
                <span style="font-weight: bold; margin-left: 0.5rem;">${progress}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progress}%; background: var(--status-${statusInfo.label.toLowerCase().replace(' ', '')})"></div>
            </div>
        `;
        progressList.appendChild(card);
    });
}

function getGanttDates(period, items = []) {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (period === 'total' && items.length > 0) {
        let minDate = new Date();
        let maxDate = new Date();
        items.forEach(item => {
            const s = new Date(item.fields['Microsoft.VSTS.Scheduling.StartDate'] || item.fields['System.CreatedDate']);
            const e = new Date(item.fields['Microsoft.VSTS.Scheduling.TargetDate'] || item.fields['Microsoft.VSTS.Common.ClosedDate'] || new Date());
            if (!isNaN(s) && s < minDate) minDate = s;
            if (!isNaN(e) && e > maxDate) maxDate = e;
        });
        start = new Date(minDate);
        end = new Date(maxDate);
        const diff = end - start;
        start = new Date(start.getTime() - diff * 0.05);
        end = new Date(end.getTime() + diff * 0.05);
        return { start, end };
    }

    switch(period) {
        case 'week':
            start.setDate(now.getDate() - now.getDay() + (ganttOffset * 7));
            end = new Date(start);
            end.setDate(start.getDate() + 7);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth() + ganttOffset, 1);
            end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            break;
        case 'bimester':
            const bIndex = Math.floor(now.getMonth() / 2) + ganttOffset;
            start = new Date(now.getFullYear(), bIndex * 2, 1);
            end = new Date(now.getFullYear(), (bIndex + 1) * 2, 1);
            break;
        case 'trimester':
            const tIndex = Math.floor(now.getMonth() / 3) + ganttOffset;
            start = new Date(now.getFullYear(), tIndex * 3, 1);
            end = new Date(now.getFullYear(), (tIndex + 1) * 3, 1);
            break;
        case 'year':
            start = new Date(now.getFullYear() + ganttOffset, 0, 1);
            end = new Date(start.getFullYear() + 1, 0, 1);
            break;
    }
    return { start, end };
}

function renderGantt(tree, depth = 0, parentSiblingsActive = []) {
    const periodValue = ganttPeriod.value;
    const { start: viewStart, end: viewEnd } = getGanttDates(periodValue, currentData.items);
    const totalMs = viewEnd - viewStart;

    if (depth === 0) {
        ganttContainer.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'gantt-header';
        header.innerHTML = `<div class="gantt-label" style="border: none;"></div><div class="gantt-timeline"></div>`;
        const timeline = header.querySelector('.gantt-timeline');
        
        let steps = 4;
        if (periodValue === 'month') steps = 4;
        if (periodValue === 'year') steps = 12;
        if (periodValue === 'week') steps = 7;
        if (periodValue === 'total') steps = 10;

        for (let i = 0; i < steps; i++) {
            const milestone = document.createElement('div');
            milestone.className = 'timeline-milestone';
            const mDate = new Date(viewStart.getTime() + (totalMs / steps) * i);
            milestone.textContent = (periodValue === 'year' || periodValue === 'total') ? mDate.toLocaleString('default', { month: 'short', year: '2-digit' }) : mDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
            timeline.appendChild(milestone);
        }
        ganttContainer.appendChild(header);

        const now = new Date();
        if (now >= viewStart && now <= viewEnd) {
            const todayPos = ((now - viewStart) / totalMs) * 100;
            const line = document.createElement('div');
            line.className = 'today-line';
            line.style.left = `calc(var(--gantt-label-width) + 1rem + ( (100% - var(--gantt-label-width) - 1rem) * ${todayPos / 100} ))`;
            ganttContainer.appendChild(line);
        }
    }

    tree.forEach((item, index) => {
        const fields = item.fields;
        const state = fields['System.State'];
        const iconInfo = getItemIcon(fields['System.WorkItemType']);
        const statusInfo = getStatusInfo(state);

        const itemStart = new Date(fields['Microsoft.VSTS.Scheduling.StartDate'] || fields['System.CreatedDate']);
        const itemEnd = new Date(fields['Microsoft.VSTS.Scheduling.TargetDate'] || fields['Microsoft.VSTS.Common.ClosedDate'] || new Date());

        const left = Math.max(-10, ((itemStart - viewStart) / totalMs) * 100);
        const right = Math.min(110, ((itemEnd - viewStart) / totalMs) * 100);
        const width = Math.max(0.1, right - left);

        const isOutside = (right <= 0 || left >= 100);

        const progress = calculateProgress(item);
        const row = document.createElement('div');
        const hasChildren = item.children && item.children.length > 0;
        const isLast = (index === tree.length - 1);
        row.className = `gantt-row ${hasChildren ? 'parent' : ''} ${depth === 0 ? 'root' : ''} ${isLast ? 'last-child' : ''}`;
        
        let treeLinesHtml = '';
        // Spacers for ancestors
        parentSiblingsActive.forEach(active => {
            treeLinesHtml += `<div class="tree-line spacer ${active ? 'active' : ''}"></div>`;
        });
        // Connector for current level
        if (depth > 0) {
            treeLinesHtml += `<div class="tree-line connector"></div>`;
        }

        const assignedTo = fields['System.AssignedTo']?.displayName || fields['System.AssignedTo'] || '';

        row.innerHTML = `
            <div class="gantt-label" title="${fields['System.Title']}">
                ${treeLinesHtml}
                <a href="${getWorkItemUrl(item.id)}" target="_blank" class="item-link" style="flex: 1; overflow: hidden; text-overflow: ellipsis;">
                    <i class="${iconInfo.icon} ${iconInfo.iconClass}" style="flex-shrink: 0;"></i>
                    <span style="overflow: hidden; text-overflow: ellipsis;">${fields['System.Title']}</span>
                </a>
                <div class="status-indicator">
                    <div class="status-dot" style="background: ${statusInfo.color}"></div>
                    <span>${state}</span>
                </div>
                <div class="assigned-user" title="${assignedTo}">${assignedTo}</div>
            </div>
            <div class="gantt-track">
                ${!isOutside ? `
                <div class="gantt-bar ${statusInfo.class}" style="left: ${Math.max(0, left)}%; width: ${Math.min(100, width)}%; padding-left: 0.5rem;">
                    <span>${progress}%</span>
                </div>
                ` : ''}
            </div>
        `;
        ganttContainer.appendChild(row);

        if (item.children && item.children.length > 0) {
            const isLast = (index === tree.length - 1);
            const nextActiveSiblings = [...parentSiblingsActive];
            if (depth > 0) nextActiveSiblings.push(!isLast);
            renderGantt(item.children, depth + 1, nextActiveSiblings);
        }
    });
}
