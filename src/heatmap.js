/**
 * Activity Heatmap rendering logic
 */

export function renderActivityHeatmap(heatmapData, currentLanguage, translations) {
    const container = document.getElementById('heatmap-container');
    if (!container || !heatmapData) return;
    
    container.innerHTML = '';
    
    // Create scrollable wrapper
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'heatmap-scroll-wrapper';
    scrollWrapper.style.overflowX = 'auto';
    scrollWrapper.style.width = '100%';
    scrollWrapper.style.paddingBottom = '0.5rem';

    const heatmapWrapper = document.createElement('div');
    heatmapWrapper.className = 'heatmap-content-wrapper';
    heatmapWrapper.style.display = 'inline-flex';
    heatmapWrapper.style.flexDirection = 'column';
    heatmapWrapper.style.gap = '0.75rem';
    heatmapWrapper.style.minWidth = 'min-content';

    const now = new Date();
    let startDate = new Date();
    const dates = Object.keys(heatmapData);
    if (dates.length > 0) {
        dates.sort();
        startDate = new Date(dates[0]);
    } else {
        startDate.setMonth(now.getMonth() - 6);
    }
    
    startDate.setDate(startDate.getDate() - startDate.getDay()); 
    startDate.setHours(0,0,0,0);

    const weeks = [];
    let currentWeek = [];
    let iterDate = new Date(startDate);
    
    while (iterDate <= now) {
        currentWeek.push(new Date(iterDate));
        if (iterDate.getDay() === 6) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        iterDate.setDate(iterDate.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Months Row
    const monthsRow = document.createElement('div');
    monthsRow.className = 'heatmap-labels-months';
    monthsRow.style.display = 'flex';
    monthsRow.style.position = 'relative';
    monthsRow.style.height = '1.5rem';
    monthsRow.style.marginLeft = '50px'; // Matching daysCol width

    let lastMonth = -1;
    weeks.forEach((week, weekIdx) => {
        const firstDay = week[0];
        if (firstDay.getMonth() !== lastMonth) {
            lastMonth = firstDay.getMonth();
            const monthLabel = document.createElement('div');
            monthLabel.style.position = 'absolute';
            monthLabel.style.left = `calc(${weekIdx} * (var(--heatmap-cell-size) + var(--heatmap-gap)))`;
            monthLabel.style.fontSize = '0.8rem';
            monthLabel.style.color = 'var(--text-muted)';
            monthLabel.style.whiteSpace = 'nowrap';
            monthLabel.textContent = firstDay.toLocaleString(currentLanguage, { month: 'short' });
            monthsRow.appendChild(monthLabel);
        }
    });
    heatmapWrapper.appendChild(monthsRow);

    const mainRow = document.createElement('div');
    mainRow.style.display = 'flex';
    mainRow.style.gap = '8px';

    const daysCol = document.createElement('div');
    daysCol.className = 'heatmap-labels-days';
    const dayNames = translations[currentLanguage]['heatmap-days'].split(',');
        
    dayNames.forEach((day, i) => {
        const d = document.createElement('div');
        d.textContent = i % 2 === 0 ? day : '';
        d.style.height = 'var(--heatmap-cell-size)';
        d.style.lineHeight = 'var(--heatmap-cell-size)';
        d.style.fontSize = '0.75rem';
        daysCol.appendChild(d);
    });
    mainRow.appendChild(daysCol);

    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    grid.style.display = 'grid';
    grid.style.gridAutoFlow = 'column';
    grid.style.gridTemplateRows = 'repeat(7, var(--heatmap-cell-size))';
    grid.style.gap = 'var(--heatmap-gap)';
    
    weeks.forEach(week => {
        week.forEach(day => {
            const dateStr = day.toISOString().split('T')[0];
            const count = heatmapData[dateStr] || 0;
            
            const dayEl = document.createElement('div');
            dayEl.className = 'heatmap-day';
            dayEl.style.width = 'var(--heatmap-cell-size)';
            dayEl.style.height = 'var(--heatmap-cell-size)';
            dayEl.style.borderRadius = '3px';
            
            let level = 0;
            if (count > 0) level = 1;
            if (count > 2) level = 2;
            if (count > 5) level = 3;
            if (count > 10) level = 4;
            
            dayEl.classList.add(`heatmap-l${level}`);
            const labelDelivered = translations[currentLanguage]['label-delivered'].toLowerCase();
            dayEl.title = `${day.toLocaleDateString(currentLanguage)}: ${count} ${labelDelivered}`;
            grid.appendChild(dayEl);
        });
        
        // Filler for partial weeks
        if (week.length < 7) {
            for (let i = week.length; i < 7; i++) {
                const spacer = document.createElement('div');
                spacer.style.width = 'var(--heatmap-cell-size)';
                spacer.style.height = 'var(--heatmap-cell-size)';
                grid.appendChild(spacer);
            }
        }
    });

    mainRow.appendChild(grid);
    heatmapWrapper.appendChild(mainRow);
    scrollWrapper.appendChild(heatmapWrapper);
    container.appendChild(scrollWrapper);
}
