/**
 * Azure DevOps API interaction logic
 */
import { showToast } from './utils.ts';
import { translations } from './translations.ts';
import { state } from './state.ts';
import { apiCache, TTL } from './cache.ts';
import type { AzureConfig, WorkItem, WorkItemMetadata, WorkItemNode, SavedQuery } from './types.ts';

export const getAuthHeader = (pat: string): string => `Basic ${btoa(':' + pat)}`;

export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxRetries = 3,
    initialDelay = 1000
): Promise<Response> {
    // Skip if this origin is currently throttled
    if (apiCache.isThrottled(url)) {
        console.warn(`[cache] Throttled — skipping request to ${url}`);
        return new Response(JSON.stringify({ value: [] }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
        });
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

                await new Promise((res) => setTimeout(res, waitTime));
                delay *= 2; // Exponential backoff
                continue;
            }

            return response;
        } catch (e) {
            if (i === maxRetries - 1) throw e;
            await new Promise((res) => setTimeout(res, delay));
            delay *= 2;
        }
    }

    // Should never reach here, but TypeScript needs a return
    throw new Error(`fetchWithRetry: exhausted ${maxRetries} retries for ${url}`);
}

export async function fetchQueries(config: AzureConfig, { bust = false } = {}): Promise<SavedQuery[] | null> {
    const url = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/queries?$depth=2&api-version=6.0`;

    return apiCache.getOrFetch(
        url,
        async () => {
            try {
                const response = await fetchWithRetry(url, {
                    headers: { Authorization: getAuthHeader(config.pat) },
                    cache: 'no-cache'
                });
                if (!response.ok) return null;
                const data = await response.json();

                const allQueries: SavedQuery[] = [];
                const flatten = (items: SavedQuery[]): void => {
                    items.forEach((item) => {
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
        },
        TTL.QUERIES,
        bust
    );
}

export async function fetchFullDetails(
    config: AzureConfig,
    ids: number[],
    onProgress: ((pct: number) => void) | null = null,
    { bust = false } = {}
): Promise<WorkItem[]> {
    const chunkSize = 200;
    let allItems: WorkItem[] = [];
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

        const chunkData = await apiCache.getOrFetch(
            url,
            async () => {
                try {
                    const response = await fetchWithRetry(url, {
                        headers: { Authorization: auth },
                        cache: 'no-cache'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status} fetching chunk ${i / chunkSize + 1}`);
                    }

                    const data = await response.json();
                    return data && data.value ? (data.value as WorkItem[]) : [];
                } catch (e) {
                    console.error(`Error loading chunk starting at index ${i}:`, e);
                    failedChunks++;
                    return null;
                }
            },
            TTL.WORK_ITEMS,
            bust
        );

        if (chunkData) {
            allItems = allItems.concat(chunkData);
        }
    }

    if (failedChunks > 0) {
        const lang = translations[state.currentLanguage];
        const msg =
            failedChunks === 1
                ? lang['msg-partial-data-single']
                : lang['msg-partial-data-multiple'].replace('{count}', String(failedChunks));
        showToast(msg, 'warning');
    }

    if (onProgress) {
        onProgress(100);
    }

    return allItems;
}

