/**
 * High-performance in-memory cache with Stale-While-Revalidate support
 * Ensures instant page transitions without wiping data or showing spinners every time.
 */

type CacheEntry<T> = {
  data: T
  timestamp: number
}

const memoryCache = new Map<string, CacheEntry<any>>()

export function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  return entry.data as T
}

export function hasCached(key: string): boolean {
  return memoryCache.has(key)
}

export function setCached<T>(key: string, data: T): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
  })
}

export function invalidateCache(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    memoryCache.clear()
    return
  }
  for (const key of memoryCache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      memoryCache.delete(key)
    }
  }
}
