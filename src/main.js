// Imports
import './style.css';
import Chart from 'chart.js/auto';

// State
let azureConfig = JSON.parse(localStorage.getItem('azure_config')) || null;
let currentData = { items: [], tree: [] };
let charts = {
    comparison: null,
    aging: null,
    assignee: null,
    cfd: null
};
let heatmapData = null; // Store for responsive re-renders
let heatmapResizeObserver = null;
let ganttOffset = 0; 
let currentTheme = localStorage.getItem('theme') || 'dark';
let workItemMetadata = {
    types: {},
    backlogs: [],
    states: {} // { 'InProgress': { color: '', category: '' } }
};

// DOM Elements
const setupView = document.getElementById('setup-view');
const dashboardView = document.getElementById('dashboard-view');
const setupForm = document.getElementById('setup-form');
const querySelector = document.getElementById('query-selector');
const progressList = document.getElementById('progress-list');
const ganttContainer = document.getElementById('gantt-container');
const itemsView = document.getElementById('items-view');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const themeToggle = document.getElementById('theme-toggle');
const ganttPeriod = document.getElementById('gantt-period');
const ganttPrev = document.getElementById('gantt-prev');
const ganttNext = document.getElementById('gantt-next');
const dataControls = document.getElementById('data-controls');

// Tab Elements
const tabDashboard = document.getElementById('tab-dashboard');
const tabItems = document.getElementById('tab-items');
const tabSetup = document.getElementById('tab-setup');
const tabsNav = document.querySelector('.tabs-nav');

// Apply Theme on Load
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon();

// Initialize
if (azureConfig) {
    showDashboard();
} else {
    switchTab('setup');
}

// Tab Switching
function switchTab(tabId) {
    // Buttons
    tabDashboard.classList.toggle('active', tabId === 'dashboard');
    tabItems.classList.toggle('active', tabId === 'items');
    tabSetup.classList.toggle('active', tabId === 'setup');

    // Views
    dashboardView.classList.toggle('hidden', tabId !== 'dashboard');
    itemsView.classList.toggle('hidden', tabId !== 'items');
    setupView.classList.toggle('hidden', tabId !== 'setup');

    // Data Controls Visibility
    dataControls.classList.toggle('hidden', tabId === 'setup');
}

tabDashboard.addEventListener('click', () => switchTab('dashboard'));
tabItems.addEventListener('click', () => switchTab('items'));
tabSetup.addEventListener('click', () => switchTab('setup'));

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

    renderLegends();
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

// Gantt Status Filter Listeners
document.querySelectorAll('.gantt-status-filters input').forEach(cb => {
    cb.addEventListener('change', () => {
        if (currentData.tree.length > 0) renderGantt(currentData.tree);
    });
});

async function showDashboard(initialQueries = null) {
    switchTab('dashboard');
    
    // Fetch Metadata first
    if (Object.keys(workItemMetadata.types).length === 0) {
        await fetchMetadata(azureConfig);
    }

    const queries = initialQueries || await fetchQueries(azureConfig);
    populateQueries(queries);
    renderLegends(currentData?.items || []);
}

