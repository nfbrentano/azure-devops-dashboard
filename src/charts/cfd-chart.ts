import Chart from 'chart.js/auto';
import { getChartThemeOptions } from './chart-options.ts';
import type { ChartInstances } from '../types.ts';

export function renderCFDChart(
    cfdSeries: any[],
    charts: ChartInstances,
    currentTheme: 'dark' | 'light',
    currentLanguage: string,
    translations: Record<string, Record<string, string>>
) {
    let canvas = document.getElementById('cfdChart');
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    if (charts.cfd) charts.cfd.destroy();

    if (!cfdSeries || cfdSeries.length === 0) {
        container.innerHTML = `<div id="cfd-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>${translations[currentLanguage]['msg-cfd-empty']}</p>
        </div>`;
        return;
    }

    if (document.getElementById('cfd-empty-msg')) {
        container.innerHTML = '<canvas id="cfdChart"></canvas>';
        canvas = document.getElementById('cfdChart');
    }

    if (!canvas) return;

    const { gridColor, textColor } = getChartThemeOptions(currentTheme);

    const labels = cfdSeries.map((d) => d.date.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' }));

    charts.cfd = new Chart(canvas as HTMLCanvasElement, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: translations[currentLanguage]['status-done'],
                    data: cfdSeries.map((d) => d.Done),
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.3
                },
                {
                    label: translations[currentLanguage]['status-inprogress'],
                    data: cfdSeries.map((d) => d.InProgress),
                    backgroundColor: '#0078d4',
                    borderColor: '#0078d4',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.3
                },
                {
                    label: translations[currentLanguage]['status-backlog'],
                    data: cfdSeries.map((d) => d.Proposed),
                    backgroundColor: '#b2b2b2',
                    borderColor: '#b2b2b2',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index' as const, intersect: false },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: {
                    position: 'top' as const,
                    labels: { color: textColor, font: { size: 12 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: (context: any) => `${context.dataset.label}: ${context.raw}`
                    }
                }
            }
        }
    });
}
