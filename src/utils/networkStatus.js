// Connectivity helpers. Safe in SSR (guards `window`).

export function isOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function onNetworkChange(callback) {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => callback(true);
  const onOffline = () => callback(false);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

// Retry with exponential backoff. Returns null after max retries.
export async function retryFetch(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) {
        console.warn("[retryFetch] giving up:", err);
        return null;
      }
      const delay = Math.min(1000 * 2 ** i, 5000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

// Wrap a Supabase query (PostgrestBuilder is thenable) with a timeout.
// Always resolves — never rejects — to keep UI from crashing on slow networks.
export async function queryWithTimeout(queryPromise, ms = 8000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Query timeout")), ms);
  });
  try {
    const result = await Promise.race([queryPromise, timeout]);
    return result;
  } catch (err) {
    console.warn("[queryWithTimeout] timed out or failed:", err?.message || err);
    return { data: null, error: err };
  } finally {
    clearTimeout(timer);
  }
}