// In-memory cache for scraped prices
// TTL: 15 minutes — keeps data fresh without hammering stores

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached<T>(key: string, data: T, ttlMs = TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function cacheKey(...parts: string[]): string {
  return parts.join("::");
}
