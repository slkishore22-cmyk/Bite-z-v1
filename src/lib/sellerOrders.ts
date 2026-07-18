/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/integrations/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  orderBy,
  limit,
  addDoc,
  runTransaction,
  writeBatch,
} from "firebase/firestore";

import type { SellerCategory } from "./sellerInventory";

export type OrderItem = {
  itemId: string;
  name: string;
  icon: string;
  category: SellerCategory;
  price: number;
  qty: number;
  canteenId?: string;
  canteenIcon?: string;
};

export type OrderStatus = "Pending" | "Completed" | "Cancelled" | "Expired" | "preparing" | "pending" | "confirmed" | "completed" | "delivered";
export type PaymentMethod = "Online" | "Cash";

export type Order = {
  id: string;          // short readable id, e.g. 2299
  uid: string;         // unique storage id
  createdAt: number;
  completedAt?: number;
  expiresAt?: number | null; // COD only; null/undefined for Online
  payment: PaymentMethod;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  total: number;
  sellerId?: string | null;
  sellerName?: string | null;
  sellerIcon?: string | null;
  appUserId?: string | null;
  paymentStatus?: "PENDING" | "SUCCESS" | "FAILED";
  isSoundPlayed?: boolean;
  isSalesRecorded?: boolean;
};

const STORAGE_KEY = "bitez:orders";
const EVENT_NAME = "bitez:orders:change";
const ID_COUNTER_KEY = "bitez:orders:counter";
const SHORT_ID_MIN = 1000;
const SHORT_ID_RANGE = 9000;

