// Lightweight offline-state helpers. Service worker / PWA registration has
// been removed from this project — these helpers just wrap navigator.onLine
// for the OfflineBanner component.

export type OfflineListener = (offline: boolean) => void;

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function subscribeOffline(cb: OfflineListener) {
  if (typeof window === "undefined") return () => {};
  const fire = () => cb(isOffline());
  window.addEventListener("online", fire);
  window.addEventListener("offline", fire);
  return () => {
    window.removeEventListener("online", fire);
    window.removeEventListener("offline", fire);
  };
}

// No-op kept so existing imports keep working after PWA removal.
export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignore */
  }
}
