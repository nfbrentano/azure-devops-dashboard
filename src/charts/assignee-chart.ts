import Chart from 'chart.js/auto';
import { getChartThemeOptions } from './chart-options.ts';
import type { ChartInstances } from '../types.ts';

export function renderAssigneeChart(
    workloadData: Record<string, Record<string, number>>,
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

    // Calculate totals for sorting
    const totals: Record<string, number> = {};
    const allStatuses = new Set<string>();

    for (const [name, statuses] of Object.entries(workloadData)) {
        let total = 0;
        for (const [status, count] of Object.entries(statuses)) {
            total += count;
            allStatuses.add(status);
        }
        totals[name] = total;
    }

    const names = Object.keys(workloadData).sort((a, b) => totals[b] - totals[a]);

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

    const statusColors: Record<string, string> = {
        Backlog: '#94a3b8',
        'In Progress': '#3b82f6',
        Done: '#10b981',
        Removed: '#ef4444'
    };

    const datasets = Array.from(allStatuses).map((status) => {
        return {
            label: status,
            data: names.map((name) => workloadData[name][status] || 0),
            backgroundColor: statusColors[status] || '#8b5cf6',
            borderRadius: 4
        };
    });

    charts.assignee = new Chart(canvas as HTMLCanvasElement, {
        type: 'bar',
        data: {
            labels: names,
            datasets: datasets
        },
        options: {
            indexAxis: 'y' as const,
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
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
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top' as const,
                    labels: { color: textColor, font: { size: 10 } }
                },
                tooltip: {
                    mode: 'index',
                    callbacks: {
                        label: (context: any) => `${context.dataset.label}: ${context.raw}`
                    }
                }
            }
        }
    });
}
