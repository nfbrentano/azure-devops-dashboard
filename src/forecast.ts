import type { ThroughputDataPoint } from './types.ts';

export interface ForecastResult {
    simulations: number;
    p50Weeks: number;
    p85Weeks: number;
    p95Weeks: number;
    histogram: Record<number, number>; // weeks -> count
    totalRemaining: number;
}

export function runMonteCarloSimulation(throughputHistory: ThroughputDataPoint[], remainingItems: number, numSimulations = 10000): ForecastResult | null {
    if (!throughputHistory || throughputHistory.length === 0 || remainingItems <= 0) {
        return null;
    }

    const throughputCounts = throughputHistory.map(d => d.count);
    // If all past weeks had 0 throughput, we can't forecast
    if (throughputCounts.every(c => c === 0)) {
        return null;
    }

    const results: number[] = [];
    const histogram: Record<number, number> = {};

    for (let i = 0; i < numSimulations; i++) {
        let itemsDelivered = 0;
        let weeksTaken = 0;

        // Failsafe: max 100 weeks to prevent infinite loops if throughput is too low
        while (itemsDelivered < remainingItems && weeksTaken < 100) {
            const randomWeekIndex = Math.floor(Math.random() * throughputCounts.length);
            itemsDelivered += throughputCounts[randomWeekIndex];
            weeksTaken++;
        }
        
        results.push(weeksTaken);
        histogram[weeksTaken] = (histogram[weeksTaken] || 0) + 1;
    }

    results.sort((a, b) => a - b);

    const getPercentile = (p: number) => {
        const idx = Math.floor(results.length * p);
        return results[idx];
    };

    return {
        simulations: numSimulations,
        p50Weeks: getPercentile(0.50),
        p85Weeks: getPercentile(0.85),
        p95Weeks: getPercentile(0.95),
        histogram,
        totalRemaining: remainingItems
    };
}
