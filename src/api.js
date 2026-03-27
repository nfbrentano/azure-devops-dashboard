/**
 * Azure DevOps API interaction logic
 */
import { showToast } from './utils.js';
import { translations } from './translations.js';
import { state } from './state.js';
import { apiCache, TTL } from './cache.js';

export const getAuthHeader = (pat) => `Basic ${btoa(':' + pat)}`;

export async function fetchWithRetry(url, options = {}, maxRetries = 3, initialDelay = 1000) {
    // Skip if this origin is currently throttled
    if (apiCache.isThrottled(url)) {
        console.warn(`[cache] Throttled — skipping request to ${url}`);
        return new Response(JSON.stringify({ value: [] }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    let delay = initialDelay;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            
            // Retry on rate limit (429) or server errors (5xx)
            if (response.status === 429 || (response.status >= 500 && response.status <= 504)) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;

                // Mark origin as throttled so other requests bail out gracefully
                if (response.status === 429) {
                    apiCache.markThrottled(url, waitTime);
                }

                if (i === maxRetries - 1) return response;
                
                await new Promise(res => setTimeout(res, waitTime));
                delay *= 2; // Exponential backoff
                continue;
            }
            
            return response;
        } catch (e) {
            if (i === maxRetries - 1) throw e;
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
}

export async function fetchQueries(config, { bust = false } = {}) {
    const url = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/queries?$depth=2&api-version=6.0`;

    return apiCache.getOrFetch(url, async () => {
        try {
            const response = await fetchWithRetry(url, {
                headers: { 'Authorization': getAuthHeader(config.pat) },
                cache: 'no-cache'
            });
            if (!response.ok) return null;
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
        } catch {
            const errMsg = translations[state.currentLanguage]['msg-error-loading'];
            showToast(errMsg, 'error');
            return null;
        }
    }, TTL.QUERIES, bust);
}

export async function fetchFullDetails(config, ids, onProgress = null, { bust = false } = {}) {
    const chunkSize = 200;
    let allItems = [];
    const auth = getAuthHeader(config.pat);
    const total = ids.length;
    let failedChunks = 0;
    
    for (let i = 0; i < total; i += chunkSize) {
        if (onProgress) {
            onProgress((i / total) * 100);
        }
        
        const chunk = ids.slice(i, i + chunkSize).sort((a, b) => a - b);
        const chunkKey = chunk.join(',');
        const url = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workitems?ids=${chunkKey}&$expand=all&api-version=6.0`;

        const chunkData = await apiCache.getOrFetch(url, async () => {
            try {
                const response = await fetchWithRetry(url, {
                    headers: { 'Authorization': auth },
                    cache: 'no-cache'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} fetching chunk ${i / chunkSize + 1}`);
                }

                const data = await response.json();
                return (data && data.value) ? data.value : [];
            } catch (e) {
                console.error(`Error loading chunk starting at index ${i}:`, e);
                failedChunks++;
                return null;
            }
        }, TTL.WORK_ITEMS, bust);

        if (chunkData) {
            allItems = allItems.concat(chunkData);
        }
    }
    
    if (failedChunks > 0) {
        const lang = translations[state.currentLanguage];
        const msg = failedChunks === 1 
            ? lang['msg-partial-data-single']
            : lang['msg-partial-data-multiple'].replace('{count}', failedChunks);
        showToast(msg, 'warning');
    }
    
    if (onProgress) {
        onProgress(100);
    }
    
    return allItems;
}

export async function fetchWorkItemRevisions(config, id, { bust = false } = {}) {
    const url = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workItems/${id}/revisions?api-version=6.0`;
    const auth = getAuthHeader(config.pat);

    return apiCache.getOrFetch(url, async () => {
        try {
            const response = await fetchWithRetry(url, {
                headers: { 'Authorization': auth },
                cache: 'no-cache'
            });
            if (!response.ok) return null;
            const data = await response.json();
            return data.value || [];
        } catch (e) {
            console.error(`Error fetching revisions for item ${id}:`, e);
            return null;
        }
    }, TTL.REVISIONS, bust);
}

export async function fetchRevisionsForItems(config, ids, onProgress = null, { bust = false } = {}) {
    const total = ids.length;
    const results = {};
    const concurrency = 10;
    let completed = 0;

    const fetchTask = async (id) => {
        const revisions = await fetchWorkItemRevisions(config, id, { bust });
        if (revisions) {
            results[id] = revisions;
        }
        completed++;
        if (onProgress) {
            onProgress((completed / total) * 100);
        }
    };

    // Process in batches
    for (let i = 0; i < ids.length; i += concurrency) {
        const batch = ids.slice(i, i + concurrency);
        await Promise.all(batch.map(id => fetchTask(id)));
    }

    console.log(`Fetched revisions for ${Object.keys(results).length}/${total} items`);
    return results;
}

export async function fetchMetadata(config, workItemMetadata, renderLegends, { bust = false } = {}) {
    const metaCacheKey = `metadata:${config.org}:${config.project}`;

    const cached = bust ? undefined : apiCache.get(metaCacheKey);
    if (cached) {
        // Restore from cache into the shared metadata object
        Object.assign(workItemMetadata.types, cached.types);
        Object.assign(workItemMetadata.states, cached.states);
        workItemMetadata.backlogs = cached.backlogs;
        if (renderLegends) renderLegends();
        return;
    }

    try {
        const auth = getAuthHeader(config.pat);
        
        // 1. Fetch Work Item Types (Colors and names)
        const typesUrl = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workitemtypes?api-version=6.0`;
        const typesResp = await fetchWithRetry(typesUrl, { headers: { 'Authorization': auth } });
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
                const statesResp = await fetchWithRetry(statesUrl, { headers: { 'Authorization': auth } });
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
            } catch { /* ignore types that don't exist */ }
        }

        // 3. Fetch Backlog Configurations
        const teamsUrl = `https://dev.azure.com/${config.org}/${config.project}/_apis/teams?api-version=6.0-preview.3`;
        const teamsResp = await fetchWithRetry(teamsUrl, { headers: { 'Authorization': auth } });
        const teamsData = await teamsResp.json();
        
        if (teamsData.value && teamsData.value.length > 0) {
            const teamId = teamsData.value[0].id;
            const backlogsUrl = `https://dev.azure.com/${config.org}/${config.project}/${teamId}/_apis/work/backlogs?api-version=6.0-preview.1`;
            const backlogsResp = await fetchWithRetry(backlogsUrl, { headers: { 'Authorization': auth } });
            const backlogsData = await backlogsResp.json();
            
            workItemMetadata.backlogs = backlogsData.value.map(b => ({
                name: b.name,
                type: b.type,
                workItemTypes: b.workItemTypes.map(wit => wit.name.toLowerCase())
            }));
        }

        // Store snapshot in cache (deep copies of the plain data — no icons to save memory)
        apiCache.set(metaCacheKey, {
            types: Object.fromEntries(
                Object.entries(workItemMetadata.types).map(([k, v]) => [k, { ...v, iconData: null }])
            ),
            states: { ...workItemMetadata.states },
            backlogs: [...workItemMetadata.backlogs]
        }, TTL.METADATA);

        if (renderLegends) renderLegends();
    } catch {
        showToast(translations[state.currentLanguage]['msg-metadata-failed'], 'error');
    }
}

export async function getBase64Image(url, auth) {
    try {
        const resp = await fetchWithRetry(url, { headers: { 'Authorization': auth } });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

export function buildTree(items, workItemMetadata) {
    const nodeMap = new Map();
    const nodes = items.map(item => {
        const node = { ...item, children: [] };
        nodeMap.set(node.id, node);
        return node;
    });

    const roots = [];
    nodes.forEach(node => {
        const parentIdField = node.fields['System.Parent']?.id || node.fields['System.Parent'];
        let parentId = parentIdField ? parseInt(parentIdField) : null;

        if (!parentId) {
            const parentRelation = node.relations?.find(r => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
            if (parentRelation) {
                parentId = parseInt(parentRelation.url.split('/').pop());
            }
        }

        if (parentId) {
            const parent = nodeMap.get(parentId);
            if (parent) {
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        } else {
            roots.push(node);
        }
    });

    roots.sort((a, b) => sortByPriority(a, b, workItemMetadata));
    const sortChildren = (node) => {
        if (node.children && node.children.length > 0) {
            node.children.sort((a, b) => sortByPriority(a, b, workItemMetadata));
            node.children.forEach(sortChildren);
        }
    };
    roots.forEach(sortChildren);

    return { roots, nodes };
}

export function getTypePriority(type, workItemMetadata) {
    const t = (type || '').toLowerCase();
    if (workItemMetadata && workItemMetadata.backlogs) {
        for (let i = 0; i < workItemMetadata.backlogs.length; i++) {
            if (workItemMetadata.backlogs[i].workItemTypes.includes(t)) {
                return i + 1;
            }
        }
    }
    // Fallbacks
    if (t === 'epic') return 1;
    if (t === 'feature') return 2;
    if (['user story', 'product backlog item', 'requirement', 'issue'].includes(t)) return 3;
    if (['task', 'bug'].includes(t)) return 4;
    return 99;
}

function sortByPriority(a, b, workItemMetadata) {
    const pA = getTypePriority(a.fields['System.WorkItemType'], workItemMetadata);
    const pB = getTypePriority(b.fields['System.WorkItemType'], workItemMetadata);
    if (pA !== pB) return pA - pB;
    return a.id - b.id;
}
