import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiCache, TTL } from './cache.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function advanceTime(ms: number): void {
    vi.setSystemTime(Date.now() + ms);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cache.ts', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        apiCache.invalidateAll();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    // ── get / set ─────────────────────────────────────────────────────────────

    describe('get / set', () => {
        it('should store and retrieve a value within TTL', () => {
            apiCache.set('https://example.com/a', { foo: 'bar' }, 5000);
            expect(apiCache.get('https://example.com/a')).toEqual({ foo: 'bar' });
        });

        it('should return undefined for an unknown key', () => {
            expect(apiCache.get('https://example.com/unknown')).toBeUndefined();
        });

        it('should return undefined after TTL expires', () => {
            apiCache.set('https://example.com/b', 42, 1000);
            advanceTime(1001);
            expect(apiCache.get('https://example.com/b')).toBeUndefined();
        });

        it('should still return value just before TTL expires', () => {
            apiCache.set('https://example.com/c', 99, 1000);
            advanceTime(999);
            expect(apiCache.get('https://example.com/c')).toBe(99);
        });
    });

    // ── getOrFetch ────────────────────────────────────────────────────────────

    describe('getOrFetch', () => {
        it('should call fetchFn on cache miss', async () => {
            const fetchFn = vi.fn().mockResolvedValue('fresh-data');
            const result = await apiCache.getOrFetch('https://example.com/d', fetchFn, 5000);
            expect(fetchFn).toHaveBeenCalledOnce();
            expect(result).toBe('fresh-data');
        });

        it('should NOT call fetchFn on cache hit', async () => {
            apiCache.set('https://example.com/e', 'cached-data', 5000);
            const fetchFn = vi.fn().mockResolvedValue('fresh-data');
            const result = await apiCache.getOrFetch('https://example.com/e', fetchFn, 5000);
            expect(fetchFn).not.toHaveBeenCalled();
            expect(result).toBe('cached-data');
        });

        it('should call fetchFn when bust=true even if cached', async () => {
            apiCache.set('https://example.com/f', 'old-data', 5000);
            const fetchFn = vi.fn().mockResolvedValue('new-data');
            const result = await apiCache.getOrFetch('https://example.com/f', fetchFn, 5000, true);
            expect(fetchFn).toHaveBeenCalledOnce();
            expect(result).toBe('new-data');
        });

        it('should deduplicate concurrent requests for the same URL', async () => {
            let resolveFirst!: (value: unknown) => void;
            const fetchFn = vi.fn(() => new Promise(res => { resolveFirst = res; }));

            const url = 'https://example.com/g';
            const p1 = apiCache.getOrFetch(url, fetchFn, 5000);
            const p2 = apiCache.getOrFetch(url, fetchFn, 5000);

            // Only 1 actual call should have been made
            expect(fetchFn).toHaveBeenCalledTimes(1);

            resolveFirst('deduped-value');
            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1).toBe('deduped-value');
            expect(r2).toBe('deduped-value');
        });
    });

    // ── invalidate ────────────────────────────────────────────────────────────

    describe('invalidate', () => {
        it('should remove entries matching a prefix', () => {
            apiCache.set('https://dev.azure.com/org/proj/a', 1, 5000);
            apiCache.set('https://dev.azure.com/org/proj/b', 2, 5000);
            apiCache.set('https://other.com/c', 3, 5000);

            apiCache.invalidate('https://dev.azure.com/org/proj');

            expect(apiCache.get('https://dev.azure.com/org/proj/a')).toBeUndefined();
            expect(apiCache.get('https://dev.azure.com/org/proj/b')).toBeUndefined();
            expect(apiCache.get('https://other.com/c')).toBe(3);
        });

        it('invalidateAll should clear everything and reset stats', async () => {
            apiCache.set('https://example.com/x', 'x', 5000);
            await apiCache.getOrFetch('https://example.com/y', async () => 'y', 5000);
            apiCache.invalidateAll();

            expect(apiCache.get('https://example.com/x')).toBeUndefined();
            expect(apiCache.getStats().size).toBe(0);
            expect(apiCache.getStats().hits).toBe(0);
        });
    });

    // ── throttle ─────────────────────────────────────────────────────────────

    describe('throttle', () => {
        it('should mark and detect a throttled origin', () => {
            apiCache.markThrottled('https://dev.azure.com/org/proj/endpoint', 10_000);
            expect(apiCache.isThrottled('https://dev.azure.com/org/proj/other')).toBe(true);
        });

        it('should return false after throttle period expires', () => {
            apiCache.markThrottled('https://dev.azure.com/', 1000);
            advanceTime(1001);
            expect(apiCache.isThrottled('https://dev.azure.com/')).toBe(false);
        });

        it('should not throttle unrelated origins', () => {
            apiCache.markThrottled('https://dev.azure.com/', 10_000);
            expect(apiCache.isThrottled('https://other.com/api')).toBe(false);
        });
    });

    // ── stats ─────────────────────────────────────────────────────────────────

    describe('getStats', () => {
        it('should count hits and misses correctly', async () => {
            const fetchFn = vi.fn().mockResolvedValue('data');
            await apiCache.getOrFetch('https://example.com/stats', fetchFn, 5000);
            await apiCache.getOrFetch('https://example.com/stats', fetchFn, 5000);

            const stats = apiCache.getStats();
            expect(stats.misses).toBe(1);
            expect(stats.hits).toBe(1);
        });

        it('should count throttled calls', () => {
            apiCache.markThrottled('https://dev.azure.com/', 5000);
            apiCache.markThrottled('https://dev.azure.com/', 5000);
            expect(apiCache.getStats().throttled).toBe(2);
        });
    });

    // ── TTL presets ───────────────────────────────────────────────────────────

    describe('TTL presets', () => {
        it('should export sensible TTL values', () => {
            expect(TTL.METADATA).toBeGreaterThanOrEqual(10 * 60 * 1000);
            expect(TTL.QUERIES).toBeGreaterThanOrEqual(60 * 1000);
            expect(TTL.WORK_ITEMS).toBeGreaterThanOrEqual(60 * 1000);
            expect(TTL.REVISIONS).toBeGreaterThanOrEqual(60 * 1000);
        });
    });
});
