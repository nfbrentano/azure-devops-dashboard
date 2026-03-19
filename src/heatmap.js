/**
 * Activity Heatmap rendering logic
 */

export function renderActivityHeatmap(heatmapData, currentLanguage, translations) {
    const container = document.getElementById('heatmap-container');
    if (!container || !heatmapData) return;
    
    container.innerHTML = '';
    
    const heatmapWrapper = document.createElement('div');
    heatmapWrapper.style.display = 'flex';
    heatmapWrapper.style.flexDirection = 'column';
    heatmapWrapper.style.gap = '0.75rem';

    const now = new Date();
    const startDate = new Date();
    startDate.setMonth(now.getMonth() - 6);
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

    const monthsRow = document.createElement('div');
    monthsRow.className = 'heatmap-labels-months';
    monthsRow.style.display = 'flex';
    monthsRow.style.position = 'relative';
    monthsRow.style.height = '1.5rem';
    monthsRow.style.marginLeft = '58px'; 

    let lastMonth = -1;
    weeks.forEach((week, weekIdx) => {
        const firstDay = week[0];
        if (firstDay.getMonth() !== lastMonth) {
            lastMonth = firstDay.getMonth();
            const monthLabel = document.createElement('div');
            monthLabel.style.position = 'absolute';
            monthLabel.style.left = `${weekIdx * 26}px`; 
            monthLabel.style.fontSize = '0.9rem';
            monthLabel.style.color = 'var(--text-muted)';
            monthLabel.textContent = firstDay.toLocaleString(currentLanguage, { month: 'short' });
            monthsRow.appendChild(monthLabel);
        }
    });
    heatmapWrapper.appendChild(monthsRow);

    const mainRow = document.createElement('div');
    mainRow.style.display = 'flex';
    mainRow.style.gap = '0.75rem';

    const daysCol = document.createElement('div');
    daysCol.className = 'heatmap-labels-days';
    const dayNames = currentLanguage === 'pt-br' 
        ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
    dayNames.forEach((day, i) => {
        const d = document.createElement('div');
        d.textContent = i % 2 === 0 ? day : '';
        d.style.height = '22px';
        d.style.lineHeight = '22px';
        daysCol.appendChild(d);
    });
    mainRow.appendChild(daysCol);

    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    grid.style.gridTemplateRows = 'repeat(7, 22px)';
    grid.style.gap = '4px';
    
    weeks.forEach(week => {
        week.forEach(day => {
            const dateStr = day.toISOString().split('T')[0];
            const count = heatmapData[dateStr] || 0;
            
            const dayEl = document.createElement('div');
            dayEl.className = 'heatmap-day';
            
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
        if (week.length < 7) {
            for (let i = week.length; i < 7; i++) {
                const spacer = document.createElement('div');
                spacer.style.width = '22px';
                spacer.style.height = '22px';
                grid.appendChild(spacer);
            }
        }
    });

    mainRow.appendChild(grid);
    heatmapWrapper.appendChild(mainRow);
    container.appendChild(heatmapWrapper);
}
