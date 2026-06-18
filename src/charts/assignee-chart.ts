import Chart from 'chart.js/auto';
import { getChartThemeOptions } from './chart-options.ts';
import type { ChartInstances } from '../types.ts';

export function renderAssigneeChart(
    workloadData: Record<string, number>,
    charts: ChartInstances,
    currentTheme: 'dark' | 'light',
    currentLanguage: string,
    translations: Record<string, Record<string, string>>
) {
    let canvas = document.getElementById('assigneeChart');
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    if (charts.assignee) charts.assignee.destroy();

    const names = Object.keys(workloadData).sort((a, b) => workloadData[b] - workloadData[a]);
    const counts = names.map((name) => workloadData[name]);

    if (names.length === 0) {
        container.innerHTML = `<div id="assignee-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>${translations[currentLanguage]['msg-assignee-empty']}</p>
        </div>`;
        return;
    }

    if (document.getElementById('assignee-empty-msg')) {
        container.innerHTML = '<canvas id="assigneeChart"></canvas>';
        canvas = document.getElementById('assigneeChart');
    }

    if (!canvas) return;

    const { gridColor, textColor } = getChartThemeOptions(currentTheme);

    charts.assignee = new Chart(canvas as HTMLCanvasElement, {
        type: 'bar',
        data: {
            labels: names,
            datasets: [
                {
                    label: translations[currentLanguage]['label-items-count'],
                    data: counts,
                    backgroundColor: '#8b5cf6',
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
                    ticks: { color: textColor, stepSize: 1 },
                    title: {
                        display: true,
                        text: translations[currentLanguage]['label-number-of-items'],
                        color: textColor
                    }
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
                        label: (context: any) => `${translations[currentLanguage]['label-items']}: ${context.raw}`
                    }
                }
            }
        }
    });
}
