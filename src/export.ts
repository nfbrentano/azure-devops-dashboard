import { state } from './state.ts';
import type { WorkItemNode, WorkItemMetadata, AzureConfig } from './types.ts';
import { getStatusInfo } from './utils.ts';
import { translations } from './translations.ts';

export function exportToCSV(items: WorkItemNode[], workItemMetadata: WorkItemMetadata, currentLanguage: string) {
    if (!items || items.length === 0) return;

    const t = translations[currentLanguage] || translations['en'];

    // Headers
    const headers = [
        'ID',
        'Title',
        'State',
        'Type',
        'Assigned To',
        'Created Date',
        'Closed Date',
        'Lead Time (Days)',
        'Cycle Time (Days)'
    ];

    // Rows
    const rows = items.map(item => {
        const f = item.fields;
        const createdDate = new Date(f['System.CreatedDate'] as string);
        const activatedDate = f['Microsoft.VSTS.Common.ActivatedDate']
            ? new Date(f['Microsoft.VSTS.Common.ActivatedDate'] as string)
            : null;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        const closedDate = closedDateStr ? new Date(closedDateStr as string) : null;

        let leadTime = '';
        let cycleTime = '';

        if (closedDate && !isNaN(closedDate.getTime())) {
            leadTime = ((closedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1);
            cycleTime = activatedDate ? ((closedDate.getTime() - activatedDate.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1) : '0';
        }

        const assigneeObj = f['System.AssignedTo'] as { displayName?: string; uniqueName?: string } | undefined;
        let assignee = '';
        if (assigneeObj && typeof assigneeObj === 'object') {
            assignee = assigneeObj.displayName || assigneeObj.uniqueName || '';
        } else if (typeof assigneeObj === 'string') {
            assignee = assigneeObj;
        }

        return [
            item.id,
            `"${(f['System.Title'] as string || '').replace(/"/g, '""')}"`,
            `"${f['System.State'] as string || ''}"`,
            `"${f['System.WorkItemType'] as string || ''}"`,
            `"${assignee}"`,
            createdDate.toISOString().split('T')[0],
            closedDate ? closedDate.toISOString().split('T')[0] : '',
            leadTime,
            cycleTime
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `azure-devops-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export async function exportToPDF(isDark: boolean, azureConfig: AzureConfig | null) {
    // Dynamically import jsPDF and html2canvas
    const { jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    
    const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });
    
    const elementsToExport = [
        document.getElementById('dashboard-kpis'),
        document.getElementById('dora-metrics-container'),
        document.getElementById('dashboard-content'),
        document.getElementById('items-content'),
        document.getElementById('timeline-content')
    ];
    
    const bgColor = isDark ? '#0f172a' : '#f8fafc';
    let isFirstPage = true;

    for (const el of elementsToExport) {
        if (!el || el.classList.contains('hidden') || el.style.display === 'none') continue;
        
        // Add exporting class to cleanup UI for export
        el.classList.add('exporting');
        
        try {
            const canvas = await html2canvas(el, {
                backgroundColor: bgColor,
                scale: 1.5,
                useCORS: true,
                allowTaint: true,
                ignoreElements: (node) => node.classList?.contains('export-btn') || node.classList?.contains('no-print')
            });
            
            if (!isFirstPage) {
                pdf.addPage();
            }
            isFirstPage = false;
            
            const imgData = canvas.toDataURL('image/png');
            
            // Calculate dimensions to fit A4 page width
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // If it's too tall, we might need multiple pages for this element, 
            // but for simplicity we just scale it down to fit the page width and let it overflow to next pages if needed
            // A more robust implementation would split the canvas.
            const pageHeight = pdf.internal.pageSize.getHeight();
            const topMargin = 10;
            const bottomMargin = 15;
            const usableHeight = pageHeight - topMargin - bottomMargin;

            if (pdfHeight > usableHeight) {
                let heightLeft = pdfHeight;
                let pageOffset = 0;

                pdf.addImage(imgData, 'PNG', 0, topMargin, pdfWidth, pdfHeight);
                heightLeft -= usableHeight;

                while (heightLeft > 0) {
                    pageOffset += usableHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, topMargin - pageOffset, pdfWidth, pdfHeight);
                    heightLeft -= usableHeight;
                }
            } else {
                pdf.addImage(imgData, 'PNG', 0, topMargin, pdfWidth, pdfHeight);
            }

            // Add watermark text
            if (azureConfig?.companyName) {
                pdf.setTextColor(isDark ? 200 : 100);
                pdf.setFontSize(9);
                pdf.text(azureConfig.companyName, 10, pageHeight - 6);
            }
        } catch (e) {
            console.error('Error rendering element for PDF', e);
        } finally {
            el.classList.remove('exporting');
        }
    }
    
    pdf.save(`azure-devops-dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
}
