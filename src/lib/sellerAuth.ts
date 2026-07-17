import { auth, db } from "@/integrations/firebase/client";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { clearSellerScopedCaches } from "@/lib/sellerCaches";

const SESSION_KEY = "bitez_seller_session";
const LEGACY_SESSION_KEY = "bitez.seller.session.v1";
const SESSION_MAX_MS = 12 * 60 * 60 * 1000;

export type SellerSession = {
  id: string;
  username: string;
  name: string;
  email: string;
  canteen_name: string;
  timestamp: number;
};

export function getSellerSession(): SellerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SellerSession;
    if (!s?.id) return null;
    if (Date.now() - s.timestamp > SESSION_MAX_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearSellerSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
  clearSellerScopedCaches();
  try {
    auth.signOut();
  } catch { /* ignore */ }
}

export async function loginSeller(identifier: string, password: string): Promise<SellerSession> {
  const id = identifier.trim().toLowerCase();
  const email = `seller_${id}@bitez.local`;
  const fbPassword = `seller-${password}`;

  // 1. Sign in via Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, email, fbPassword);
  const authUid = userCredential.user.uid;

  // 2. Fetch profile from Firestore sellers collection
  const docRef = doc(db, "sellers", authUid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error("Seller profile not found");
  }

  const data = docSnap.data();
  if (data.is_suspended) {
    throw new Error("Your account has been suspended. Contact admin.");
  }
  if (data.is_active === false) {
    throw new Error("Account is inactive");
  }

  const seller = {
    id: authUid,
    username: data.username || id,
    name: data.name || "",
    email: data.email || "",
    canteen_name: data.canteen_name || "",
  };

  try {
    const prevRaw = localStorage.getItem(SESSION_KEY);
    const prev = prevRaw ? (JSON.parse(prevRaw) as { id?: string }) : null;
    if (!prev?.id || prev.id !== seller.id) clearSellerScopedCaches();
  } catch {
    clearSellerScopedCaches();
  }

  const session: SellerSession = {
    id: seller.id,
    username: seller.username ?? "",
    name: seller.name ?? "",
    email: seller.email ?? "",
    canteen_name: seller.canteen_name ?? "",
    timestamp: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return session;
}