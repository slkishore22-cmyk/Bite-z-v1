import { db } from "@/integrations/firebase/client";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { getCart, removeCartItem, setCartQty } from "@/lib/userCart";

export type SellerCategory = "Food" | "Snacks" | "Drinks";
export type SellerStatus = "Active" | "Inactive";

export type SellerInventoryItem = {
  id: string;
  sellerId?: string | null;
  name: string;
  price: number;
  category: SellerCategory;
  icon: string;
  iconLabel: string;
  status: SellerStatus;
  createdAt: number;
  stockLimit?: number | null;
  availableUntil?: string | null;
  inventoryType?: "none" | "quantity" | "time" | null;
  stockQuantity?: number | null;
  availableFrom?: string | null;
  availableTo?: string | null;
};

export function isItemAvailable(it: SellerInventoryItem): boolean {
  if (it.status !== "Active") return false;
  if (it.availableUntil && new Date(it.availableUntil).getTime() <= Date.now()) return false;
  if (typeof it.stockLimit === "number" && it.stockLimit <= 0) return false;
  if (it.inventoryType === "quantity") {
    if (typeof it.stockQuantity !== "number" || it.stockQuantity <= 0) return false;
  }
  if (it.inventoryType === "time") {
    if (!it.availableFrom || !it.availableTo) return false;
    const ist = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    const cur = ist.getHours() * 60 + ist.getMinutes();
    const [fh, fm] = it.availableFrom.split(":").map(Number);
    const [th, tm] = it.availableTo.split(":").map(Number);
    const from = fh * 60 + (fm || 0);
    const to = th * 60 + (tm || 0);
    if (from <= to) {
      if (cur < from || cur > to) return false;
    } else {
      if (cur < from && cur > to) return false;
    }
  }
  return true;
}

export function maxPurchasableQty(it: SellerInventoryItem): number {
  if (it.inventoryType === "quantity" && typeof it.stockQuantity === "number") {
    return Math.max(0, it.stockQuantity);
  }
  if (typeof it.stockLimit === "number") return Math.max(0, it.stockLimit);
  return Number.POSITIVE_INFINITY;
}

const STORAGE_KEY = "bitez:shared:inventory:v2";
const EVENT_NAME = "bitez:seller:inventory:change";
const SESSION_KEY = "bitez_seller_session";

function currentSellerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

function normalizeCategory(value: unknown): SellerCategory {
  return value === "Snacks" || value === "Drinks" ? value : "Food";
}

function fromProduct(row: any): SellerInventoryItem {
  return {
    id: row.id,
    sellerId: row.seller_id ?? null,
    name: row.product_name ?? "Untitled item",
    price: Number(row.price ?? 0),
    category: normalizeCategory(row.category),
    icon: row.emoji ?? "🍽️",
    iconLabel: row.category ?? "Food",
    status: row.is_active === false ? "Inactive" : "Active",
    createdAt: row.created_at ? (typeof row.created_at === 'string' ? new Date(row.created_at).getTime() : row.created_at) : Date.now(),
    stockLimit: row.stock_limit ?? null,
    availableUntil: row.available_until ?? null,
    inventoryType: (row.inventory_type as "none" | "quantity" | "time" | null) ?? "none",
    stockQuantity: row.stock_quantity ?? null,
    availableFrom: row.available_from ?? null,
    availableTo: row.available_to ?? null,
  };
}

function read(): SellerInventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SellerInventoryItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: SellerInventoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function upsertCache(incoming: SellerInventoryItem[], sellerId?: string | null) {
  const existing = read();
  const kept = sellerId ? existing.filter((it) => it.sellerId !== sellerId) : [];
  const nextById = new Map<string, SellerInventoryItem>();
  [...incoming, ...kept].forEach((it) => nextById.set(it.id, it));
  write(Array.from(nextById.values()));
}

