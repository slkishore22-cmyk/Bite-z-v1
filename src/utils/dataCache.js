// Tiny in-memory stale-while-revalidate cache for Supabase reads.
// - Returns cached data instantly when fresh (under TTL).
// - Returns stale data immediately AND refreshes in background.
// - On network error returns the last known value, or [] as a safe fallback.
// Never throws.

const cache = new Map();

export async function cachedFetch(key, fetchFn, ttlMs = 30000) {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data;
  }

  if (cached) {
    // Stale — return immediately, refresh in background.
    Promise.resolve()
      .then(fetchFn)
      .then((fresh) => {
        cache.set(key, { data: fresh, timestamp: Date.now() });
      })
      .catch(() => {});
    return cached.data;
  }

  try {
    const data = await fetchFn();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.warn("[dataCache] fetch failed, returning empty fallback:", key, err);
    return [];
  }
}

export function invalidateCache(key) {
  cache.delete(key);
}

export function clearAllCache() {
  cache.clear();
}

export function peekCache(key) {
  return cache.get(key)?.data;
}