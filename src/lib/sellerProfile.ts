import { db } from "@/integrations/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export type SellerProfile = {
  id: string;
  canteenName: string;
  slogan: string;
  ownerPhone: string;
  icon: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
};

const STORAGE_KEY = "bitez.seller.profile";
const CANTEENS_STORAGE_KEY = "bitez:shared:canteens:v1";
const EVENT = "bitez:seller:profile:change";
const DEFAULT_ID = "main";
const SESSION_KEY = "bitez_seller_session";

const empty: SellerProfile = {
  id: DEFAULT_ID,
  canteenName: "",
  slogan: "",
  ownerPhone: "",
  icon: "🍽️",
  accountNumber: "",
  ifsc: "",
  upiId: "",
};

export function getProfile(): SellerProfile {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Partial<SellerProfile>), id: DEFAULT_ID };
  } catch {
    return empty;
  }
}

export function saveProfile(p: Omit<SellerProfile, "id">): SellerProfile {
  const next: SellerProfile = { ...p, id: DEFAULT_ID };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore */
  }
  return next;
}

export function isProfileComplete(p: SellerProfile): boolean {
  return Boolean(
    p.canteenName.trim() &&
      p.slogan.trim() &&
      p.ownerPhone.trim() &&
      p.accountNumber.trim() &&
      p.ifsc.trim() &&
      p.upiId.trim(),
  );
}

export function getRegisteredCanteens(): SellerProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CANTEENS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SellerProfile[]) : [];
  } catch {
    return [];
  }
}

function writeProfile(p: SellerProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function writeCanteens(rows: SellerProfile[]) {
  if (typeof window === "undefined") return;
  try {
    const prev = window.localStorage.getItem(CANTEENS_STORAGE_KEY);
    const next = JSON.stringify(rows);
    if (prev === next) return;
    window.localStorage.setItem(CANTEENS_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent("bitez:shared:canteens:change"));
  } catch {
    /* ignore */
  }
}

function fromSeller(row: any): SellerProfile {
  const rawIcon = String(row.canteen_type ?? "").trim();
  const icon = /^\p{Extended_Pictographic}/u.test(rawIcon) ? rawIcon : "🍽️";
  return {
    id: row.id,
    canteenName: row.canteen_name ?? "Canteen",
    slogan: row.canteen_location ?? row.canteen_type ?? "Open now",
    ownerPhone: row.phone ?? "",
    icon,
    accountNumber: row.bank_account_number ?? "",
    ifsc: row.bank_ifsc ?? "",
    upiId: row.upi_id ?? "",
  };
}

export async function getRegisteredCanteensFromBackend(): Promise<SellerProfile[]> {
  try {
    const snap = await getDocs(collection(db, "sellers"));
    const allSellers = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
    
    // Filter in-memory: active and not suspended
    const filtered = allSellers.filter(
      (row) => row.is_active === true && row.is_suspended === false
    );
    
    // Sort in-memory: canteen_name ascending
    filtered.sort((a, b) => {
      const nameA = (a.canteen_name || "").toLowerCase();
      const nameB = (b.canteen_name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const rows = filtered.map((row) => fromSeller(row));
    writeCanteens(rows);
    return rows;
  } catch (err) {
    console.warn("Firebase getRegisteredCanteensFromBackend failed, using local cache:", err);
    return getRegisteredCanteens();
  }
}

export async function loadCurrentSellerProfile(): Promise<SellerProfile> {
  if (typeof window === "undefined") return empty;
  const raw = window.localStorage.getItem(SESSION_KEY);
  const session = raw ? (JSON.parse(raw) as { id?: string }) : null;
  if (!session?.id) return empty;

  try {
    const docRef = doc(db, "sellers", session.id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const profile = fromSeller({ id: docSnap.id, ...docSnap.data() });
      writeProfile(profile);
      return profile;
    }
    return empty;
  } catch (err) {
    console.warn("Firebase loadCurrentSellerProfile failed:", err);
    return getProfile();
  }
}

export async function saveProfileToBackend(p: Omit<SellerProfile, "id">): Promise<SellerProfile> {
  if (typeof window === "undefined") return { ...p, id: DEFAULT_ID };
  const raw = window.localStorage.getItem(SESSION_KEY);
  const session = raw ? (JSON.parse(raw) as { id?: string }) : null;
  if (!session?.id) return saveProfile(p);

  const payload = {
    canteen_name: p.canteenName,
    canteen_location: p.slogan,
    canteen_type: p.icon,
    phone: p.ownerPhone,
    bank_account_number: p.accountNumber,
    bank_ifsc: p.ifsc,
    upi_id: p.upiId,
  };

  try {
    const docRef = doc(db, "sellers", session.id);
    await updateDoc(docRef, payload);
    const next = fromSeller({ id: session.id, ...payload });
    writeProfile(next);
    return next;
  } catch (err) {
    console.warn("Firebase saveProfileToBackend failed, updating locally:", err);
    return saveProfile(p);
  }
}

export function subscribeProfile(cb: () => void): () => void {
  const onLocal = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener(EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

export function subscribeCanteens(cb: () => void): () => void {
  const onLocal = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === CANTEENS_STORAGE_KEY) cb();
  };
  window.addEventListener("bitez:shared:canteens:change", onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("bitez:shared:canteens:change", onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

let canteensRealtimeStarted = false;
let unsubscribeCanteensRealtime: (() => void) | null = null;

export function initCanteensRealtime(): () => void {
  if (typeof window === "undefined") return () => {};
  if (canteensRealtimeStarted) return unsubscribeCanteensRealtime || (() => {});
  canteensRealtimeStarted = true;

  try {
    unsubscribeCanteensRealtime = onSnapshot(collection(db, "sellers"), (snapshot) => {
      const allSellers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
      
      // Filter in-memory: active and not suspended
      const filtered = allSellers.filter(
        (row) => row.is_active === true && row.is_suspended === false
      );
      
      // Sort in-memory: canteen_name ascending
      filtered.sort((a, b) => {
        const nameA = (a.canteen_name || "").toLowerCase();
        const nameB = (b.canteen_name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

      const rows = filtered.map((row) => fromSeller(row));
      writeCanteens(rows);

      // Trigger automatic cache pruning dynamically to prevent circular dependencies
      const ids = rows.map((r) => r.id);
      import("./userCart").then(({ pruneCartByCanteens }) => pruneCartByCanteens(ids)).catch(() => null);
      import("./sellerInventory").then(({ pruneInventoryByCanteens }) => pruneInventoryByCanteens(ids)).catch(() => null);
    }, (err) => {
      console.warn("Firebase sellers onSnapshot subscription failed:", err);
    });
  } catch (err) {
    console.warn("Firebase sellers onSnapshot subscription failed:", err);
  }

  return () => {
    if (unsubscribeCanteensRealtime) {
      unsubscribeCanteensRealtime();
      unsubscribeCanteensRealtime = null;
    }
    canteensRealtimeStarted = false;
  };
}