// Wipes any localStorage entries that hold a SINGLE seller's data without
// being keyed by seller id. These caches caused the "previous canteen still
// showing after a new seller logs in" overlap bug.
//
// Shared multi-seller caches (canteen list, shared inventory which IS keyed
// by seller_id internally, the react-query persister) are intentionally NOT
// wiped — they don't leak one seller's identity into another.

const PER_SELLER_KEYS = [
  "bitez.seller.profile",
  "bitez:seller:offers",
  "bitez:seller:staff",
  "bitez:orders",
  "bitez:seller:order_sound_played",
];

export function clearSellerScopedCaches(): void {
  if (typeof window === "undefined") return;
  for (const key of PER_SELLER_KEYS) {
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    try { window.sessionStorage.removeItem(key); } catch { /* ignore */ }
  }
  // Drop the persisted react-query cache so the new seller doesn't briefly
  // see the previous seller's dashboard numbers, orders, etc.
  try { window.localStorage.removeItem("bitez-cache-v2"); } catch { /* ignore */ }
}