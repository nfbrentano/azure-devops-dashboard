import type { WorkItemNode, WorkItemMetadata } from './types.ts';
import { isRequirementType, getItemIcon } from './utils.ts';

export interface DORAMetrics {
    deploymentFrequency: { value: number, class: string, raw: number }; // deployments per week
    leadTimeForChanges: { value: number, class: string, raw: number }; // days
    changeFailureRate: { value: number, class: string, raw: number }; // percentage
    timeToRestore: { value: number, class: string, raw: number }; // days
}

function classifyDeploymentFrequency(weeklyDeployments: number): string {
    if (weeklyDeployments >= 7) return 'Elite';
    if (weeklyDeployments >= 1) return 'High';
    if (weeklyDeployments >= 1 / 4) return 'Medium'; // once a month
    return 'Low';
}

function classifyLeadTime(days: number): string {
    if (days === 0) return '-';
    if (days <= 1) return 'Elite';
    if (days <= 7) return 'High';
    if (days <= 30) return 'Medium';
    return 'Low';
}

function classifyChangeFailureRate(percentage: number): string {
    if (percentage === -1) return '-';
    if (percentage <= 15) return 'Elite';
    if (percentage <= 30) return 'High';
    if (percentage <= 45) return 'Medium';
    return 'Low';
}

function classifyTimeToRestore(days: number): string {
    if (days === -1) return '-';
    if (days <= 1) return 'Elite';
    if (days <= 7) return 'High';
    if (days <= 30) return 'Medium';
    return 'Low';
}

export function calculateDORAMetrics(
    items: WorkItemNode[],
    workItemMetadata: WorkItemMetadata,
    daysWindow = 30
): DORAMetrics {
    const now = new Date();
    const windowStartDate = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

    let totalDeployments = 0; // Number of requirement items closed
    let totalLeadTimeDays = 0;
    let bugsCreatedAfterDeployments = 0; // Bugs created in the window
    let totalBugRestoreTimeDays = 0;
    let resolvedBugsCount = 0;

    items.forEach((item) => {
        const f = item.fields;
        const type = ((f['System.WorkItemType'] as string) || '').toLowerCase();
        const iconInfo = getItemIcon(type, workItemMetadata);
        const isBug = type === 'bug' || iconInfo.icon.includes('bug');

        const createdDate = new Date(f['System.CreatedDate'] as string);
        const activatedDate = f['Microsoft.VSTS.Common.ActivatedDate']
            ? new Date(f['Microsoft.VSTS.Common.ActivatedDate'] as string)
            : null;
        const closedDateStr = f['Microsoft.VSTS.Common.ClosedDate'] || f['System.ClosedDate'];
        const closedDate = closedDateStr ? new Date(closedDateStr as string) : null;

        if (isRequirementType(type, workItemMetadata)) {
            // Count deployments (closed requirements in window)
            if (closedDate && closedDate >= windowStartDate) {
                totalDeployments++;
                totalLeadTimeDays += (closedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
            }
        }

        if (isBug) {
            if (createdDate >= windowStartDate) {
                bugsCreatedAfterDeployments++;
            }
            if (closedDate && closedDate >= windowStartDate) {
                resolvedBugsCount++;
                // MTTR: prefer activatedDate to closedDate if available, else createdDate
                const startDate = activatedDate || createdDate;
                totalBugRestoreTimeDays += (closedDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
            }
        }
    });

    const weeksInWindow = daysWindow / 7;
    const dfValue = totalDeployments / weeksInWindow; // deployments per week
    const ltValue = totalDeployments > 0 ? totalLeadTimeDays / totalDeployments : 0;
    const cfrValue = totalDeployments > 0 ? Math.min(100, (bugsCreatedAfterDeployments / totalDeployments) * 100) : -1;
    const mttrValue = resolvedBugsCount > 0 ? totalBugRestoreTimeDays / resolvedBugsCount : -1;

    return {
        deploymentFrequency: {
            value: Number(dfValue.toFixed(1)),
            class: classifyDeploymentFrequency(dfValue),
            raw: dfValue
        },
        leadTimeForChanges: {
            value: Number(ltValue.toFixed(1)),
            class: classifyLeadTime(ltValue),
            raw: ltValue
        },
        changeFailureRate: {
            value: Number(cfrValue.toFixed(1)),
            class: classifyChangeFailureRate(cfrValue),
            raw: cfrValue
        },
        timeToRestore: {
            value: Number(mttrValue.toFixed(1)),
            class: classifyTimeToRestore(mttrValue),
            raw: mttrValue
        }
    };
}