async function fetchMetadata(config) {
    try {
        const auth = btoa(':' + config.pat);
        
        // 1. Fetch Work Item Types (Colors and names)
        const typesUrl = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workitemtypes?api-version=6.0`;
        const typesResp = await fetch(typesUrl, { headers: { 'Authorization': `Basic ${auth}` }, cache: 'no-store' });
        const typesData = await typesResp.json();
        
        const typePromises = typesData.value.map(async (type) => {
            const lowName = type.name.toLowerCase();
            let iconData = null;
            if (type.icon && type.icon.url) {
                iconData = await getBase64Image(type.icon.url, auth);
            }
            
            workItemMetadata.types[lowName] = {
                name: type.name,
                color: type.color ? (type.color.startsWith('#') ? type.color : '#' + type.color) : '#64748b',
                description: type.description,
                iconData: iconData,
                states: {}
            };
        });
        await Promise.all(typePromises);

        // 2. Fetch States for ALL discovered Work Item Types
        for (const type of typesData.value) {
            try {
                const statesUrl = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workitemtypes/${type.name}/states?api-version=6.0`;
                const statesResp = await fetch(statesUrl, { headers: { 'Authorization': `Basic ${auth}` }, cache: 'no-store' });
                if (!statesResp.ok) continue;
                const statesData = await statesResp.json();
                
                statesData.value.forEach(s => {
                    const lowState = s.name.toLowerCase();
                    if (!workItemMetadata.states[lowState]) {
                        workItemMetadata.states[lowState] = {
                            name: s.name,
                            color: s.color ? (s.color.startsWith('#') ? s.color : '#' + s.color) : '#64748b',
                            category: s.category // Proposed, InProgress, Completed, Removed
                        };
                    }
                });
            } catch (e) { /* ignore types that don't exist */ }
        }

        // 3. Fetch Backlog Configurations (Levels and Priority)
        const teamsUrl = `https://dev.azure.com/${config.org}/${config.project}/_apis/teams?api-version=6.0-preview.3`;
        const teamsResp = await fetch(teamsUrl, { headers: { 'Authorization': `Basic ${auth}` }, cache: 'no-store' });
        const teamsData = await teamsResp.json();
        
        if (teamsData.value && teamsData.value.length > 0) {
            const teamId = teamsData.value[0].id;
            const backlogsUrl = `https://dev.azure.com/${config.org}/${config.project}/${teamId}/_apis/work/backlogs?api-version=6.0-preview.1`;
            const backlogsResp = await fetch(backlogsUrl, { headers: { 'Authorization': `Basic ${auth}` }, cache: 'no-store' });
            const backlogsData = await backlogsResp.json();
            
            workItemMetadata.backlogs = backlogsData.value.map(b => ({
                name: b.name,
                type: b.type,
                workItemTypes: b.workItemTypes.map(wit => wit.name.toLowerCase())
            }));
            console.log('Backlogs loaded:', workItemMetadata.backlogs);
        }

        renderLegends();
    } catch (e) {
        console.error('Failed to fetch Azure DevOps metadata:', e);
    }
}

async function getBase64Image(url, auth) {
    try {
        const resp = await fetch(url, { headers: { 'Authorization': `Basic ${auth}` } });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return null;
    }
}

