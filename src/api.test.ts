import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getAuthHeader,
    fetchWithRetry,
    fetchQueries,
    fetchFullDetails,
    fetchWorkItemRevisions,
    fetchRevisionsForItems,
    fetchMetadata,
    getBase64Image,
    fetchProjects,
    fetchTimelineData,
    buildTree,
    getTypePriority
} from './api.ts';
import { apiCache } from './cache.ts';
import { showToast } from './utils.ts';
import type { WorkItem, WorkItemMetadata, AzureConfig } from './types.ts';

// Mock dependencies that might be imported
vi.mock('./utils.ts', () => ({
    showToast: vi.fn()
}));
vi.mock('./translations.ts', () => ({
    translations: {
        en: {
            'msg-error-loading': 'Error loading data',
            'msg-partial-data-single': 'Partial data loaded (1 chunk failed)',
            'msg-partial-data-multiple': 'Partial data loaded ({count} chunks failed)',
            'msg-metadata-failed': 'Failed to load metadata'
        }
    }
}));
vi.mock('./state.ts', () => ({
    state: { currentLanguage: 'en' }
}));

describe('api.ts', () => {
    const mockMetadata = {
        types: {},
        states: {},
        backlogs: [
            { name: 'Epics', type: 'portfolio', workItemTypes: ['epic'] },
            { name: 'Features', type: 'portfolio', workItemTypes: ['feature'] }
        ]
    } as WorkItemMetadata;

    const mockConfig: AzureConfig = {
        org: 'my-org',
        project: 'my-project',
        pat: 'secret-token'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        apiCache.invalidateAll();
    });

    describe('getAuthHeader', () => {
        it('should format basic auth header with base64 PAT', () => {
            const header = getAuthHeader('my-pat');
            expect(header).toBe(`Basic ${btoa(':my-pat')}`);
        });
    });

    describe('fetchWithRetry', () => {
        const originalFetch = globalThis.fetch;

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it('should return response on successful 200 call', async () => {
            const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
            globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

            const res = await fetchWithRetry('https://example.com/api', {}, 3, 10);
            expect(res.status).toBe(200);
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        it('should return 429 immediately without calling fetch if URL is throttled', async () => {
            apiCache.markThrottled('https://example.com/api', 60000);
            globalThis.fetch = vi.fn();

            const res = await fetchWithRetry('https://example.com/api', {}, 3, 10);
            expect(res.status).toBe(429);
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it('should retry on 429 with Retry-After header and mark origin throttled', async () => {
            const resp429 = new Response('', { status: 429, headers: { 'Retry-After': '0' } });
            const resp200 = new Response('{"success":true}', { status: 200 });
            globalThis.fetch = vi.fn().mockResolvedValueOnce(resp429).mockResolvedValueOnce(resp200);

            // Using 1ms delay
            const res = await fetchWithRetry('https://example.com/retry429', {}, 2, 1);
            expect(res.status).toBe(200);
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        it('should return 429 when maxRetries is exhausted on 429', async () => {
            const resp429 = new Response('', { status: 429 });
            globalThis.fetch = vi.fn().mockResolvedValue(resp429);

            const res = await fetchWithRetry('https://example.com/fail429', {}, 2, 1);
            expect(res.status).toBe(429);
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        it('should retry on 500 error and succeed', async () => {
            const resp500 = new Response('', { status: 500 });
            const resp200 = new Response('ok', { status: 200 });
            globalThis.fetch = vi.fn().mockResolvedValueOnce(resp500).mockResolvedValueOnce(resp200);

            const res = await fetchWithRetry('https://example.com/error500', {}, 2, 1);
            expect(res.status).toBe(200);
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        it('should retry on thrown network error and succeed on second attempt', async () => {
            const resp200 = new Response('ok', { status: 200 });
            globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(resp200);

            const res = await fetchWithRetry('https://example.com/net-error', {}, 2, 1);
            expect(res.status).toBe(200);
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        it('should rethrow network error when retries are exhausted', async () => {
            globalThis.fetch = vi.fn().mockRejectedValue(new Error('Persistent error'));

            await expect(fetchWithRetry('https://example.com/fatal', {}, 2, 1)).rejects.toThrow('Persistent error');
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('fetchQueries', () => {
        const originalFetch = globalThis.fetch;

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it('should flatten nested queries and return list of saved queries', async () => {
            const mockQueries = {
                value: [
                    { id: '1', name: 'Query 1', isFolder: false },
                    {
                        id: '2',
                        name: 'Folder 1',
                        isFolder: true,
                        children: [
                            { id: '3', name: 'Query 2', isFolder: false },
                            {
                                id: '4',
                                name: 'Subfolder',
                                isFolder: true,
                                children: [{ id: '5', name: 'Query 3', isFolder: false }]
                            }
                        ]
                    }
                ]
            };

            globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(mockQueries), { status: 200 }));

            const result = await fetchQueries(mockConfig);
            expect(result).toHaveLength(3);
            expect(result?.map((q) => q.id)).toEqual(['1', '3', '5']);
        });

        it('should return null if response is not ok', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));

            const result = await fetchQueries(mockConfig);
            expect(result).toBeNull();
        });

        it('should show toast error and return null if request throws in json parsing', async () => {
            const mockResp = new Response('invalid json', { status: 200 });
            mockResp.json = vi.fn().mockRejectedValue(new Error('Parse error'));
            globalThis.fetch = vi.fn().mockResolvedValue(mockResp);

            const result = await fetchQueries(mockConfig);
            expect(result).toBeNull();
            expect(showToast).toHaveBeenCalledWith('Error loading data', 'error');
        });
    });

    describe('fetchFullDetails', () => {
        const originalFetch = globalThis.fetch;

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it('should fetch work items in chunks of 200 and call progress callback', async () => {
            const ids = Array.from({ length: 250 }, (_, i) => i + 1);
            const chunk1Items = ids.slice(0, 200).map((id) => ({ id, fields: { 'System.Id': id } }));
            const chunk2Items = ids.slice(200).map((id) => ({ id, fields: { 'System.Id': id } }));

            globalThis.fetch = vi
                .fn()
                .mockResolvedValueOnce(new Response(JSON.stringify({ value: chunk1Items }), { status: 200 }))
                .mockResolvedValueOnce(new Response(JSON.stringify({ value: chunk2Items }), { status: 200 }));

            const onProgress = vi.fn();
            const items = await fetchFullDetails(mockConfig, ids, onProgress);

            expect(items).toHaveLength(250);
            expect(onProgress).toHaveBeenCalledWith(0);
            expect(onProgress).toHaveBeenCalledWith(80); // (200 / 250) * 100
            expect(onProgress).toHaveBeenCalledWith(100);
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        it('should handle single failed chunk and show warning toast', async () => {
            const ids = [1, 2, 3];
            globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 400 }));

            const items = await fetchFullDetails(mockConfig, ids);
            expect(items).toEqual([]);
            expect(showToast).toHaveBeenCalledWith('Partial data loaded (1 chunk failed)', 'warning');
        });

        it('should handle multiple failed chunks and show warning toast with count', async () => {
            const ids = Array.from({ length: 250 }, (_, i) => i + 1);
            globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 400 }));

            const items = await fetchFullDetails(mockConfig, ids);
            expect(items).toEqual([]);
            expect(showToast).toHaveBeenCalledWith('Partial data loaded (2 chunks failed)', 'warning');
        });
    });

    describe('fetchWorkItemRevisions and fetchRevisionsForItems', () => {
        const originalFetch = globalThis.fetch;

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it('should fetch revisions for a single item', async () => {
            const revisions = [
                { id: 10, rev: 1 },
                { id: 10, rev: 2 }
            ];
            globalThis.fetch = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ value: revisions }), { status: 200 }));

            const res = await fetchWorkItemRevisions(mockConfig, 10);
            expect(res).toEqual(revisions);
        });

        it('should return null when revisions endpoint fails', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));

            const res = await fetchWorkItemRevisions(mockConfig, 999);
            expect(res).toBeNull();
        });

        it('should fetch revisions for multiple items with concurrency and progress', async () => {
            const ids = [1, 2, 3];
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                const match = url.match(/workItems\/(\d+)/i);
                const id = match ? Number(match[1]) : 1;
                return Promise.resolve(new Response(JSON.stringify({ value: [{ id }] }), { status: 200 }));
            });

            const onProgress = vi.fn();
            const results = await fetchRevisionsForItems(mockConfig, ids, onProgress);

            expect(Object.keys(results)).toHaveLength(3);
            expect(results[1]).toEqual([{ id: 1 }]);
            expect(results[2]).toEqual([{ id: 2 }]);
            expect(results[3]).toEqual([{ id: 3 }]);
            expect(onProgress).toHaveBeenCalled();
        });
    });

    describe('fetchMetadata', () => {
        const originalFetch = globalThis.fetch;

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it('should load metadata from cache if available', async () => {
            const cachedData = {
                types: {
                    task: { name: 'Task', color: '#0078d4', description: '', iconData: null, states: {} }
                },
                states: {
                    active: { name: 'Active', color: '#0078d4', category: 'InProgress' }
                },
                backlogs: [{ name: 'Backlog', type: 'requirement', workItemTypes: ['task'] }]
            };
            const metaCacheKey = `metadata:${mockConfig.org}:${mockConfig.project}`;
            apiCache.set(metaCacheKey, cachedData, 60000);

            const targetMeta = { types: {}, states: {}, backlogs: [] } as WorkItemMetadata;
            const renderLegends = vi.fn();

            await fetchMetadata(mockConfig, targetMeta, renderLegends);

            expect(targetMeta.types['task']).toBeDefined();
            expect(targetMeta.states['active']).toBeDefined();
            expect(renderLegends).toHaveBeenCalled();
        });

        it('should fetch types, states and backlogs and cache result', async () => {
            const typesResponse = {
                value: [
                    {
                        name: 'Bug',
                        color: 'cc293d',
                        description: 'Bug item',
                        icon: { url: 'https://example.com/bug.png' }
                    },
                    { name: 'Task', color: '#333333' }
                ]
            };
            const bugStatesResponse = {
                value: [{ name: 'Active', color: '0078d4', category: 'InProgress' }]
            };
            const taskStatesResponse = {
                value: [{ name: 'Done', color: '#107c41', category: 'Completed' }]
            };
            const teamsResponse = {
                value: [{ id: 'team-1', name: 'My Team' }]
            };
            const backlogsResponse = {
                value: [{ name: 'Stories', type: 'requirement', workItemTypes: [{ name: 'Story' }] }]
            };

            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('/_apis/wit/workitemtypes?')) {
                    return Promise.resolve(new Response(JSON.stringify(typesResponse), { status: 200 }));
                }
                if (url.includes('/bug.png')) {
                    return Promise.resolve(new Response(new Blob(['bug-icon']), { status: 200 }));
                }
                if (url.includes('/workitemtypes/Bug/states')) {
                    return Promise.resolve(new Response(JSON.stringify(bugStatesResponse), { status: 200 }));
                }
                if (url.includes('/workitemtypes/Task/states')) {
                    return Promise.resolve(new Response(JSON.stringify(taskStatesResponse), { status: 200 }));
                }
                if (url.includes('/_apis/teams?')) {
                    return Promise.resolve(new Response(JSON.stringify(teamsResponse), { status: 200 }));
                }
                if (url.includes('/_apis/work/backlogs?')) {
                    return Promise.resolve(new Response(JSON.stringify(backlogsResponse), { status: 200 }));
                }
                return Promise.resolve(new Response('', { status: 404 }));
            });

            const targetMeta = { types: {}, states: {}, backlogs: [] } as WorkItemMetadata;
            const renderLegends = vi.fn();

            await fetchMetadata(mockConfig, targetMeta, renderLegends);

            expect(targetMeta.types['bug']).toBeDefined();
            expect(targetMeta.types['bug'].color).toBe('#cc293d');
            expect(targetMeta.types['bug'].iconData).toContain('data:application/octet-stream;base64,');
            expect(targetMeta.types['task'].color).toBe('#333333');
            expect(targetMeta.states['active']).toBeDefined();
            expect(targetMeta.states['active'].color).toBe('#0078d4');
            expect(targetMeta.states['done'].color).toBe('#107c41');
            expect(targetMeta.backlogs).toHaveLength(1);
            expect(renderLegends).toHaveBeenCalled();
        });

        it('should show error toast if fetching metadata fails completely', async () => {
            const mockResp = new Response('err', { status: 200 });
            mockResp.json = vi.fn().mockRejectedValue(new Error('Network failure'));
            globalThis.fetch = vi.fn().mockResolvedValue(mockResp);
            const targetMeta = { types: {}, states: {}, backlogs: [] } as WorkItemMetadata;

            await fetchMetadata(mockConfig, targetMeta, null);
            expect(showToast).toHaveBeenCalledWith('Failed to load metadata', 'error');
        });
    });

    describe('getBase64Image', () => {
        const originalFetch = globalThis.fetch;

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it('should convert blob response to base64 data URL', async () => {
            const blob = new Blob(['image-content'], { type: 'image/png' });
            globalThis.fetch = vi.fn().mockResolvedValue(new Response(blob, { status: 200 }));

            const dataUrl = await getBase64Image('https://example.com/icon.png', 'auth');
            expect(typeof dataUrl).toBe('string');
            expect(dataUrl).toContain('data:image/png;base64,');
        });

        it('should return null if response is not ok', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
            const res = await getBase64Image('https://example.com/notfound.png', 'auth');
            expect(res).toBeNull();
        });

        it('should return null if blob conversion fails', async () => {
            const mockResp = new Response('', { status: 200 });
            mockResp.blob = vi.fn().mockRejectedValue(new Error('blob fail'));
            globalThis.fetch = vi.fn().mockResolvedValue(mockResp);
            const res = await getBase64Image('https://example.com/err.png', 'auth');
            expect(res).toBeNull();
        });
    });

    describe('fetchProjects', () => {
        const originalFetch = globalThis.fetch;

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it('should return mapped list of projects on success', async () => {
            const projects = {
                value: [
                    { id: 'p1', name: 'Project One' },
                    { id: 'p2', name: 'Project Two' }
                ]
            };
            globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(projects), { status: 200 }));

            const result = await fetchProjects(mockConfig);
            expect(result).toEqual([
                { id: 'p1', name: 'Project One' },
                { id: 'p2', name: 'Project Two' }
            ]);
        });

        it('should return empty list if response is not ok', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
            const result = await fetchProjects(mockConfig);
            expect(result).toEqual([]);
        });
    });

    describe('fetchTimelineData', () => {
        const originalFetch = globalThis.fetch;

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it('should return empty array if WIQL query fails', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 400 }));
            const items = await fetchTimelineData(mockConfig, mockMetadata);
            expect(items).toEqual([]);
        });

        it('should return empty array if WIQL returns 0 items', async () => {
            globalThis.fetch = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ workItems: [] }), { status: 200 }));
            const items = await fetchTimelineData(mockConfig, mockMetadata);
            expect(items).toEqual([]);
        });

        it('should fetch work item details and filter by project name', async () => {
            const wiqlResp = {
                workItems: [{ id: 101 }, { id: 102 }]
            };
            const detailsResp = {
                value: [
                    { id: 101, fields: { 'System.Id': 101, 'System.TeamProject': 'my-project' } },
                    { id: 102, fields: { 'System.Id': 102, 'System.TeamProject': 'other-project' } }
                ]
            };

            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('/_apis/wit/wiql?')) {
                    return Promise.resolve(new Response(JSON.stringify(wiqlResp), { status: 200 }));
                }
                return Promise.resolve(new Response(JSON.stringify(detailsResp), { status: 200 }));
            });

            const items = await fetchTimelineData(mockConfig, mockMetadata);
            expect(items).toHaveLength(1);
            expect(items[0].id).toBe(101);
        });
    });

    describe('getTypePriority', () => {
        it('should return 1 for Epic based on backlogs', () => {
            expect(getTypePriority('Epic', mockMetadata)).toBe(1);
        });

        it('should return 2 for Feature based on backlogs', () => {
            expect(getTypePriority('Feature', mockMetadata)).toBe(2);
        });

        it('should return 99 for unknown type', () => {
            expect(getTypePriority('SomethingElse', mockMetadata)).toBe(99);
        });

        it('should use fallbacks if metadata is missing', () => {
            const emptyMeta = { types: {}, states: {}, backlogs: [] } as WorkItemMetadata;
            expect(getTypePriority('Epic', emptyMeta)).toBe(1);
            expect(getTypePriority('Task', emptyMeta)).toBe(4);
            expect(getTypePriority('Initiative', emptyMeta)).toBe(0);
            expect(getTypePriority('User Story', emptyMeta)).toBe(3);
        });
    });

    describe('buildTree', () => {
        it('should link children to parents correctly', () => {
            const items = [
                { id: 1, fields: { 'System.WorkItemType': 'Epic' } },
                { id: 2, fields: { 'System.WorkItemType': 'Feature', 'System.Parent': 1 } },
                { id: 3, fields: { 'System.WorkItemType': 'User Story', 'System.Parent': 1 } }
            ] as unknown as WorkItem[];

            const { roots } = buildTree(items, mockMetadata);

            expect(roots.length).toBe(1);
            expect(roots[0].id).toBe(1);
            expect(roots[0].children.length).toBe(2);
            expect(roots[0].children.map((c) => c.id)).toContain(2);
            expect(roots[0].children.map((c) => c.id)).toContain(3);
        });

        it('should handle relations for parent linking', () => {
            const items = [
                { id: 1, fields: { 'System.WorkItemType': 'Epic' } },
                {
                    id: 2,
                    fields: { 'System.WorkItemType': 'Feature' },
                    relations: [{ rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://.../workitems/1' }]
                }
            ] as unknown as WorkItem[];

            const { roots } = buildTree(items, mockMetadata);

            expect(roots.length).toBe(1);
            expect(roots[0].children.length).toBe(1);
            expect(roots[0].children[0].id).toBe(2);
        });

        it('should sort roots and children by priority', () => {
            const items = [
                { id: 3, fields: { 'System.WorkItemType': 'User Story' } },
                { id: 1, fields: { 'System.WorkItemType': 'Epic' } },
                { id: 2, fields: { 'System.WorkItemType': 'Feature' } }
            ] as unknown as WorkItem[];

            const { roots } = buildTree(items, mockMetadata);

            expect(roots[0].fields['System.WorkItemType']).toBe('Epic');
            expect(roots[1].fields['System.WorkItemType']).toBe('Feature');
            expect(roots[2].fields['System.WorkItemType']).toBe('User Story');
        });

        it('should handle cases where parent is not in the list', () => {
            const items = [
                { id: 2, fields: { 'System.WorkItemType': 'Feature', 'System.Parent': 999 } }
            ] as unknown as WorkItem[];

            const { roots } = buildTree(items, mockMetadata);

            expect(roots.length).toBe(1);
            expect(roots[0].id).toBe(2);
        });

        it('should build a 3-level hierarchy correctly', () => {
            const items = [
                { id: 1, fields: { 'System.WorkItemType': 'Epic' } },
                { id: 2, fields: { 'System.WorkItemType': 'Feature', 'System.Parent': 1 } },
                { id: 3, fields: { 'System.WorkItemType': 'User Story', 'System.Parent': 2 } }
            ] as unknown as WorkItem[];

            const { roots, nodes } = buildTree(items, mockMetadata);

            expect(roots.length).toBe(1);
            expect(roots[0].id).toBe(1);
            expect(roots[0].children[0].id).toBe(2);
            expect(roots[0].children[0].children[0].id).toBe(3);
            expect(nodes.length).toBe(3);
        });
    });
});
