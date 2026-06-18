import Chart from 'chart.js/auto';
import { getChartThemeOptions } from './chart-options.ts';
import type { ChartInstances } from '../types.ts';

export function renderBottlenecksChart(
    bottleneckData: any[],
    charts: ChartInstances,
    currentTheme: 'dark' | 'light',
    currentLanguage: string,
    translations: Record<string, Record<string, string>>
) {
    console.log('Rendering Bottlenecks Chart with data:', bottleneckData);
    let canvas = document.getElementById('bottlenecksChart');
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    if (charts.bottlenecks) charts.bottlenecks.destroy();

    if (!bottleneckData || bottleneckData.length === 0) {
        container.innerHTML = `<div id="bottlenecks-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>${translations[currentLanguage]['msg-bottlenecks-empty']}</p>
        </div>`;
        return;
    }

    if (document.getElementById('bottlenecks-empty-msg')) {
        container.innerHTML = '<canvas id="bottlenecksChart"></canvas>';
        canvas = document.getElementById('bottlenecksChart');
    }

    if (!canvas) return;

    const labels = bottleneckData.map((d) => d.column);
    const values = bottleneckData.map((d) => parseFloat(d.avgDays.toFixed(1)));

    const { gridColor, textColor } = getChartThemeOptions(currentTheme);

    charts.bottlenecks = new Chart(canvas as HTMLCanvasElement, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: translations[currentLanguage]['label-avg-days'],
                    data: values,
                    backgroundColor: values.map((v: number) => (v > 5 ? '#ef4444' : v > 2 ? '#f59e0b' : '#3b82f6')),
                    borderRadius: 4
                }
            ]
        },
        options: {
            indexAxis: 'y' as const,
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor },
                    title: { display: true, text: translations[currentLanguage]['label-days'], color: textColor }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: any) => `${translations[currentLanguage]['label-avg-days']}: ${context.raw}`
                    }
                }
            }
        }
    });
}