function renderLegends(activeItems = []) {
    const statusLegend = document.getElementById('status-legend');
    const typeLegend = document.getElementById('type-legend');
    if (!statusLegend || !typeLegend) return;

    // Extract active statuses and types if items provided
    const activeStatesSet = new Set();
    const activeTypesSet = new Set();
    
    if (activeItems.length > 0) {
        activeItems.forEach(item => {
            const state = item.fields['System.State'];
            const type = item.fields['System.WorkItemType'];
            if (state) activeStatesSet.add(state.toLowerCase());
            if (type) activeTypesSet.add(type.toLowerCase());
        });
    }

    // 1. Render Status Legend (Grouped by Category)
    const categories = {
        'Proposed': { label: 'Backlog', class: 'bg-backlog' },
        'InProgress': { label: 'In Progress', class: 'bg-inprogress' },
        'Completed': { label: 'Done', class: 'bg-done' },
        'Removed': { label: 'Removed', class: 'bg-removed' }
    };

    statusLegend.innerHTML = '';
    Object.entries(categories).forEach(([cat, info]) => {
        // If we have active items, check if this category is represented
        if (activeItems.length > 0) {
            const hasCategory = Object.values(workItemMetadata.states).some(s => 
                s.category === cat && activeStatesSet.has(s.name.toLowerCase())
            );
            
            // Fallback for categories without official metadata states
            const fallbackHasCategory = activeItems.some(item => {
                const sInfo = getStatusInfo(item.fields['System.State']);
                return sInfo.label === info.label;
            });

            if (!hasCategory && !fallbackHasCategory) return;
        }

        const item = document.createElement('div');
        item.className = 'legend-item';
        // Get sample color from states in this category if possible
        const sampleState = Object.values(workItemMetadata.states).find(s => s.category === cat);
        let color = sampleState ? sampleState.color : null;

        // Fallback colors if no official state color found
        if (!color) {
            if (cat === 'Completed') color = '#10b981';
            else if (cat === 'Removed') color = '#64748b';
            else if (cat === 'InProgress') color = '#3b82f6';
            else color = '#94a3b8';
        }
        
        item.innerHTML = `<div class="legend-color" style="background: ${color}"></div> ${info.label}`;
        statusLegend.appendChild(item);
    });

    // 2. Render Type Legend (Dynamic from workItemTypes)
    typeLegend.innerHTML = '';
    
    // Determine which types to show
    let typesToRender = [];
    if (activeItems.length > 0) {
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
        const iconInfo = getItemIcon(typeName);
        
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

    // Helper to get priority from backlogs
    const getTypePriority = (type) => {
        const t = (type || '').toLowerCase();
        
        // Find in backlogs list (ordered from Portfolio down to Task)
        for (let i = 0; i < workItemMetadata.backlogs.length; i++) {
            if (workItemMetadata.backlogs[i].workItemTypes.includes(t)) {
                return i + 1;
            }
        }

        // Fallback or specific rules
        if (t === 'epic') return 1;
        if (t === 'feature') return 2;
        if (['user story', 'product backlog item', 'requirement', 'issue'].includes(t)) return 3;
        if (['task', 'bug'].includes(t)) return 4;
        return 99;
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
    const meta = workItemMetadata.types[t];
    
    // Determine if it's a portfolio item based on backlog levels or common types
    const isPortfolio = workItemMetadata.backlogs.some(b => b.type === 'portfolio' && b.workItemTypes.includes(t)) || 
                        t === 'epic' || t === 'feature';
    
    // Basic defaults with dynamic color
    const base = { 
        icon: 'ph-fill ph-square', 
        iconClass: '', 
        isPortfolio,
        color: meta?.color || '#64748b',
        iconData: meta?.iconData || null
    };

    if (t === 'epic') return { ...base, icon: 'ph-fill ph-crown', iconClass: 'icon-epic' };
    if (t === 'feature') return { ...base, icon: 'ph-fill ph-trophy', iconClass: 'icon-feature' };
    if (t.includes('requirement') || t === 'user story' || t === 'product backlog item' || t === 'issue') {
        return { ...base, icon: 'ph-fill ph-notebook', iconClass: 'icon-userstory' };
    }
    if (t === 'task') return { ...base, icon: 'ph-fill ph-check-square', iconClass: 'icon-task' };
    if (t === 'bug') return { ...base, icon: 'ph-fill ph-bug', iconClass: 'icon-bug' };
    
    return base;
}

function getStatusInfo(state) {
    const s = (state || '').toLowerCase();
    const meta = workItemMetadata.states[s];
    
    if (meta) {
        if (meta.category === 'Completed') return { label: 'Done', class: 'bg-done', color: meta.color };
        if (meta.category === 'Removed') return { label: 'Removed', class: 'bg-removed', color: meta.color };
        if (meta.category === 'InProgress') return { label: 'In Progress', class: 'bg-inprogress', color: meta.color };
        return { label: 'Backlog', class: 'bg-backlog', color: meta.color };
    }

    // Fallback logic
    if (['done', 'closed', 'resolved', 'concluído', 'concluido'].includes(s)) {
        return { label: 'Done', class: 'bg-done', color: '#10b981' };
    }
    if (['removed', 'removido'].includes(s)) {
        return { label: 'Removed', class: 'bg-removed', color: '#64748b' };
    }
    if (['active', 'in progress', 'committed', 'doing', 'em progresso', 'ativo'].includes(s)) {
        return { label: 'In Progress', class: 'bg-inprogress', color: '#0078d4' };
    }
    return { label: 'Backlog', class: 'bg-backlog', color: '#b2b2b2' };
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
    const agingData = [];
    const assigneeWorkload = {}; // { 'Name': count }

    const now = new Date();

    items.forEach(item => {
        const fields = item.fields;
        const createdDate = new Date(fields['System.CreatedDate']);
        const activatedDate = fields['Microsoft.VSTS.Common.ActivatedDate'] ? new Date(fields['Microsoft.VSTS.Common.ActivatedDate']) : null;
        const closedDate = fields['Microsoft.VSTS.Common.ClosedDate'] ? new Date(fields['Microsoft.VSTS.Common.ClosedDate']) : null;
        const state = fields['System.State'];
        const changedDate = new Date(fields['System.ChangedDate']);

        // Lead/Cycle Time
        if (closedDate && !isNaN(closedDate)) {
            const leadTime = (closedDate - createdDate) / (1000 * 60 * 60 * 24);
            leadTimes.push(leadTime.toFixed(1));
            const cycleTime = activatedDate ? (closedDate - activatedDate) / (1000 * 60 * 60 * 24) : 0;
            cycleTimes.push(cycleTime.toFixed(1));
            labels.push(`ID ${item.id}`);
        }

        // Aging calculation for In Progress items
        const statusInfo = getStatusInfo(state);
        const type = fields['System.WorkItemType']?.toLowerCase();
        
        // Exclude Portfolio-level items (Epics, Features)
        const portfolioTypes = (workItemMetadata.backlogs || [])
            .filter(b => b.type === 'portfolio')
            .flatMap(b => b.workItemTypes);
        
        const isPortfolio = portfolioTypes.includes(type) || type === 'epic' || type === 'feature';
        const isExecutionItem = !isPortfolio;

        // More robust "In Progress" check
        const lowState = (state || '').toLowerCase();
        const isInProgress = statusInfo.label === 'In Progress' || 
                             statusInfo.class === 'bg-inprogress' || 
                             ['active', 'doing', 'in progress', 'em progresso', 'ativo', 'desenvolvimento'].includes(lowState);

        if (isInProgress && isExecutionItem && !isNaN(changedDate)) {
            const ageDays = Math.max(0, Math.floor((now - changedDate) / (1000 * 60 * 60 * 24)));
            agingData.push({
                id: item.id,
                title: fields['System.Title'] || 'No Title',
                age: ageDays,
                state: state
            });
        }

        // Assignee Workload (only for non-portfolio items)
        if (isExecutionItem) {
            let assignee = fields['System.AssignedTo'];
            let name = 'Unassigned';
            
            if (assignee) {
                name = assignee.displayName || assignee.uniqueName || (typeof assignee === 'string' ? assignee : 'Unassigned');
            }
            
            assigneeWorkload[name] = (assigneeWorkload[name] || 0) + 1;
        }
    });

    // CFD Processing: Create a timeline of the last 30 days
    const cfdSeries = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        
        const counts = { date: d, Proposed: 0, InProgress: 0, Done: 0 };
        
        items.forEach(item => {
            const f = item.fields;
            const itemType = f['System.WorkItemType']?.toLowerCase();
            const iconInfo = getItemIcon(itemType);
            if (iconInfo.isPortfolio) return; // Only execution items in CFD

            const created = new Date(f['System.CreatedDate']);
            const activated = f['Microsoft.VSTS.Common.ActivatedDate'] ? new Date(f['Microsoft.VSTS.Common.ActivatedDate']) : null;
            const closed = f['Microsoft.VSTS.Common.ClosedDate'] ? new Date(f['Microsoft.VSTS.Common.ClosedDate']) : null;

            if (created <= d) {
                if (closed && closed <= d) {
                    counts.Done++;
                } else if (activated && activated <= d) {
                    counts.InProgress++;
                } else {
                    counts.Proposed++;
                }
            }
        });
        cfdSeries.push(counts);
    }

    // Activity Heatmap Processing: Count closed items per day
    heatmapData = {}; // { 'YYYY-MM-DD': count }
    items.forEach(item => {
        const closedDate = item.fields['Microsoft.VSTS.Common.ClosedDate'];
        if (closedDate) {
            const dateStr = new Date(closedDate).toISOString().split('T')[0];
            heatmapData[dateStr] = (heatmapData[dateStr] || 0) + 1;
        }
    });

    renderCharts(labels, leadTimes, cycleTimes);
    renderAgingChart(agingData);
    renderAssigneeChart(assigneeWorkload);
    renderCFDChart(cfdSeries);
    renderActivityHeatmap();
    renderPortfolioFilters(items);
    renderProgress(items);
    renderGantt(tree);
    renderLegends(items);
}

function renderCharts(labels, leadTimes, cycleTimes) {
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
                title: { display: true, text: 'Dias', color: textColor }
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
                window.open(getWorkItemUrl(id), '_blank');
            }
        }
    };

    charts.comparison = new Chart(document.getElementById('comparisonChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Lead Time',
                    data: leadTimes,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Cycle Time',
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

function renderAgingChart(agingData) {
    let canvas = document.getElementById('agingChart');
    const container = document.querySelector('#items-view .dashboard-grid .card.glass div[style*="height: 500px"]');
    if (!container) return;

    if (charts.aging) charts.aging.destroy();
    
    if (!agingData || agingData.length === 0) {
        container.innerHTML = `<div id="aging-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>Nenhum item em execução (In Progress) encontrado para esta consulta.</p>
        </div>`;
        return;
    }

    // Restore canvas if it was replaced by message
    if (document.getElementById('aging-empty-msg')) {
        container.innerHTML = '<canvas id="agingChart"></canvas>';
        canvas = document.getElementById('agingChart');
    }

    if (!canvas) return;

    // Sort by age descending
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
                label: 'Days Inactive',
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
                    title: { display: true, text: 'Days Since Last Update', color: textColor }
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
                            return `Days Inactive: ${item.age} | ${item.state}`;
                        }
                    }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const item = agingData[index];
                    window.open(getWorkItemUrl(item.id), '_blank');
                }
            }
        }
    });
}

