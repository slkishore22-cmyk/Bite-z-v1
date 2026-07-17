// Local-first cart store. Survives reloads, syncs across tabs.
// Items reference the seller inventory item id so quantities stay accurate
// even when the seller updates name/price/icon.

import type { SellerCategory } from "./sellerInventory";

export type CartItem = {
  itemId: string;
  name: string;
  price: number;
  icon: string;
  category: SellerCategory;
  qty: number;
  canteenId?: string;
  canteenIcon?: string;
  canteenName?: string;
};

const STORAGE_KEY = "bitez:user:cart";
const EVENT_NAME = "bitez:user:cart:change";
const UNKNOWN_CANTEEN_KEY = "__unknown__";

function sameCartLine(item: Pick<CartItem, "itemId" | "canteenId">, itemId: string, canteenId?: string) {
  return item.itemId === itemId && (item.canteenId ?? UNKNOWN_CANTEEN_KEY) === (canteenId ?? UNKNOWN_CANTEEN_KEY);
}

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getCart(): CartItem[] {
  return read();
}

export function addToCart(item: Omit<CartItem, "qty">, qty = 1) {
  const items = read();
  const existing = items.find((i) => sameCartLine(i, item.itemId, item.canteenId));
  if (existing) {
    existing.qty += qty;
  } else {
    items.push({ ...item, qty });
  }
  write(items.filter((i) => i.qty > 0));
}

export function setCartQty(itemId: string, qty: number, canteenId?: string) {
  const items = read()
    .map((i) => (sameCartLine(i, itemId, canteenId) ? { ...i, qty: Math.max(0, qty) } : i))
    .filter((i) => i.qty > 0);
  write(items);
}

export function removeCartItem(itemId: string, canteenId?: string) {
  write(read().filter((i) => !sameCartLine(i, itemId, canteenId)));
}

export function clearCart(canteenId?: string) {
  if (canteenId === undefined) {
    write([]);
    return;
  }
  write(read().filter((i) => (i.canteenId ?? UNKNOWN_CANTEEN_KEY) !== (canteenId ?? UNKNOWN_CANTEEN_KEY)));
}

/**
 * Remove cart items whose canteen no longer exists. Call this after the list
 * of registered canteens is refreshed from the backend so orphaned lines
 * (from deleted/suspended sellers) disappear from the cart automatically.
 */
export function pruneCartByCanteens(validCanteenIds: string[]) {
  const valid = new Set(validCanteenIds);
  const items = read();
  const filtered = items.filter((i) => i.canteenId && valid.has(i.canteenId));
  if (filtered.length !== items.length) write(filtered);
}

export function subscribeCart(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener(EVENT_NAME, onLocal as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onLocal as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}