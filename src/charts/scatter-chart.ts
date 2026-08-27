import Chart from 'chart.js/auto';
import { getChartThemeOptions } from './chart-options.ts';
import type { ChartInstances, ScatterMetrics, AzureConfig } from '../types.ts';
import { getWorkItemUrl } from '../utils.ts';

export function renderScatterChart(
    scatterData: ScatterMetrics | undefined,
    charts: ChartInstances,
    currentTheme: 'dark' | 'light',
    currentLanguage: string,
    translations: Record<string, Record<string, string>>,
    azureConfig?: AzureConfig | null
) {
    if (charts.scatter) charts.scatter.destroy();

    const canvas = document.getElementById('scatterChart') as HTMLCanvasElement | null;
    if (!canvas || !scatterData || scatterData.points.length === 0) return;

    const { gridColor, textColor } = getChartThemeOptions(currentTheme);
    const t = translations[currentLanguage] || translations['en'];

    // Sort points by date for proper rendering
    const sortedPoints = [...scatterData.points].sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());

    const scatterPoints = sortedPoints.map((p, idx) => ({
        x: idx,
        y: p.y,
        dateLabel: typeof p.x === 'string' ? p.x.split('T')[0] : String(p.x),
        id: p.id,
        title: p.title,
        type: p.type
    }));

    const xLabels = sortedPoints.map((p) => (typeof p.x === 'string' ? p.x.split('T')[0] : String(p.x)));

    // Create horizontal percentile line datasets across all X indices
    const minX = 0;
    const maxX = Math.max(0, scatterPoints.length - 1);

    const p50Line = [
        { x: minX, y: scatterData.p50 },
        { x: maxX, y: scatterData.p50 }
    ];
    const p85Line = [
        { x: minX, y: scatterData.p85 },
        { x: maxX, y: scatterData.p85 }
    ];
    const p95Line = [
        { x: minX, y: scatterData.p95 },
        { x: maxX, y: scatterData.p95 }
    ];

    charts.scatter = new Chart(canvas, {
        type: 'scatter',
        data: {
            labels: xLabels,
            datasets: [
                {
                    type: 'scatter',
                    label: t['scatter-item-label'] || 'Work Items (Cycle Time)',
                    data: scatterPoints,
                    backgroundColor: 'rgba(59, 130, 246, 0.75)',
                    borderColor: '#3b82f6',
                    pointRadius: 5,
                    pointHoverRadius: 8
                },
                {
                    type: 'line',
                    label: `50% (${scatterData.p50.toFixed(1)}d)`,
                    data: p50Line,
                    borderColor: '#10b981', // Green
                    borderWidth: 2,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    fill: false
                },
                {
                    type: 'line',
                    label: `85% (${scatterData.p85.toFixed(1)}d)`,
                    data: p85Line,
                    borderColor: '#f59e0b', // Amber
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                },
                {
                    type: 'line',
                    label: `95% (${scatterData.p95.toFixed(1)}d)`,
                    data: p95Line,
                    borderColor: '#ef4444', // Red
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (_event, elements) => {
                if (elements.length > 0 && azureConfig) {
                    const firstEl = elements[0];
                    if (firstEl.datasetIndex === 0) {
                        const pointData = scatterPoints[firstEl.index];
                        if (pointData?.id) {
                            const url = getWorkItemUrl(azureConfig, pointData.id);
                            window.open(url, '_blank');
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor },
                    title: {
                        display: true,
                        text: t['label-cycle-time-days'] || 'Cycle Time (dias)',
                        color: textColor
                    }
                },
                x: {
                    type: 'linear',
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        callback: (val: any) => {
                            const idx = Math.round(Number(val));
                            return xLabels[idx] || '';
                        }
                    },
                    title: {
                        display: true,
                        text: t['label-completion-date'] || 'Data de Conclusão',
                        color: textColor
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: textColor, usePointStyle: true, boxWidth: 8 }
                },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            if (context.datasetIndex === 0) {
                                const raw = context.raw as (typeof scatterPoints)[0];
                                return [
                                    `#${raw.id}: ${raw.title}`,
                                    `Tipo: ${raw.type}`,
                                    `Data: ${raw.dateLabel}`,
                                    `Cycle Time: ${raw.y.toFixed(1)} dias (Clique para abrir)`
                                ];
                            }
                            return `${context.dataset.label}`;
                        }
                    }
                }
            }
        }
    });
}