export const CASH_ORDER_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}00000000-0000-4000-8000-000000000000`.slice(0, 36);
}

function read(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Order[]) : [];
  } catch {
    return [];
  }
}

function write(items: Order[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("bitez_user_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

function nextShortId(): string {
  if (typeof window === "undefined") return "1000";
  const existing = new Set(read().map((o) => o.id));
  const raw = window.localStorage.getItem(ID_COUNTER_KEY);
  let n = raw ? parseInt(raw, 10) || SHORT_ID_MIN : SHORT_ID_MIN;
  for (let i = 0; i < SHORT_ID_RANGE; i += 1) {
    n = n >= 9999 ? SHORT_ID_MIN : n + 1;
    const candidate = String(n);
    if (!existing.has(candidate)) {
      window.localStorage.setItem(ID_COUNTER_KEY, candidate);
      return candidate;
    }
  }
  const fallback = String(Date.now()).slice(-6);
  window.localStorage.setItem(ID_COUNTER_KEY, fallback);
  return fallback;
}

export function getOrders(): Order[] {
  expireStaleCashOrders();
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadOrdersFromBackend(
  sellerId?: string | null,
  userId = getCurrentUserId(),
  opts: { sinceMs?: number; limit?: number; merge?: boolean } = {},
): Promise<Order[]> {
  try {
    let q: any;

    if (sellerId) {
      q = query(
        collection(db, "orders"),
        where("sellerId", "==", sellerId)
      );
    } else if (userId) {
      q = query(
        collection(db, "orders"),
        where("appUserId", "==", userId)
      );
    } else {
      q = query(
        collection(db, "orders")
      );
    }

    const snap = await getDocs(q);
    let fetched: Order[] = snap.docs.map((doc) => {
      const data = doc.data() as any;
      const rawDate = data.createdAt || data.created_at;
      const createdAt = rawDate ? (typeof rawDate === "number" ? rawDate : new Date(rawDate).getTime()) : Date.now();
      const rawCompleted = data.completedAt || data.completed_at;
      const completedAt = rawCompleted ? (typeof rawCompleted === "number" ? rawCompleted : new Date(rawCompleted).getTime()) : undefined;
      const rawPayment = data.payment || (data.notes ? (JSON.parse(data.notes || "{}")?.payment_method === 'online' ? 'Online' : 'Cash') : 'Cash');
      const payment = rawPayment === "online" || rawPayment === "Online" ? "Online" : "Cash";

      return {
        id: data.id || data.order_number || doc.id.slice(0, 8),
        uid: doc.id,
        createdAt,
        completedAt,
        expiresAt: data.expiresAt,
        payment,
        status: data.status || "Pending",
        items: data.items || [],
        subtotal: data.subtotal || 0,
        total: data.total || 0,
        sellerId: data.sellerId || data.seller_id,
        sellerName: data.sellerName || data.seller_name,
        sellerIcon: data.sellerIcon || data.seller_icon,
        appUserId: data.appUserId || data.app_user_id,
        paymentStatus: data.paymentStatus || data.payment_status || "PENDING",
        isSoundPlayed: data.isSoundPlayed || data.is_sound_played || false,
        isSalesRecorded: data.isSalesRecorded || data.is_sales_recorded || false,
      };
    });

    // Sort in-memory: createdAt descending
    fetched.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit manually
    fetched = fetched.slice(0, opts.limit ?? 200);

    if (opts.merge) {
      const fetchedUids = new Set(fetched.map((o) => o.uid));
      const kept = read().filter((o) => !fetchedUids.has(o.uid));
      const merged = [...fetched, ...kept].sort((a, b) => b.createdAt - a.createdAt);
      write(merged);
      return merged;
    }
    write(fetched);
    return fetched;
  } catch (err) {
    console.error("Error loading Firebase orders:", err);
    return read();
  }
}

export function getOrderById(id: string): Order | undefined {
  return read().find((o) => o.id === id || o.uid === id);
}

export async function createOrder(
  payload: Omit<Order, "id" | "uid" | "createdAt" | "status" | "subtotal" | "total"> & {
    subtotal?: number;
    total?: number;
  },
): Promise<Order> {
  const subtotal =
    payload.subtotal ??
    payload.items.reduce((s, i) => s + i.price * i.qty, 0);
  const total = payload.total ?? subtotal;

  const sellerId = payload.items.find((i) => i.canteenId)?.canteenId ?? null;
  const sellerIcon = payload.items.find((i) => i.canteenIcon)?.canteenIcon ?? null;
  const userId = getCurrentUserId();
  const now = Date.now();
  const isOnlineSuccess = payload.payment === "Online" && payload.paymentStatus === "SUCCESS";
  const expiresAt = payload.payment === "Cash" ? now + CASH_ORDER_TTL_MS : null;
  
  const order: Order = {
    id: nextShortId(),
    uid: uuid(),
    createdAt: now,
    status: "Pending",
    expiresAt,
    payment: payload.payment,
    paymentStatus: payload.paymentStatus ?? "PENDING",
    isSoundPlayed: Boolean(payload.isSoundPlayed),
    isSalesRecorded: isOnlineSuccess,
    items: payload.items,
    subtotal,
    total,
    sellerId,
    sellerName: payload.sellerName ?? null,
    sellerIcon,
    appUserId: userId,
  };

  try {
    await setDoc(doc(db, "orders", order.uid), order);
    write([order, ...read()]);
    return order;
  } catch (err: any) {
    throw new Error(err.message || "Failed to create order");
  }
}

export function createOrderOptimistic(
  payload: Omit<Order, "id" | "uid" | "createdAt" | "status" | "subtotal" | "total"> & {
    subtotal?: number;
    total?: number;
  },
): Order {
  const subtotal =
    payload.subtotal ??
    payload.items.reduce((s, i) => s + i.price * i.qty, 0);
  const total = payload.total ?? subtotal;
  const sellerId = payload.items.find((i) => i.canteenId)?.canteenId ?? null;
  const sellerIcon = payload.items.find((i) => i.canteenIcon)?.canteenIcon ?? null;
  const userId = getCurrentUserId();
  const now = Date.now();
  const isOnlineSuccess = payload.payment === "Online" && payload.paymentStatus === "SUCCESS";
  const expiresAt = payload.payment === "Cash" ? now + CASH_ORDER_TTL_MS : null;
  
  const order: Order = {
    id: nextShortId(),
    uid: uuid(),
    createdAt: now,
    status: "Pending",
    expiresAt,
    payment: payload.payment,
    paymentStatus: payload.paymentStatus ?? "PENDING",
    isSoundPlayed: Boolean(payload.isSoundPlayed),
    isSalesRecorded: isOnlineSuccess,
    items: payload.items,
    subtotal,
    total,
    sellerId,
    sellerName: payload.sellerName ?? null,
    sellerIcon,
    appUserId: userId,
  };

  // 1) Write to local storage immediately so client redirects fast.
  write([order, ...read()]);

  // 2) Write in background.
  const persist = async (attempt: number) => {
    try {
      await setDoc(doc(db, "orders", order.uid), order);
    } catch (e) {
      if (attempt < 3) setTimeout(() => persist(attempt + 1), 1500 * attempt);
    }
  };
  persist(1);

  return order;
}

export function saveOrderLocally(order: Order) {
  write([order, ...read()]);
}

export async function recordSalesAndSpend(order: Order) {
  const uid = order.uid || (order as any).id || (order as any).uid;

  try {
    // 0. Double check in Firestore first to avoid duplicate recording
    const orderDocRef = doc(db, "orders", uid);
    const orderSnap = await getDoc(orderDocRef);
    if (orderSnap.exists()) {
      const dbOrder = orderSnap.data() as any;
      if (dbOrder.isSalesRecorded || dbOrder.is_sales_recorded) {
        return; // Already recorded in database, skip
      }
    }

    const rawDate = order.createdAt || (order as any).created_at || (order as any).createdAt || Date.now();
    const dateObj = typeof rawDate === "number" ? new Date(rawDate) : new Date(String(rawDate));
    const todayStr = isNaN(dateObj.getTime()) ? new Date().toISOString().slice(0, 10) : dateObj.toISOString().slice(0, 10);
    const sellerId = order.sellerId || (order as any).seller_id || (order as any).sellerId;
    const total = order.total || (order as any).total || 0;
    const appUserId = order.appUserId || (order as any).app_user_id || (order as any).appUserId;
    const rawPayment = order.payment || (order as any).payment_method || (order as any).payment;
    const payment = rawPayment === "online" || rawPayment === "Online" ? "Online" : "Cash";

    // 1. Record User Spend
    if (appUserId) {
      const spendPayload = {
        user_id: appUserId,
        order_id: uid,
        amount: total,
        payment_method: payment,
        product_names: order.items.map((i) => i.name),
        created_at: isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString(),
        seller_id: sellerId || null,
      };
      await addDoc(collection(db, "user_spend"), spendPayload);
    }

    // 2 & 3. Record Seller Sales & Update products metrics in ONE atomic transaction
    if (sellerId) {
      const salesDocId = `${sellerId}_${todayStr}`;
      const salesDocRef = doc(db, "seller_sales", salesDocId);

      await runTransaction(db, async (transaction) => {
        // Double-check inside transaction for absolute safety against concurrent requests
        const orderSnapTx = await transaction.get(orderDocRef);
        if (orderSnapTx.exists()) {
          const dbOrderTx = orderSnapTx.data() as any;
          if (dbOrderTx.isSalesRecorded || dbOrderTx.is_sales_recorded) {
            return;
          }
        }

        // Reads
        const salesSnap = await transaction.get(salesDocRef);
        
        const prodDataList: { ref: any; currentSold: number; currentRevenue: number; itemQty: number; itemPrice: number }[] = [];
        for (const item of order.items) {
          if (item.itemId) {
            const prodDocRef = doc(db, "products", item.itemId);
            const prodSnap = await transaction.get(prodDocRef);
            if (prodSnap.exists()) {
              const pData = prodSnap.data() as any;
              prodDataList.push({
                ref: prodDocRef,
                currentSold: pData.total_sold || 0,
                currentRevenue: pData.total_revenue || 0,
                itemQty: item.qty,
                itemPrice: item.price
              });
            }
          }
        }

        // Writes
        if (salesSnap.exists()) {
          const currentData = salesSnap.data() as any;
          transaction.update(salesDocRef, {
            total_orders: (currentData.total_orders || 0) + 1,
            total_revenue: (currentData.total_revenue || 0) + total,
          });
        } else {
          transaction.set(salesDocRef, {
            seller_id: sellerId,
            date: todayStr,
            total_orders: 1,
            total_revenue: total,
          });
        }

        for (const prod of prodDataList) {
          transaction.update(prod.ref, {
            total_sold: prod.currentSold + prod.itemQty,
            total_revenue: prod.currentRevenue + (prod.itemPrice * prod.itemQty),
            last_sold_at: new Date().toISOString(),
          });
        }

        // Update the order itself to mark isSalesRecorded: true inside the transaction
        transaction.update(orderDocRef, {
          isSalesRecorded: true,
        });
      });
    } else {
      // If no sellerId, still mark order as recorded
      await updateDoc(orderDocRef, {
        isSalesRecorded: true,
      });
    }
  } catch (err) {
    console.warn("Failed to record sales and spend details:", err);
  }
}

export async function setOrderStatus(uidOrId: string, status: OrderStatus, notes?: string) {
  let target = read().find((o) => o.uid === uidOrId || o.id === uidOrId);

  if (!target) {
    try {
      const docRef = doc(db, "orders", uidOrId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const d = docSnap.data() as any;
        target = {
          id: d.id || docSnap.id.slice(0, 8),
          uid: docSnap.id,
          createdAt: d.createdAt || Date.now(),
          completedAt: d.completedAt,
          expiresAt: d.expiresAt,
          payment: d.payment || "Cash",
          status: d.status || "Pending",
          items: d.items || [],
          subtotal: d.subtotal || 0,
          total: d.total || 0,
          sellerId: d.sellerId,
          sellerName: d.sellerName,
          sellerIcon: d.sellerIcon,
          appUserId: d.appUserId,
          paymentStatus: d.paymentStatus || "PENDING",
          isSoundPlayed: d.isSoundPlayed || false,
          isSalesRecorded: d.isSalesRecorded || false,
        };
      } else {
        const q = query(
          collection(db, "orders"),
          where("order_number", "==", uidOrId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const d = docSnap.data() as any;
          target = {
            id: d.id || docSnap.id.slice(0, 8),
            uid: docSnap.id,
            createdAt: d.createdAt || Date.now(),
            completedAt: d.completedAt,
            expiresAt: d.expiresAt,
            payment: d.payment || "Cash",
            status: d.status || "Pending",
            items: d.items || [],
            subtotal: d.subtotal || 0,
            total: d.total || 0,
            sellerId: d.sellerId,
            sellerName: d.sellerName,
            sellerIcon: d.sellerIcon,
            appUserId: d.appUserId,
            paymentStatus: d.paymentStatus || "PENDING",
            isSoundPlayed: d.isSoundPlayed || false,
            isSalesRecorded: d.isSalesRecorded || false,
          };
        }
      }
    } catch (err) {
      console.warn("setOrderStatus Firestore fallback lookup failed:", err);
    }
  }

  if (!target) {
    console.error("setOrderStatus failed: Order not found in local cache or Firestore:", uidOrId);
    return;
  }

  const completedAt = status === "Completed" ? target.completedAt ?? Date.now() : target.completedAt;
  const isSalesRecorded = target.isSalesRecorded || false;

  const updatedOrder = {
    ...target,
    status,
    completedAt,
    isSalesRecorded: isSalesRecorded,
    ...(notes !== undefined ? { notes } : {})
  };

  try {
    const docRef = doc(db, "orders", target.uid);
    const updatePayload: any = {
      status,
      completedAt: completedAt || null,
      isSalesRecorded: isSalesRecorded
    };
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }
    await updateDoc(docRef, updatePayload);

    const next = read().map((o) =>
      o.uid === target.uid ? updatedOrder : o
    );
    // If it wasn't in local storage, add it
    if (!read().some((o) => o.uid === target.uid)) {
      write([updatedOrder, ...read()]);
    } else {
      write(next);
    }

    // Sync metrics when order is Completed or confirmed
    if (status === "Completed" || status === "confirmed") {
      recordSalesAndSpend(updatedOrder).catch((err) => {
        console.warn("Error running recordSalesAndSpend background task:", err);
      });
    }
  } catch (err) {
    console.error("Error setting Firebase order status:", err);
    // Optimistic fallback update locally anyway
    const next = read().map((o) =>
      o.uid === target.uid ? updatedOrder : o
    );
    write(next);
  }
}

export function subscribeOrders(cb: () => void): () => void {
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

const SOUND_PLAYED_KEY = "bitez:orders:soundPlayed";

function readSoundPlayedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SOUND_PLAYED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function hasSoundPlayed(orderUidOrId: string): boolean {
  if (readSoundPlayedSet().has(orderUidOrId)) return true;
  return read().some((o) => (o.uid === orderUidOrId || o.id === orderUidOrId) && o.isSoundPlayed === true);
}

export function markSoundPlayed(orderUidOrId: string) {
  if (typeof window === "undefined") return;
  const set = readSoundPlayedSet();
  set.add(orderUidOrId);
  window.localStorage.setItem(SOUND_PLAYED_KEY, JSON.stringify([...set]));
  
  let updatedOrder: Order | undefined;
  const all = read().map((o) => {
    if (o.uid !== orderUidOrId && o.id !== orderUidOrId) return o;
    updatedOrder = { ...o, isSoundPlayed: true, paymentStatus: "SUCCESS" as const };
    return updatedOrder;
  });
  write(all);

  if (updatedOrder) {
    const docRef = doc(db, "orders", updatedOrder.uid);
    updateDoc(docRef, {
      isSoundPlayed: true,
      paymentStatus: "SUCCESS"
    }).catch(() => undefined);
  }
}

export function expireStaleCashOrders(): Order[] {
  if (typeof window === "undefined") return [];
  const now = Date.now();
  const all = read();
  const stale = all.filter(
    (o) =>
      o.payment === "Cash" &&
      (o.status || "").toLowerCase() === "pending" &&
      now - o.createdAt >= CASH_ORDER_TTL_MS,
  );
  if (stale.length === 0) return [];
  const staleIds = new Set(stale.map((o) => o.uid));
  const next = all.map((o) =>
    staleIds.has(o.uid) ? { ...o, status: "Expired" as const } : o,
  );
  write(next);
  
  stale.forEach((o) => {
    const docRef = doc(db, "orders", o.uid);
    updateDoc(docRef, { status: "Expired" }).catch(() => undefined);
  });
  return stale;
}

export const pruneExpiredCashOrders = expireStaleCashOrders;

export function nextCashExpiryDelayMs(): number | null {
  const now = Date.now();
  const pending = read().filter(
    (o) => o.payment === "Cash" && (o.status || "").toLowerCase() === "pending",
  );
  if (pending.length === 0) return null;
  const soonest = Math.min(
    ...pending.map((o) => o.createdAt + CASH_ORDER_TTL_MS - now),
  );
  return Math.max(0, soonest);
}

if (typeof window !== "undefined") {
  const w = window as unknown as { __bitezCashExpiryTimer?: number };
  const schedule = () => {
    if (w.__bitezCashExpiryTimer) {
      window.clearTimeout(w.__bitezCashExpiryTimer);
    }
    const delay = nextCashExpiryDelayMs();
    if (delay == null) {
      w.__bitezCashExpiryTimer = window.setTimeout(schedule, 60_000);
      return;
    }
    w.__bitezCashExpiryTimer = window.setTimeout(() => {
      expireStaleCashOrders();
      schedule();
    }, Math.min(delay + 250, 2 ** 31 - 1));
  };
  expireStaleCashOrders();
  schedule();
  window.addEventListener(EVENT_NAME, schedule);
}