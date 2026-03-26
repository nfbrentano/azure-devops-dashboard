/**
 * Centralized state store for the Azure DevOps Dashboard
 */

export const state = {
    azureConfig: JSON.parse(localStorage.getItem('azure_config')) || null,
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
    currentTheme: localStorage.getItem('theme') || 'dark',
    currentLanguage: localStorage.getItem('language') || 'pt-br',
    globalActiveTypes: null,
    workItemMetadata: {
        types: {},
        backlogs: [],
        states: {}
    }
};
