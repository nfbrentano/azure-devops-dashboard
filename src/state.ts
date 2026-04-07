/**
 * Centralized state store for the Azure DevOps Dashboard
 */
import type { AppState } from './types.ts';

export const state: AppState = {
    azureConfig: JSON.parse(localStorage.getItem('azure_config') || 'null'),
    currentData: { items: [], tree: [], revisions: {} },
    charts: {
        comparison: null,
        aging: null,
        assignee: null,
        cfd: null,
        throughput: null,
        bottlenecks: null
    },
    heatmapData: null,
    ganttOffset: 0,
    currentTheme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
    currentLanguage: localStorage.getItem('language') || 'pt-br',
    globalActiveTypes: null,
    workItemMetadata: {
        types: {},
        backlogs: [],
        states: {}
    },
    /** Latest snapshot from apiCache.getStats() – updated after each data load */
    cacheStats: null,
    timelineData: { items: [], tree: [] },
    timelineActiveTypes: []
};
