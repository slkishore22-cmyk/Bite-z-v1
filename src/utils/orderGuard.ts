// Global hard guard preventing the order creation flow from being entered
// more than once concurrently. Lives at module scope so accidental re-entry
// from re-renders, realtime callbacks, or stray timers is blocked even if a
// stale React closure tries to fire it.

let orderInProgress = false;
let autoResetTimer: any = null;

export function beginOrder(): void {
  if (orderInProgress) {
    throw new Error("Order already in progress");
  }
  orderInProgress = true;
  if (typeof window !== "undefined") {
    if (autoResetTimer) window.clearTimeout(autoResetTimer);
    autoResetTimer = window.setTimeout(() => {
      orderInProgress = false;
    }, 8000); // safety auto-reset after 8 seconds
  }
}

export function endOrder(): void {
  orderInProgress = false;
  if (typeof window !== "undefined" && autoResetTimer) {
    window.clearTimeout(autoResetTimer);
    autoResetTimer = null;
  }
}

export function isOrderInProgress(): boolean {
  return orderInProgress;
}