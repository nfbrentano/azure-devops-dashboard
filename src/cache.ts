/**
 * Intelligent API Cache for Azure DevOps Dashboard
 *
 * Features:
 *  - TTL-based in-memory cache (session-scoped, never persisted)
 *  - In-flight request deduplication (same URL called concurrently → 1 real request)
 *  - Rate-limit (429) awareness: marks origins as throttled until Retry-After expires
 *  - Cache statistics: hits, misses, inflight dedupes, throttle skips
 */

import type { CacheEntry, CacheStats } from './types.ts';

// TTL presets (milliseconds)
export const TTL = {
    METADATA: 30 * 60 * 1000, //  30 minutes – work item types, states, backlogs
    QUERIES: 5 * 60 * 1000, //   5 minutes – list of saved queries
    WORK_ITEMS: 2 * 60 * 1000, //   2 minutes – work item details (chunks)
    REVISIONS: 10 * 60 * 1000 //  10 minutes – per-item revision history
} as const;

// ─── Internal state ──────────────────────────────────────────────────────────

const _store = new Map<string, CacheEntry>();

const _inflight = new Map<string, Promise<unknown>>();

const _throttled = new Map<string, number>();

const _stats: Omit<CacheStats, 'size'> = { hits: 0, misses: 0, inflight: 0, throttled: 0 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _origin(url: string): string {
    try {
        return new URL(url).origin;
    } catch {
        return url;
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns cached value if still valid, otherwise undefined.
 */
function get<T = unknown>(url: string): T | undefined {
    const entry = _store.get(url);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        _store.delete(url);
        return undefined;
    }
    return entry.data as T;
}

/**
 * Stores a value with a TTL (ms).
 */
function set(url: string, data: unknown, ttl: number): void {
    _store.set(url, { data, expiresAt: Date.now() + ttl });
}

/**
 * Core helper: returns cached data, deduplicates concurrent requests, and
 * skips the real fetch if the origin is throttled.
 */
async function getOrFetch<T>(url: string, fetchFn: () => Promise<T>, ttl: number, bust = false): Promise<T> {
    if (!bust) {
        const cached = get<T>(url);
        if (cached !== undefined) {
            _stats.hits++;
            return cached;
        }
    }

    _stats.misses++;

    // Deduplicate concurrent requests for the same URL
    if (_inflight.has(url)) {
        _stats.inflight++;
        return _inflight.get(url) as Promise<T>;
    }

    const promise = (async (): Promise<T> => {
        try {
            const data = await fetchFn();
            if (data !== null && data !== undefined) {
                set(url, data, ttl);
            }
            return data;
        } finally {
            _inflight.delete(url);
        }
    })();

    _inflight.set(url, promise);
    return promise;
}

/**
 * Marks an origin as throttled for `retryAfterMs` milliseconds.
 */
function markThrottled(url: string, retryAfterMs = 60_000): void {
    _throttled.set(_origin(url), Date.now() + retryAfterMs);
    _stats.throttled++;
}

/**
 * Returns true if the origin of `url` is currently rate-limited.
 */
function isThrottled(url: string): boolean {
    const origin = _origin(url);
    const until = _throttled.get(origin);
    if (!until) return false;
    if (Date.now() >= until) {
        _throttled.delete(origin);
        return false;
    }
    return true;
}

/**
 * Invalidates all cache entries whose key starts with `prefix`.
 */
function invalidate(prefix: string): void {
    for (const key of _store.keys()) {
        if (key.startsWith(prefix)) _store.delete(key);
    }
    for (const key of _inflight.keys()) {
        if (key.startsWith(prefix)) _inflight.delete(key);
    }
}

/**
 * Clears the entire cache and resets in-flight tracking.
 */
function invalidateAll(): void {
    _store.clear();
    _inflight.clear();
    _throttled.clear();
    _stats.hits = _stats.misses = _stats.inflight = _stats.throttled = 0;
}

/**
 * Returns a snapshot of current cache statistics.
 */
function getStats(): CacheStats {
    return { ..._stats, size: _store.size };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const apiCache = { get, set, getOrFetch, markThrottled, isThrottled, invalidate, invalidateAll, getStats };
