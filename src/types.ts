/**
 * Type definitions for the Azure DevOps Analytics Dashboard
 */
import type { Chart } from 'chart.js';
import type { DORAMetrics } from './dora.ts';
import type { ForecastResult } from './forecast.ts';

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
    'System.CreatedDate'?: string;
    'System.ChangedDate'?: string;
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
    monteCarlo: Chart | null;
    bottlenecks: Chart | null;
    wip?: Chart | null;
    scatter?: Chart | null;
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
    timelineOffset: number;
    cfdPeriod: number;
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
    timelineActiveStates: string[];
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
    assignee?: string;
    updated?: string;
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

export interface CFDDataPoint {
    date: Date;
    Proposed: number;
    InProgress: number;
    Done: number;
}

export interface AnomalyAlert {
    type: 'warning' | 'info' | 'error';
    title: string;
    message: string;
    count?: number;
}

// ─── Scatter & SLA & Alerts ──────────────────────────────────────────────────

export interface ScatterDataPoint {
    x: string | number; // Closed date or timestamp
    y: number; // Cycle time in days
    id: number;
    title: string;
    type: string;
    state: string;
}

export interface ScatterMetrics {
    points: ScatterDataPoint[];
    p50: number;
    p85: number;
    p95: number;
}

export interface AlertRule {
    id: string;
    metric: 'lead_time_avg' | 'cycle_time_avg' | 'wip_total' | 'aging_max' | 'cfr_pct';
    operator: '>' | '<' | '>=';
    threshold: number;
    name: string;
    enabled: boolean;
}

export interface SLAConfigItem {
    targetDays: number;
    metric: 'cycle' | 'lead';
}

export type SLAConfig = Record<string, SLAConfigItem>;

export interface SLAResult {
    workItemType: string;
    total: number;
    met: number;
    breached: number;
    compliancePct: number;
    avgDays: number;
    targetDays: number;
}

export interface QueryPreferences {
    ganttPeriod?: string;
    activeTypes?: string[];
    cfdPeriod?: number;
}

export interface ComputedMetrics {
    filteredItems: WorkItemNode[];
    leadTimes: string[];
    cycleTimes: (string | number)[];
    labels: string[];
    agingData: AgingItem[];
    assigneeWorkload: Record<string, Record<string, number>>;
    boardColumnWIP: Record<string, number>;
    kpis: {
        total: number;
        backlog: number;
        inprogress: number;
        doneRemoved: number;
    };
    cfdSeries: CFDDataPoint[];
    heatmapData: Record<string, number>;
    throughputData: ThroughputDataPoint[];
    bottleneckData: BottleneckResult[] | null;
    anomalies: AnomalyAlert[];
    doraMetrics?: DORAMetrics;
    forecastData?: ForecastResult | null;
    scatterData?: ScatterMetrics;
    slaData?: SLAResult[];
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
    setupForm: HTMLFormElement | null;
    unlockForm: HTMLFormElement | null;
    forgotPasswordBtn: HTMLButtonElement | null;
    logoutBtn: HTMLButtonElement | null;
    themeToggle: HTMLButtonElement | null;
    langToggle: HTMLButtonElement | null;
    querySelector: HTMLSelectElement | null;
    refreshBtn: HTMLButtonElement | null;
    ganttPeriod: HTMLSelectElement | null;
    ganttPrev: HTMLButtonElement | null;
    ganttNext: HTMLButtonElement | null;
    tabDashboard: HTMLButtonElement | null;
    tabItems: HTMLButtonElement | null;
    tabTimeline: HTMLButtonElement | null;
    tabSetup: HTMLButtonElement | null;
    dashboardView: HTMLElement | null;
    itemsView: HTMLElement | null;
    timelineView: HTMLElement | null;
    setupView: HTMLElement | null;
    unlockView: HTMLElement | null;
    dataControls: HTMLElement | null;
    progressList: HTMLElement | null;
    ganttContainer: HTMLElement | null;
    timelineGanttContainer: HTMLElement | null;
    timelineGanttPeriod: HTMLSelectElement | null;
    timelineGanttPrev: HTMLButtonElement | null;
    timelineGanttNext: HTMLButtonElement | null;
    cfdPeriodSelect: HTMLSelectElement | null;
    itemsSearchInput: HTMLInputElement | null;
    shortcutsModal?: HTMLElement | null;
    shortcutsHelpBtn?: HTMLButtonElement | null;
    tvModeBtn?: HTMLButtonElement | null;
    shareUrlBtn?: HTMLButtonElement | null;
    alertsModal?: HTMLElement | null;
    alertsConfigBtn?: HTMLButtonElement | null;
}

export type Translations = Record<string, Record<string, string>>;
