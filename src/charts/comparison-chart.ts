import Chart from 'chart.js/auto';
import { getWorkItemUrl } from '../utils.ts';
import { getChartThemeOptions } from './chart-options.ts';
import type { AzureConfig, ChartInstances } from '../types.ts';

export function renderCharts(
    labels: string[],
    leadTimes: any[],
    cycleTimes: any[],
    charts: ChartInstances,
    currentTheme: 'dark' | 'light',
    currentLanguage: string,
    translations: Record<string, Record<string, string>>,
    azureConfig: AzureConfig | null
) {
    if (charts.comparison) charts.comparison.destroy();

    const canvas = document.getElementById('comparisonChart');
    if (!canvas) return;

    const { gridColor, textColor } = getChartThemeOptions(currentTheme);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: gridColor },
                ticks: { color: textColor },
                title: { display: true, text: translations[currentLanguage]['label-days'], color: textColor }
            },
            x: {
                grid: { display: false },
                ticks: { color: textColor, maxRotation: 45, minRotation: 45 }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top' as const,
                labels: { color: textColor, font: { weight: 'bold' as const } }
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false
            }
        },
        onClick: (e: any, elements: any[]) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const label = labels[index];
                const id = label.replace('ID ', '');
                window.open(getWorkItemUrl(azureConfig, id), '_blank');
            }
        }
    };

    charts.comparison = new Chart(canvas as HTMLCanvasElement, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: translations[currentLanguage]['metric-lead-time-title'],
                    data: leadTimes,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: translations[currentLanguage]['metric-cycle-time-title'],
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
