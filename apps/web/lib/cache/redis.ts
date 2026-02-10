/**
 * In-memory cache stub (Teammate B).
 * Will be replaced with Upstash Redis client.
 */

const store = new Map<string, { value: string; expiresAt: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 86400,
): Promise<void> {
  store.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDel(key: string): Promise<void> {
  store.delete(key);
}