export function getInventory(sellerId?: string | null): SellerInventoryItem[] {
  const rows = read();
  const scoped = sellerId ? rows.filter((it) => it.sellerId === sellerId) : rows;
  return scoped.sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadInventoryFromBackend(sellerId?: string | null): Promise<SellerInventoryItem[]> {
  try {
    let q: any;
    if (sellerId) {
      q = query(collection(db, "products"), where("seller_id", "==", sellerId));
    } else {
      q = query(collection(db, "products"));
    }
    const snap = await getDocs(q);
    const incoming = snap.docs.map((d) => fromProduct({ id: d.id, ...d.data() as any }));
    
    // Sort in-memory: created_at descending
    incoming.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    upsertCache(incoming, sellerId);
    return incoming;
  } catch (err) {
    console.warn("Firebase loadInventoryFromBackend failed, using local cache:", err);
    return getInventory(sellerId);
  }
}

export async function preloadInventoryForSellers(sellerIds: string[]): Promise<SellerInventoryItem[]> {
  const ids = Array.from(new Set(sellerIds.filter(Boolean)));
  if (ids.length === 0) return [];
  try {
    // Firestore "in" queries are limited to 30 items
    const q = query(
      collection(db, "products"),
      where("seller_id", "in", ids)
    );
    const snap = await getDocs(q);
    const incoming = snap.docs.map((d) => fromProduct({ id: d.id, ...d.data() as any }));
    
    // Sort in-memory: created_at descending
    incoming.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    const existing = read().filter((it) => it.sellerId && ids.includes(it.sellerId));
    write([...incoming, ...existing]);
    return incoming;
  } catch (err) {
    console.warn("Firebase preloadInventoryForSellers failed, using cache:", err);
    return getInventory().filter((it) => it.sellerId && ids.includes(it.sellerId));
  }
}

export async function addInventoryItem(
  item: Omit<SellerInventoryItem, "id" | "createdAt">,
): Promise<SellerInventoryItem> {
  const sellerId = item.sellerId ?? currentSellerId();
  const now = new Date().toISOString();
  
  const payload = {
    seller_id: sellerId,
    product_name: item.name,
    price: item.price,
    category: item.category,
    emoji: item.icon,
    is_active: item.status === "Active",
    created_at: now,
    stock_limit: item.stockLimit ?? null,
    available_until: item.availableUntil ?? null,
    inventory_type: item.inventoryType ?? "none",
    stock_quantity: item.stockQuantity ?? null,
    available_from: item.availableFrom ?? null,
    available_to: item.availableTo ?? null,
  };

  try {
    const docRef = await addDoc(collection(db, "products"), payload);
    const newItem = fromProduct({ id: docRef.id, ...payload });
    write([newItem, ...read().filter((it) => it.id !== docRef.id)]);
    return newItem;
  } catch (err: any) {
    throw new Error(err.message || "Failed to add product");
  }
}

export async function updateInventoryItem(
  id: string,
  patch: Partial<Omit<SellerInventoryItem, "id" | "createdAt">>,
) {
  const payload: Record<string, any> = {};
  if (patch.name !== undefined) payload.product_name = patch.name;
  if (patch.price !== undefined) payload.price = patch.price;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.icon !== undefined) payload.emoji = patch.icon;
  if (patch.status !== undefined) payload.is_active = patch.status === "Active";
  if (patch.stockLimit !== undefined) payload.stock_limit = patch.stockLimit;
  if (patch.availableUntil !== undefined) payload.available_until = patch.availableUntil;
  if (patch.inventoryType !== undefined) payload.inventory_type = patch.inventoryType;
  if (patch.stockQuantity !== undefined) payload.stock_quantity = patch.stockQuantity;
  if (patch.availableFrom !== undefined) payload.available_from = patch.availableFrom;
  if (patch.availableTo !== undefined) payload.available_to = patch.availableTo;

  try {
    const docRef = doc(db, "products", id);
    await updateDoc(docRef, payload);
    write(read().map((it) => (it.id === id ? { ...it, ...patch } : it)));
  } catch (err: any) {
    throw new Error(err.message || "Failed to update product");
  }
}

export async function setInventoryLimit(
  id: string,
  limits: { stockLimit?: number | null; availableUntil?: string | null },
) {
  await updateInventoryItem(id, limits);
}

export async function enforceTimeLimits(): Promise<void> {
  const now = Date.now();
  const expired = read().filter(
    (it) => it.status === "Active" && it.availableUntil && new Date(it.availableUntil).getTime() <= now,
  );
  for (const it of expired) {
    try {
      await updateInventoryItem(it.id, { status: "Inactive" });
    } catch {
      /* best effort */
    }
  }
}

export async function setInventoryStatus(id: string, status: SellerStatus) {
  await updateInventoryItem(id, { status });
}

export async function removeInventoryItem(id: string) {
  try {
    const docRef = doc(db, "products", id);
    await deleteDoc(docRef);
    write(read().filter((it) => it.id !== id));
  } catch (err: any) {
    throw new Error(err.message || "Failed to delete product");
  }
}

export function subscribeInventory(cb: () => void): () => void {
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

export function pruneInventoryByCanteens(validCanteenIds: string[]) {
  const valid = new Set(validCanteenIds);
  const items = read();
  const filtered = items.filter((it) => it.sellerId && valid.has(it.sellerId));
  if (filtered.length !== items.length) {
    write(filtered);
  }
}

let realtimeStarted = false;
let unsubscribeRealtime: (() => void) | null = null;

export function initInventoryRealtime(): () => void {
  if (typeof window === "undefined") return () => {};
  if (realtimeStarted) return unsubscribeRealtime || (() => {});
  realtimeStarted = true;

  const pruneCartFor = (itemId: string) => {
    try {
      getCart()
        .filter((c) => c.itemId === itemId)
        .forEach((c) => removeCartItem(c.itemId, c.canteenId));
    } catch {
      // best-effort
    }
  };

  const capCartFor = (it: SellerInventoryItem) => {
    try {
      const cap = maxPurchasableQty(it);
      if (!Number.isFinite(cap)) return;
      getCart()
        .filter((c) => c.itemId === it.id && c.qty > cap)
        .forEach((c) => {
          if (cap <= 0) removeCartItem(c.itemId, c.canteenId);
          else setCartQty(c.itemId, cap, c.canteenId);
        });
    } catch {
      // best-effort
    }
  };

  try {
    unsubscribeRealtime = onSnapshot(collection(db, "products"), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const row = { id, ...change.doc.data() };
        const next = fromProduct(row);

        if (change.type === "removed") {
          write(read().filter((it) => it.id !== id));
          pruneCartFor(id);
        } else {
          const existing = read();
          const found = existing.some((it) => it.id === id);
          write(found ? existing.map((it) => (it.id === id ? next : it)) : [next, ...existing]);
          if (!isItemAvailable(next)) pruneCartFor(id);
          else capCartFor(next);
        }
      });
    });
  } catch (err) {
    console.warn("Firebase onSnapshot subscription failed:", err);
  }

  return () => {
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
    }
    realtimeStarted = false;
  };
}