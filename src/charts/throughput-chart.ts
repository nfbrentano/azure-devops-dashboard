import Chart from 'chart.js/auto';
import { getChartThemeOptions } from './chart-options.ts';
import type { ChartInstances } from '../types.ts';

export function renderThroughputChart(
    throughputData: any[],
    charts: ChartInstances,
    currentTheme: 'dark' | 'light',
    currentLanguage: string,
    translations: Record<string, Record<string, string>>
) {
    if (charts.throughput) charts.throughput.destroy();

    const canvas = document.getElementById('throughputChart');
    if (!canvas) return;

    const { gridColor, textColor } = getChartThemeOptions(currentTheme);

    charts.throughput = new Chart(canvas as HTMLCanvasElement, {
        type: 'bar',
        data: {
            labels: throughputData.map((d) => d.label),
            datasets: [
                {
                    label: translations[currentLanguage]['label-delivered-items'],
                    data: throughputData.map((d) => d.count),
                    backgroundColor: '#3b82f6',
                    borderRadius: 6,
                    hoverBackgroundColor: '#2563eb'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor, stepSize: 1 },
                    title: { display: true, text: translations[currentLanguage]['label-quantity'], color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items: any[]) => throughputData[items[0].dataIndex].range,
                        label: (item: any) =>
                            `${translations[currentLanguage]['label-delivered']}: ${item.raw} ${translations[currentLanguage]['label-items']}`
                    }
                }
            }
        }
    });
}
