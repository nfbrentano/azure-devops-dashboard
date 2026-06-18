import Chart from 'chart.js/auto';
import { getWorkItemUrl } from '../utils.ts';
import { getChartThemeOptions } from './chart-options.ts';
import type { AzureConfig, ChartInstances } from '../types.ts';

export function renderAgingChart(
    agingData: any[],
    charts: ChartInstances,
    currentTheme: 'dark' | 'light',
    currentLanguage: string,
    translations: Record<string, Record<string, string>>,
    azureConfig: AzureConfig | null
) {
    let canvas = document.getElementById('agingChart');
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    if (charts.aging) charts.aging.destroy();

    if (!agingData || agingData.length === 0) {
        container.innerHTML = `<div id="aging-empty-msg" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 1rem;">
            <i class="ph-bold ph-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>${translations[currentLanguage]['msg-aging-empty']}</p>
        </div>`;
        return;
    }

    if (document.getElementById('aging-empty-msg')) {
        container.innerHTML = '<canvas id="agingChart"></canvas>';
        canvas = document.getElementById('agingChart');
    }

    if (!canvas) return;

    agingData.sort((a, b) => b.age - a.age);

    const labels = agingData.map((d: any) => `ID ${d.id} - ${d.title.substring(0, 30)}${d.title.length > 30 ? '...' : ''}`);
    const values = agingData.map((d: any) => d.age);

    const { gridColor, textColor } = getChartThemeOptions(currentTheme);

    charts.aging = new Chart(canvas as HTMLCanvasElement, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: translations[currentLanguage]['label-days-inactive'],
                    data: values,
                    backgroundColor: values.map((v: number) => (v > 15 ? '#ef4444' : v > 7 ? '#f59e0b' : '#3b82f6')),
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
                    title: {
                        display: true,
                        text: translations[currentLanguage]['label-days-since-update'],
                        color: textColor
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            const item = agingData[context.dataIndex];
                            return `${translations[currentLanguage]['label-days-inactive']}: ${item.age} | ${item.state}`;
                        }
                    }
                }
            },
            onClick: (e: any, elements: any[]) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const item = agingData[index];
                    window.open(getWorkItemUrl(azureConfig, item.id), '_blank');
                }
            }
        }
    });
}
