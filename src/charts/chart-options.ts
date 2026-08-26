import Chart from 'chart.js/auto';

export function getChartThemeOptions(currentTheme: 'dark' | 'light') {
    const isLight = currentTheme === 'light';
    
    // Set dynamic defaults based on theme
    Chart.defaults.color = isLight ? '#64748b' : '#94a3b8';
    Chart.defaults.plugins.tooltip.backgroundColor = isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.9)';
    Chart.defaults.plugins.tooltip.titleColor = isLight ? '#0f172a' : '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = isLight ? '#334155' : '#e2e8f0';
    Chart.defaults.plugins.tooltip.borderColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;

    return {
        gridColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
        textColor: isLight ? '#64748b' : '#94a3b8'
    };
}

// Global defaults for premium aesthetics
Chart.defaults.font.family = "'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif";
Chart.defaults.elements.line.tension = 0.4; // Smooth curves
Chart.defaults.elements.line.borderWidth = 2;
Chart.defaults.elements.point.radius = 4;
Chart.defaults.elements.point.hoverRadius = 6;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.displayColors = true;
Chart.defaults.plugins.tooltip.boxPadding = 6;
Chart.defaults.animation = {
    duration: 800,
    easing: 'easeOutQuart'
} as any;
