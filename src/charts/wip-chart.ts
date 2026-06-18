import Chart from 'chart.js/auto';
import { getChartThemeOptions } from './chart-options.ts';
import type { ChartInstances } from '../types.ts';

export function renderWIPChart(
    boardColumnData: Record<string, number>,
    charts: ChartInstances,
    currentTheme: 'dark' | 'light',
    currentLanguage: string,
    translations: Record<string, Record<string, string>>
) {
    let canvas = document.getElementById('wipChart');
    const container = canvas?.parentElement;
    if (!container) return;

    if (charts.wip) charts.wip.destroy();

    const columns = Object.keys(boardColumnData);
    const counts = columns.map((col) => boardColumnData[col]);

    if (columns.length === 0) {
        container.innerHTML = `<div id="wip-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>${translations[currentLanguage]['msg-wip-empty']}</p>
        </div>`;
        return;
    }

    if (document.getElementById('wip-empty-msg')) {
        container.innerHTML = '<canvas id="wipChart"></canvas>';
        canvas = document.getElementById('wipChart');
    }

    if (!canvas) return;

    const { gridColor, textColor } = getChartThemeOptions(currentTheme);

    charts.wip = new Chart(canvas as HTMLCanvasElement, {
        type: 'bar',
        data: {
            labels: columns,
            datasets: [
                {
                    label: translations[currentLanguage]['label-items-count'],
                    data: counts,
                    backgroundColor: '#f59e0b',
                    borderRadius: 4
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
                        label: (context: any) => `${translations[currentLanguage]['label-items']}: ${context.raw}`
                    }
                }
            }
        }
    });
}
