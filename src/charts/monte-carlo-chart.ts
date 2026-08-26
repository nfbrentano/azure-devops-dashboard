import { Chart } from 'chart.js';
import type { ChartInstances } from '../types.ts';
import type { ForecastResult } from '../forecast.ts';

export function renderMonteCarloChart(
    forecastData: ForecastResult | null,
    charts: ChartInstances,
    currentTheme: 'dark' | 'light',
    currentLanguage: string,
    translations: any
) {
    const canvas = document.getElementById('monteCarloChart') as HTMLCanvasElement;
    if (!canvas) return;
    
    // Destroy existing
    if (charts.monteCarlo) {
        charts.monteCarlo.destroy();
        charts.monteCarlo = null;
    }

    if (!forecastData) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = currentTheme === 'dark' ? '#94a3b8' : '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(translations[currentLanguage]['empty-state-desc'] || 'No data available', canvas.width / 2, canvas.height / 2);
        }
        return;
    }

    const t = translations[currentLanguage] || translations['en'];
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const weeks = Object.keys(forecastData.histogram).map(Number).sort((a, b) => a - b);
    const counts = weeks.map(w => forecastData.histogram[w]);

    const textColor = currentTheme === 'dark' ? '#94a3b8' : '#64748b';
    const gridColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    charts.monteCarlo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeks.map(w => `${w} ${t['label-weeks'] || 'weeks'}`),
            datasets: [{
                label: 'Simulations',
                data: counts,
                backgroundColor: currentTheme === 'dark' ? 'rgba(56, 189, 248, 0.6)' : 'rgba(14, 165, 233, 0.6)',
                borderColor: currentTheme === 'dark' ? 'rgb(56, 189, 248)' : 'rgb(14, 165, 233)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items: any) => items[0].label,
                        label: (ctx: any) => `${ctx.raw} simulations`
                    }
                },
                annotation: {
                    annotations: {
                        p50: {
                            type: 'line',
                            xMin: weeks.indexOf(forecastData.p50Weeks),
                            xMax: weeks.indexOf(forecastData.p50Weeks),
                            borderColor: 'rgba(34, 197, 94, 0.8)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: `P50: ${forecastData.p50Weeks}w`,
                                position: 'start',
                                backgroundColor: 'rgba(34, 197, 94, 0.8)'
                            }
                        },
                        p85: {
                            type: 'line',
                            xMin: weeks.indexOf(forecastData.p85Weeks),
                            xMax: weeks.indexOf(forecastData.p85Weeks),
                            borderColor: 'rgba(234, 179, 8, 0.8)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: `P85: ${forecastData.p85Weeks}w`,
                                position: 'start',
                                backgroundColor: 'rgba(234, 179, 8, 0.8)'
                            }
                        },
                        p95: {
                            type: 'line',
                            xMin: weeks.indexOf(forecastData.p95Weeks),
                            xMax: weeks.indexOf(forecastData.p95Weeks),
                            borderColor: 'rgba(239, 68, 68, 0.8)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: `P95: ${forecastData.p95Weeks}w`,
                                position: 'start',
                                backgroundColor: 'rgba(239, 68, 68, 0.8)'
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            }
        } as any
    });
}
