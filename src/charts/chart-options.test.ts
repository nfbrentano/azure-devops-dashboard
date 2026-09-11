import { describe, it, expect } from 'vitest';
import { getChartThemeOptions } from './chart-options.ts';
import Chart from 'chart.js/auto';

describe('chart-options.ts', () => {
    it('should set light theme options correctly', () => {
        const result = getChartThemeOptions('light');
        expect(result.gridColor).toBe('rgba(0,0,0,0.05)');
        expect(result.textColor).toBe('#64748b');
        expect(Chart.defaults.color).toBe('#64748b');
        expect(Chart.defaults.plugins.tooltip.backgroundColor).toBe('rgba(255, 255, 255, 0.9)');
    });

    it('should set dark theme options correctly', () => {
        const result = getChartThemeOptions('dark');
        expect(result.gridColor).toBe('rgba(255,255,255,0.05)');
        expect(result.textColor).toBe('#94a3b8');
        expect(Chart.defaults.color).toBe('#94a3b8');
        expect(Chart.defaults.plugins.tooltip.backgroundColor).toBe('rgba(15, 23, 42, 0.9)');
    });
});