function renderAssigneeChart(workloadData) {
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
            <p>Nenhum responsável encontrado para os itens da consulta.</p>
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
                label: 'Work Items Count',
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
                    title: { display: true, text: 'Number of Items', color: textColor }
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
                        label: (context) => `Items: ${context.raw}`
                    }
                }
            }
        }
    });
}

function renderCFDChart(cfdSeries) {
    let canvas = document.getElementById('cfdChart');
    const container = document.querySelector('#items-view .dashboard-grid .card.glass[style*="grid-column: 1 / -1"] div[style*="height: 500px"]');
    if (!container) return;

    if (charts.cfd) charts.cfd.destroy();

    if (!cfdSeries || cfdSeries.length === 0) {
        container.innerHTML = `<div id="cfd-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>Dados insuficientes para gerar o CFD.</p>
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

    const labels = cfdSeries.map(d => d.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    
    charts.cfd = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Done',
                    data: cfdSeries.map(d => d.Done),
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.3
                },
                {
                    label: 'In Progress',
                    data: cfdSeries.map(d => d.InProgress),
                    backgroundColor: '#0078d4',
                    borderColor: '#0078d4',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.3
                },
                {
                    label: 'Backlog',
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

function renderActivityHeatmap() {
    const container = document.getElementById('heatmap-container');
    if (!container || !heatmapData) return;
    
    container.innerHTML = '';
    
    // Create inner wrapper
    const heatmapWrapper = document.createElement('div');
    heatmapWrapper.style.display = 'flex';
    heatmapWrapper.style.flexDirection = 'column';
    heatmapWrapper.style.gap = '0.75rem';

    // Fixed calculation: Last 6 months starting from sunday
    const now = new Date();
    const startDate = new Date();
    startDate.setMonth(now.getMonth() - 6);
    startDate.setDate(startDate.getDate() - startDate.getDay()); 
    startDate.setHours(0,0,0,0);

    // Build the data grid of weeks
    const weeks = [];
    let currentWeek = [];
    let iterDate = new Date(startDate);
    
    while (iterDate <= now) {
        currentWeek.push(new Date(iterDate));
        if (iterDate.getDay() === 6) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        iterDate.setDate(iterDate.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Month Row
    const monthsRow = document.createElement('div');
    monthsRow.className = 'heatmap-labels-months';
    monthsRow.style.display = 'flex';
    monthsRow.style.position = 'relative';
    monthsRow.style.height = '1.5rem';
    monthsRow.style.marginLeft = '58px'; // Adjust for wider day labels + gap

    let lastMonth = -1;
    weeks.forEach((week, weekIdx) => {
        const firstDay = week[0];
        if (firstDay.getMonth() !== lastMonth) {
            lastMonth = firstDay.getMonth();
            const monthLabel = document.createElement('div');
            monthLabel.style.position = 'absolute';
            monthLabel.style.left = `${weekIdx * 26}px`; // 22px cell + 4px gap
            monthLabel.style.fontSize = '0.9rem';
            monthLabel.style.color = 'var(--text-muted)';
            monthLabel.textContent = firstDay.toLocaleString('default', { month: 'short' });
            monthsRow.appendChild(monthLabel);
        }
    });
    heatmapWrapper.appendChild(monthsRow);

    const mainRow = document.createElement('div');
    mainRow.style.display = 'flex';
    mainRow.style.gap = '0.75rem';

    // Day Labels
    const daysCol = document.createElement('div');
    daysCol.className = 'heatmap-labels-days';
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach((day, i) => {
        const d = document.createElement('div');
        d.textContent = i % 2 === 0 ? day : '';
        d.style.height = '22px';
        d.style.lineHeight = '22px';
        daysCol.appendChild(d);
    });
    mainRow.appendChild(daysCol);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    grid.style.gridTemplateRows = 'repeat(7, 22px)';
    grid.style.gap = '4px';
    
    weeks.forEach(week => {
        week.forEach(day => {
            const dateStr = day.toISOString().split('T')[0];
            const count = heatmapData[dateStr] || 0;
            
            const dayEl = document.createElement('div');
            dayEl.className = 'heatmap-day';
            
            let level = 0;
            if (count > 0) level = 1;
            if (count > 2) level = 2;
            if (count > 5) level = 3;
            if (count > 10) level = 4;
            
            dayEl.classList.add(`heatmap-l${level}`);
            dayEl.title = `${day.toLocaleDateString()}: ${count} entregas`;
            grid.appendChild(dayEl);
        });
        if (week.length < 7) {
            for (let i = week.length; i < 7; i++) {
                const spacer = document.createElement('div');
                spacer.style.width = '22px';
                spacer.style.height = '22px';
                grid.appendChild(spacer);
            }
        }
    });

    mainRow.appendChild(grid);
    heatmapWrapper.appendChild(mainRow);
    container.appendChild(heatmapWrapper);
}

function renderPortfolioFilters(items) {
    const container = document.getElementById('portfolio-status-filters');
    if (!container) return;

    // 1. Get all unique statuses for portfolio items
    const portfolioStatuses = new Set();
    items.forEach(item => {
        const iconInfo = getItemIcon(item.fields['System.WorkItemType']);
        if (iconInfo.isPortfolio) {
            portfolioStatuses.add(item.fields['System.State']);
        }
    });

    if (portfolioStatuses.size === 0) {
        container.innerHTML = '';
        return;
    }

    // 2. Remember current selection if any
    const previousSelection = new Set(
        Array.from(container.querySelectorAll('input:checked'))
            .map(cb => cb.value)
    );

    // 3. Render checkboxes
    container.innerHTML = '';
    Array.from(portfolioStatuses).sort().forEach(state => {
        const label = document.createElement('label');
        label.className = 'filter-item';
        
        // Default: checked if it was checked before, OR if it's the first time and not 'Done' 
        // (to keep it clean by default, but user said "mostrar todos os status que vierem")
        // I'll check everything by default except maybe 'Done' (concluido) to match previous logic
        const statusInfo = getStatusInfo(state);
        const isChecked = previousSelection.size > 0 
            ? previousSelection.has(state) 
            : statusInfo.label !== 'Done';

        label.innerHTML = `
            <input type="checkbox" value="${state}" ${isChecked ? 'checked' : ''}>
            <span>${state}</span>
        `;
        
        label.querySelector('input').addEventListener('change', () => renderProgress(items));
        container.appendChild(label);
    });
}

function renderProgress(items) {
    progressList.innerHTML = '';
    
    // Get active filters
    const activeFilters = new Set(
        Array.from(document.querySelectorAll('#portfolio-status-filters input:checked'))
            .map(cb => cb.value)
    );

    const filteredItems = items.filter(item => {
        const iconInfo = getItemIcon(item.fields['System.WorkItemType']);
        const state = item.fields['System.State'];
        return iconInfo.isPortfolio && activeFilters.has(state);
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
        
        let iconHtml = `<i class="${iconInfo.icon} ${iconInfo.iconClass}" style="color: ${iconInfo.color}"></i>`;
        if (iconInfo.iconData) {
            iconHtml = `<img src="${iconInfo.iconData}" style="width: 18px; height: 18px;" alt="">`;
        }

        card.innerHTML = `
            <div class="progress-header">
                <a href="${getWorkItemUrl(item.id)}" target="_blank" class="item-link" style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
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

function filterTreeByDate(tree, start, end, activeStatusCategories = null) {
    return tree.map(node => {
        const fields = node.fields;
        const itemStart = new Date(fields['Microsoft.VSTS.Scheduling.StartDate'] || fields['System.CreatedDate']);
        const itemEnd = new Date(fields['Microsoft.VSTS.Scheduling.TargetDate'] || fields['Microsoft.VSTS.Common.ClosedDate'] || new Date());
        
        // Item overlaps if (itemStart <= end AND itemEnd >= start)
        const dateMatch = (itemStart <= end && itemEnd >= start);
        
        // Status match
        let statusMatch = true;
        if (activeStatusCategories) {
            const statusInfo = getStatusInfo(fields['System.State']);
            statusMatch = activeStatusCategories.includes(statusInfo.label.replace(' ', ''));
        }

        const overlaps = dateMatch && statusMatch;
        
        // Recursively filter children
        const filteredChildren = filterTreeByDate(node.children || [], start, end, activeStatusCategories);
        
        // Include item if it overlaps OR if it has filtered children
        if (overlaps || filteredChildren.length > 0) {
            return {
                ...node,
                children: filteredChildren,
                isMatch: overlaps // Track if the item itself matches or just its children
            };
        }
        return null;
    }).filter(node => node !== null);
}

function renderGantt(tree, depth = 0, parentSiblingsActive = []) {
    const periodValue = ganttPeriod.value;
    const { start: viewStart, end: viewEnd } = getGanttDates(periodValue, currentData.items);
    const totalMs = viewEnd - viewStart;

    let displayTree = tree;
    if (depth === 0) {
        const activeStatusCategories = Array.from(document.querySelectorAll('.gantt-status-filters input:checked'))
            .map(cb => cb.getAttribute('data-category'));
            
        displayTree = filterTreeByDate(tree, viewStart, viewEnd, activeStatusCategories);
        
        ganttContainer.innerHTML = '';
        if (displayTree.length === 0) {
            ganttContainer.innerHTML = '<div style="text-align: center; opacity: 0.5; padding: 2rem;">Nenhuma tarefa encontrada neste período.</div>';
            return;
        }

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

    displayTree.forEach((item, index) => {
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

        let iconHtml = `<i class="${iconInfo.icon} ${iconInfo.iconClass}" style="flex-shrink: 0; color: ${iconInfo.color}"></i>`;
        if (iconInfo.iconData) {
            iconHtml = `<img src="${iconInfo.iconData}" style="width: 16px; height: 16px; flex-shrink: 0;" alt="">`;
        }

        row.innerHTML = `
            <div class="gantt-label" title="${fields['System.Title']}">
                ${treeLinesHtml}
                <a href="${getWorkItemUrl(item.id)}" target="_blank" class="item-link" style="flex: 1; overflow: hidden; text-overflow: ellipsis;">
                    ${iconHtml}
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
                <div class="gantt-bar ${statusInfo.class}" style="left: ${Math.max(0, left)}%; width: ${Math.min(100, width)}%; padding-left: 0.5rem; background-color: ${statusInfo.color}">
                    <span>${progress}%</span>
                </div>
                ` : ''}
            </div>
        `;
        ganttContainer.appendChild(row);

        if (item.children && item.children.length > 0) {
            const isLast = (index === displayTree.length - 1);
            const nextActiveSiblings = [...parentSiblingsActive];
            if (depth > 0) nextActiveSiblings.push(!isLast);
            renderGantt(item.children, depth + 1, nextActiveSiblings);
        }
    });
}
