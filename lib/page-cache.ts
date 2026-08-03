/**
 * page-cache.ts
 * Lightweight stale-while-revalidate cache for page-level data fetches.
 * Module-level (survives tab navigation within a session, cleared on logout).
 * TTL: 30s — stale data renders instantly, fresh data replaces it silently.
 */

interface CacheEntry {
  data: any
  ts: number
}

const _cache = new Map<string, CacheEntry>()
const TTL_MS = 30_000

export function cacheGet(key: string): any | null {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL_MS) return null
  return entry.data
}

export function cacheSet(key: string, data: any): void {
  _cache.set(key, { data, ts: Date.now() })
}

export function cacheInvalidate(...keys: string[]): void {
  for (const k of keys) _cache.delete(k)
}

export function cacheClear(): void {
  _cache.clear()
}

/**
 * cachedFetch — wraps a fetch call with SWR behaviour.
 * If cached data exists (even stale), calls onData immediately then revalidates.
 * If no cache, fetches normally and calls onData when done.
 */
export async function cachedFetch(
  key: string,
  fetcher: () => Promise<any>,
  onData: (data: any, isStale: boolean) => void
): Promise<void> {
  const cached = cacheGet(key)
  if (cached !== null) {
    onData(cached, true)           // render immediately with stale data
    // Revalidate in background
    try {
      const fresh = await fetcher()
      cacheSet(key, fresh)
      onData(fresh, false)         // silently update with fresh data
    } catch { /* keep stale */ }
    return
  }
  // No cache — fetch and block
  try {
    const data = await fetcher()
    cacheSet(key, data)
    onData(data, false)
  } catch { onData(null, false) }
}
