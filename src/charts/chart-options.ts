/**
 * Chart Theme and Styling Utilities
 */

export function getChartThemeOptions(currentTheme: 'dark' | 'light') {
    const isLight = currentTheme === 'light';
    return {
        gridColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
        textColor: isLight ? '#64748b' : '#94a3b8'
    };
}
