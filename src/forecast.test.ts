import { describe, it, expect } from 'vitest';
import { runMonteCarloSimulation } from './forecast.ts';
import type { ThroughputDataPoint } from './types.ts';

describe('forecast.ts', () => {
    it('should calculate probabilistic delivery percentiles in forecast simulations', () => {
        const mockThroughput: ThroughputDataPoint[] = [
            { label: 'W1', range: '1-7 Jan', count: 4 },
            { label: 'W2', range: '8-14 Jan', count: 6 },
            { label: 'W3', range: '15-21 Jan', count: 5 },
            { label: 'W4', range: '22-28 Jan', count: 5 }
        ];

        const remainingItems = 20;
        const result = runMonteCarloSimulation(mockThroughput, remainingItems, 5000);

        expect(result).toBeDefined();
        expect(result?.simulations).toBe(5000);
        expect(result?.totalRemaining).toBe(20);
        expect(result?.p50Weeks).toBeGreaterThanOrEqual(3);
        expect(result?.p85Weeks).toBeGreaterThanOrEqual(result!.p50Weeks);
        expect(result?.p95Weeks).toBeGreaterThanOrEqual(result!.p85Weeks);
    });

    it('should return null when no throughput history or remaining items is zero', () => {
        expect(runMonteCarloSimulation([], 10)).toBeNull();
        expect(runMonteCarloSimulation([{ label: 'W1', range: '', count: 5 }], 0)).toBeNull();
    });
});