export async function fetchWorkItemRevisions(
    config: AzureConfig,
    id: number,
    { bust = false } = {}
): Promise<WorkItem[] | null> {
    const url = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workItems/${id}/revisions?api-version=6.0`;
    const auth = getAuthHeader(config.pat);

    return apiCache.getOrFetch(
        url,
        async () => {
            try {
                const response = await fetchWithRetry(url, {
                    headers: { Authorization: auth },
                    cache: 'no-cache'
                });
                if (!response.ok) return null;
                const data = await response.json();
                return (data.value || []) as WorkItem[];
            } catch (e) {
                console.error(`Error fetching revisions for item ${id}:`, e);
                return null;
            }
        },
        TTL.REVISIONS,
        bust
    );
}

export async function fetchRevisionsForItems(
    config: AzureConfig,
    ids: number[],
    onProgress: ((pct: number) => void) | null = null,
    { bust = false } = {}
): Promise<Record<number, WorkItem[]>> {
    const total = ids.length;
    const results: Record<number, WorkItem[]> = {};
    const concurrency = 10;
    let completed = 0;

    const fetchTask = async (id: number): Promise<void> => {
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
        await Promise.all(batch.map((id) => fetchTask(id)));
    }

    console.log(`Fetched revisions for ${Object.keys(results).length}/${total} items`);
    return results;
}

export async function fetchMetadata(
    config: AzureConfig,
    workItemMetadata: WorkItemMetadata,
    renderLegends: ((...args: unknown[]) => void) | null,
    { bust = false } = {}
): Promise<void> {
    const metaCacheKey = `metadata:${config.org}:${config.project}`;

    const cached = bust
        ? undefined
        : apiCache.get<{
              types: Record<string, WorkItemMetadata['types'][string]>;
              states: WorkItemMetadata['states'];
              backlogs: WorkItemMetadata['backlogs'];
          }>(metaCacheKey);
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
        const typesResp = await fetchWithRetry(typesUrl, { headers: { Authorization: auth } });
        const typesData = await typesResp.json();

        const typePromises = typesData.value.map(
            async (type: { name: string; color?: string; description?: string; icon?: { url: string } }) => {
                const lowName = type.name.toLowerCase();
                let iconData: string | null = null;
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
            }
        );
        await Promise.all(typePromises);

        // 2. Fetch States for ALL discovered Work Item Types
        for (const type of typesData.value) {
            try {
                const statesUrl = `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workitemtypes/${type.name}/states?api-version=6.0`;
                const statesResp = await fetchWithRetry(statesUrl, { headers: { Authorization: auth } });
                if (!statesResp.ok) continue;
                const statesData = await statesResp.json();

                statesData.value.forEach((s: { name: string; color?: string; category: string }) => {
                    const lowState = s.name.toLowerCase();
                    if (!workItemMetadata.states[lowState]) {
                        workItemMetadata.states[lowState] = {
                            name: s.name,
                            color: s.color ? (s.color.startsWith('#') ? s.color : '#' + s.color) : '#64748b',
                            category: s.category as 'Proposed' | 'InProgress' | 'Completed' | 'Removed'
                        };
                    }
                });
            } catch {
                /* ignore types that don't exist */
            }
        }

        // 3. Fetch Backlog Configurations
        try {
            const teamsUrl = `https://dev.azure.com/${config.org}/${config.project}/_apis/teams?api-version=6.0-preview.3`;
            const teamsResp = await fetchWithRetry(teamsUrl, { headers: { Authorization: auth } }, 1);
            if (teamsResp.ok) {
                const teamsData = await teamsResp.json();
                if (teamsData.value && teamsData.value.length > 0) {
                    const teamId = teamsData.value[0].id;
                    const backlogsUrl = `https://dev.azure.com/${config.org}/${config.project}/${teamId}/_apis/work/backlogs?api-version=6.0-preview.1`;
                    const backlogsResp = await fetchWithRetry(backlogsUrl, { headers: { Authorization: auth } }, 1);
                    if (backlogsResp.ok) {
                        const backlogsData = await backlogsResp.json();
                        workItemMetadata.backlogs = backlogsData.value.map(
                            (b: { name: string; type: string; workItemTypes: { name: string }[] }) => ({
                                name: b.name,
                                type: b.type,
                                workItemTypes: b.workItemTypes.map((wit) => wit.name.toLowerCase())
                            })
                        );
                    }
                }
            }
        } catch {
            console.log('Informação: As configurações de times/backlogs não puderam ser carregadas (provavelmente devido a CORS ou permissões do PAT). O app usará as configurações padrão.');
        }

        // Store snapshot in cache
        apiCache.set(
            metaCacheKey,
            {
                types: Object.fromEntries(
                    Object.entries(workItemMetadata.types).map(([k, v]) => [k, { ...v, iconData: null }])
                ),
                states: { ...workItemMetadata.states },
                backlogs: [...workItemMetadata.backlogs]
            },
            TTL.METADATA
        );

        if (renderLegends) renderLegends();
    } catch {
        showToast(translations[state.currentLanguage]['msg-metadata-failed'], 'error');
    }
}

