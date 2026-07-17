import { db } from "@/integrations/firebase/client";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

// Shared store for seller-created offers. Backend is the source of truth so
// offers created by sellers are visible to users on every device/session.

export type OfferKind = "general" | "inventory";

export type SellerOffer = {
  id: string;
  sellerId: string | null;
  kind: OfferKind;
  name: string;
  discountPct: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  condition: string;
  itemIds: string[]; // for inventory offers
  createdAt: number;
};

const STORAGE_KEY = "bitez:seller:offers";
const EVENT_NAME = "bitez:seller:offers:change";

function normalizeKind(value: unknown): OfferKind {
  return value === "inventory" ? "inventory" : "general";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): SellerOffer {
  return {
    id: String(row.id),
    sellerId: row.seller_id ?? null,
    kind: normalizeKind(row.kind),
    name: row.name ?? "Offer",
    discountPct: Number(row.discount_pct ?? 0),
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    condition: row.condition ?? "",
    itemIds: Array.isArray(row.item_ids) ? row.item_ids : [],
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function read(): SellerOffer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SellerOffer[]) : [];
  } catch {
    return [];
  }
}

function write(items: SellerOffer[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function upsertCache(incoming: SellerOffer[], sellerId?: string | null) {
  const existing = read();
  const kept = sellerId ? existing.filter((o) => o.sellerId !== sellerId) : [];
  const nextById = new Map<string, SellerOffer>();
  [...incoming, ...kept].forEach((offer) => nextById.set(offer.id, offer));
  write(Array.from(nextById.values()));
}

function toDbRow(offer: SellerOffer, keepId = false) {
  return {
    ...(keepId ? { id: offer.id } : {}),
    seller_id: offer.sellerId,
    kind: offer.kind,
    name: offer.name,
    discount_pct: offer.discountPct,
    start_date: offer.startDate || null,
    end_date: offer.endDate || null,
    condition: offer.condition,
    item_ids: offer.itemIds,
    is_active: true,
    created_at: new Date(offer.createdAt).toISOString()
  };
}

export function getOffers(): SellerOffer[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export async function migrateCachedOffersToBackend(sellerId?: string | null): Promise<void> {
  if (!sellerId) return;
  const cached = read().filter((o) => o.sellerId === sellerId);
  if (cached.length === 0) return;
  
  const rows: SellerOffer[] = [];
  try {
    for (const offer of cached) {
      const offerId = offer.id && offer.id.includes("-") ? offer.id : doc(collection(db, "seller_offers")).id;
      const docRef = doc(db, "seller_offers", offerId);
      const offerWithId = { ...offer, id: offerId };
      await setDoc(docRef, toDbRow(offerWithId, true));
      rows.push(offerWithId);
    }
    if (rows.length > 0) upsertCache(rows, sellerId);
  } catch (err) {
    console.error("Failed to migrate cached offers to Firestore:", err);
  }
}

export async function loadOffersFromBackend(sellerId?: string | null): Promise<SellerOffer[]> {
  try {
    let q: any;
    if (sellerId) {
      q = query(
        collection(db, "seller_offers"),
        where("seller_id", "==", sellerId),
        where("is_active", "==", true)
      );
    } else {
      q = query(
        collection(db, "seller_offers"),
        where("is_active", "==", true)
      );
    }
    const snap = await getDocs(q);
    const incoming = snap.docs.map((d) => fromRow({ id: d.id, ...d.data() as any }));
    
    // Sort in-memory: created_at descending
    incoming.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    upsertCache(incoming, sellerId);
    return incoming;
  } catch (err) {
    console.warn("Failed to load offers from Firestore:", err);
    return getOffers().filter((o) => !sellerId || o.sellerId === sellerId);
  }
}

export function getActiveOffers(now = Date.now()): SellerOffer[] {
  return getOffers().filter((o) => {
    const start = o.startDate ? new Date(o.startDate + "T00:00:00").getTime() : -Infinity;
    const end = o.endDate ? new Date(o.endDate + "T23:59:59").getTime() : Infinity;
    return now >= start && now <= end;
  });
}

/** Return the highest active general-offer % for a given seller (0 if none). */
export function getActiveDiscountPctForSeller(sellerId?: string | null, now = Date.now()): number {
  if (!sellerId) return 0;
  const pct = getActiveOffers(now)
    .filter((o) => o.kind === "general" && o.sellerId === sellerId)
    .reduce((max, o) => Math.max(max, Number(o.discountPct) || 0), 0);
  return Math.max(0, Math.min(100, pct));
}

export function getActiveOfferForSeller(sellerId?: string | null, now = Date.now()): SellerOffer | null {
  if (!sellerId) return null;
  const list = getActiveOffers(now)
    .filter((o) => o.kind === "general" && o.sellerId === sellerId)
    .sort((a, b) => b.discountPct - a.discountPct);
  return list[0] ?? null;
}

export async function addOffer(input: Omit<SellerOffer, "id" | "createdAt">): Promise<SellerOffer> {
  const newDocRef = doc(collection(db, "seller_offers"));
  const newId = newDocRef.id;
  const newOffer = { ...input, id: newId, createdAt: Date.now() };

  await setDoc(newDocRef, toDbRow(newOffer, true));
  write([newOffer, ...read().filter((o) => o.id !== newId)]);
  return newOffer;
}

export async function updateOffer(id: string, patch: Partial<Omit<SellerOffer, "id" | "createdAt">>) {
  const payload: Record<string, unknown> = {};
  if (patch.sellerId !== undefined) payload.seller_id = patch.sellerId;
  if (patch.kind !== undefined) payload.kind = patch.kind;
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.discountPct !== undefined) payload.discount_pct = patch.discountPct;
  if (patch.startDate !== undefined) payload.start_date = patch.startDate || null;
  if (patch.endDate !== undefined) payload.end_date = patch.endDate || null;
  if (patch.condition !== undefined) payload.condition = patch.condition;
  if (patch.itemIds !== undefined) payload.item_ids = patch.itemIds;

  await updateDoc(doc(db, "seller_offers", id), payload);
  write(read().map((o) => (o.id === id ? { ...o, ...patch } : o)));
}

export async function removeOffer(id: string) {
  await deleteDoc(doc(db, "seller_offers", id));
  write(read().filter((o) => o.id !== id));
}

export function subscribeOffers(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };

  const q = query(collection(db, "seller_offers"), where("is_active", "==", true));
  const unsubRealtime = onSnapshot(q, () => {
    loadOffersFromBackend().then(cb).catch(() => cb());
  }, (err) => {
    console.error("Firestore subscribeOffers failed:", err);
  });

  window.addEventListener(EVENT_NAME, onLocal as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onLocal as EventListener);
    window.removeEventListener("storage", onStorage);
    unsubRealtime();
  };
}

