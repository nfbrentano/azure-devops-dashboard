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
        monteCarlo: null,
        bottlenecks: null
    },
    heatmapData: null,
    ganttOffset: 0,
    timelineOffset: 0,
    cfdPeriod: Number(localStorage.getItem('cfd_period')) || 180,
    currentTheme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
    currentLanguage: localStorage.getItem('language') || 'pt-br',
    globalActiveTypes: JSON.parse(localStorage.getItem('global_active_types') || 'null'),
    workItemMetadata: {
        types: {},
        backlogs: [],
        states: {}
    },
    /** Latest snapshot from apiCache.getStats() – updated after each data load */
    cacheStats: null,
    timelineData: { items: [], tree: [] },
    timelineActiveTypes: [],
    timelineActiveStates: []
};