export async function getBase64Image(url: string, auth: string): Promise<string | null> {
    try {
        const resp = await fetchWithRetry(url, { headers: { Authorization: auth } });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

export function buildTree(
    items: WorkItem[],
    workItemMetadata: WorkItemMetadata
): { roots: WorkItemNode[]; nodes: WorkItemNode[] } {
    const nodeMap = new Map<number, WorkItemNode>();
    const nodes: WorkItemNode[] = items.map((item) => {
        const node: WorkItemNode = { ...item, children: [] };
        nodeMap.set(node.id, node);
        return node;
    });

    const roots: WorkItemNode[] = [];
    nodes.forEach((node) => {
        const parentField = node.fields['System.Parent'];
        let parentId: number | null = typeof parentField === 'number' ? parentField : null;

        if (!parentId) {
            const parentRelation = node.relations?.find((r) => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
            if (parentRelation) {
                parentId = parseInt(parentRelation.url.split('/').pop() || '0');
            }
        }

        // Prevent infinite loops and ensure parent exists in our set
        if (parentId && parentId !== node.id && nodeMap.has(parentId)) {
            const parent = nodeMap.get(parentId)!;
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    });

    // Sort hierarchy recursively
    const sortFn = (a: WorkItemNode, b: WorkItemNode) => sortByPriority(a, b, workItemMetadata);
    roots.sort(sortFn);
    
    const visit = (node: WorkItemNode) => {
        if (node.children?.length > 0) {
            node.children.sort(sortFn);
            node.children.forEach(visit);
        }
    };
    roots.forEach(visit);

    return { roots, nodes };
}

export function getTypePriority(type: string | undefined, workItemMetadata: WorkItemMetadata): number {
    const t = (type || '').toLowerCase();
    if (workItemMetadata && workItemMetadata.backlogs) {
        for (let i = 0; i < workItemMetadata.backlogs.length; i++) {
            if (workItemMetadata.backlogs[i].workItemTypes.map(type => type.toLowerCase()).includes(t)) {
                return i + 1;
            }
        }
    }
    // Fallbacks
    if (t === 'initiative') return 0;
    if (t === 'epic') return 1;
    if (t === 'feature') return 2;
    if (['user story', 'product backlog item', 'requirement', 'issue'].includes(t)) return 3;
    if (['task', 'bug'].includes(t)) return 4;
    return 99;
}

function sortByPriority(a: WorkItemNode, b: WorkItemNode, workItemMetadata: WorkItemMetadata): number {
    const pA = getTypePriority(a.fields['System.WorkItemType'], workItemMetadata);
    const pB = getTypePriority(b.fields['System.WorkItemType'], workItemMetadata);
    if (pA !== pB) return pA - pB;
    return a.id - b.id;
}

export async function fetchProjects(config: AzureConfig): Promise<{ id: string; name: string }[]> {
    const url = `https://dev.azure.com/${config.org}/_apis/projects?api-version=6.0`;
    const response = await fetchWithRetry(url, {
        headers: { Authorization: getAuthHeader(config.pat) }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.value || []).map((p: any) => ({ id: p.id, name: p.name }));
}

export async function fetchTimelineData(config: AzureConfig, workItemMetadata: WorkItemMetadata): Promise<WorkItem[]> {
    // Determine all portfolio-level types, including "Initiative" as a common custom type
    let portfolioTypes = ['Initiative', 'Epic', 'Feature'];
    if (workItemMetadata && workItemMetadata.backlogs && workItemMetadata.backlogs.length > 0) {
        const types = workItemMetadata.backlogs
            .filter(b => b.type === 'portfolio')
            .flatMap(b => b.workItemTypes);
        if (types.length > 0) portfolioTypes = types;
    }

    const typesFilter = portfolioTypes.map(t => `'${t}'`).join(', ');

    const decodedProject = decodeURIComponent(config.project);
    const url = `https://dev.azure.com/${config.org}/${encodeURIComponent(decodedProject)}/_apis/wit/wiql?api-version=6.0`;
    const wiql = {
        query: `SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] IN (${typesFilter}) AND [System.State] <> 'Removed'`
    };

    console.log(`[API] Fetching Timeline Items from: ${url}`);
    console.log(`[API] Filtering by Project: "${config.project}"`);
    console.log(`[API] Query: ${wiql.query}`);

    const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
            Authorization: getAuthHeader(config.pat),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(wiql)
    });

    if (!response.ok) {
        console.error(`[API] WIQL failed with status ${response.status}`);
        return [];
    }
    const result = await response.json();
    const ids = (result.workItems || []).map((wi: any) => wi.id);

    console.log(`[API] Found ${ids.length} Items for project ${config.project}`);

    if (ids.length === 0) return [];

    // Fetch details for these IDs at the ORG level
    const auth = getAuthHeader(config.pat);
    const chunkSize = 200;
    let allItems: WorkItem[] = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const chunkKey = chunk.join(',');
        const detailsUrl = `https://dev.azure.com/${config.org}/_apis/wit/workitems?ids=${chunkKey}&$expand=all&api-version=6.0`;
        const detailsResp = await fetchWithRetry(detailsUrl, {
            headers: { Authorization: auth }
        });
        if (detailsResp.ok) {
            const data = await detailsResp.json();
            const value = data.value || [];
            const p1 = (decodedProject || '').trim().toLowerCase();
            const p2 = (config.project || '').trim().toLowerCase();

            const filtered = value.filter((wi: any) => {
                const project = (wi.fields['System.TeamProject'] || '').trim().toLowerCase();
                return (project === p1 || project === p2) && project !== '';
            });
            allItems = allItems.concat(filtered);
        }
    }

    console.log(`[API] Returning ${allItems.length} Items after client-side project filtering`);
    return allItems;
}

