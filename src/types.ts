/**
 * Type definitions for the Azure DevOps Analytics Dashboard
 */
import type { Chart } from 'chart.js';

// ─── Azure DevOps Config ────────────────────────────────────────────────────

export interface AzureConfig {
    org: string;
    project: string;
    pat: string;
    companyName?: string;
}

// ─── Work Items ─────────────────────────────────────────────────────────────

export interface AssignedTo {
    displayName: string;
    uniqueName: string;
}

export interface WorkItemFields {
    'System.Id': number;
    'System.Title': string;
    'System.State': string;
    'System.WorkItemType': string;
    'System.CreatedDate': string;
    'System.ChangedDate': string;
    'System.AssignedTo'?: AssignedTo | string;
    'System.Parent'?: number;
    'System.BoardColumn'?: string;
    'System.ClosedDate'?: string;
    'Microsoft.VSTS.Common.ActivatedDate'?: string;
    'Microsoft.VSTS.Common.ClosedDate'?: string;
    [key: string]: unknown;
}

export interface WorkItemRelation {
    rel: string;
    url: string;
    attributes?: Record<string, unknown>;
}

export interface WorkItem {
    id: number;
    fields: WorkItemFields;
    relations?: WorkItemRelation[];
}

export interface WorkItemNode extends WorkItem {
    children: WorkItemNode[];
    allChildren?: WorkItemNode[];
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export interface WorkItemTypeInfo {
    name: string;
    color: string;
    description?: string;
    iconData: string | null;
    states: Record<string, unknown>;
}

export interface StateInfo {
    name: string;
    color: string;
    category: 'Proposed' | 'InProgress' | 'Completed' | 'Removed';
}

export interface BacklogInfo {
    name: string;
    type: string;
    workItemTypes: string[];
}

export interface WorkItemMetadata {
    types: Record<string, WorkItemTypeInfo>;
    backlogs: BacklogInfo[];
    states: Record<string, StateInfo>;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

export interface CacheEntry<T = unknown> {
    data: T;
    expiresAt: number;
}

export interface CacheStats {
    hits: number;
    misses: number;
    inflight: number;
    throttled: number;
    size: number;
}

// ─── Application State ──────────────────────────────────────────────────────

export interface ChartInstances {
    comparison: Chart | null;
    aging: Chart | null;
    assignee: Chart | null;
    cfd: Chart | null;
    throughput: Chart | null;
    bottlenecks: Chart | null;
    wip?: Chart | null;
}

export interface AppState {
    azureConfig: AzureConfig | null;
    currentData: {
        items: WorkItemNode[];
        tree: WorkItemNode[];
        revisions: Record<number, WorkItem[]>;
    };
    charts: ChartInstances;
    heatmapData: Record<string, number> | null;
    ganttOffset: number;
    currentTheme: 'dark' | 'light';
    currentLanguage: string;
    globalActiveTypes: string[] | null;
    workItemMetadata: WorkItemMetadata;
    cacheStats: CacheStats | null;
    timelineData: {
        items: WorkItemNode[];
        tree: WorkItemNode[];
    };
    timelineActiveTypes: string[];
}

// ─── UI Helpers ─────────────────────────────────────────────────────────────

export interface StatusInfo {
    label: string;
    color: string;
    class: string;
}

export interface IconInfo {
    icon: string;
    iconClass: string;
    color: string;
    isPortfolio: boolean;
    iconData: string | null;
}

export interface AgingItem {
    id: number;
    title: string;
    age: number;
    state: string;
}

export interface BottleneckResult {
    column: string;
    avgDays: number;
}

export interface ThroughputDataPoint {
    label: string;
    range: string;
    count: number;
}

// ─── Query Types ────────────────────────────────────────────────────────────

export interface SavedQuery {
    id: string;
    name: string;
    isFolder?: boolean;
    children?: SavedQuery[];
}

// ─── DOM Element Maps ───────────────────────────────────────────────────────

export interface DashboardElements {
    setupForm: HTMLFormElement;
    unlockForm: HTMLFormElement;
    forgotPasswordBtn: HTMLButtonElement;
    logoutBtn: HTMLButtonElement;
    themeToggle: HTMLButtonElement;
    langToggle: HTMLButtonElement;
    querySelector: HTMLSelectElement;
    refreshBtn: HTMLButtonElement;
    ganttPeriod: HTMLSelectElement;
    ganttPrev: HTMLButtonElement;
    ganttNext: HTMLButtonElement;
    tabDashboard: HTMLButtonElement;
    tabItems: HTMLButtonElement;
    tabTimeline: HTMLButtonElement;
    tabSetup: HTMLButtonElement;
    dashboardView: HTMLElement;
    itemsView: HTMLElement;
    timelineView: HTMLElement;
    setupView: HTMLElement;
    unlockView: HTMLElement;
    dataControls: HTMLElement;
}

export type Translations = Record<string, Record<string, string>>;
