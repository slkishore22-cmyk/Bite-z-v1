import { auth, db } from "@/integrations/firebase/client";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, addDoc, doc, getDoc, setDoc, getDocFromServer } from "firebase/firestore";
import {
  getAdminSession,
  saveAdminSession,
  clearAdminSession,
} from "@/utils/sessionManager";

const LEGACY_SESSION_KEY = "ma_session_v1";

export type MaSession = {
  role: "master_admin";
  authenticated: true;
  username: string;
  timestamp: number;
};

export function getSession(): MaSession | null {
  try { localStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* ignore */ }
  const s = getAdminSession();
  if (!s) return null;
  return {
    role: "master_admin",
    authenticated: true,
    username: s.username || "",
    timestamp: s.savedAt || Date.now(),
  };
}

export function setSession(username: string) {
  saveAdminSession({ username });
}

export function clearSession() {
  try { localStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* ignore */ }
  clearAdminSession();
  try { auth.signOut(); } catch { /* ignore */ }
}

export async function loginMasterAdmin(usernameOrEmail: string, password: string) {
  let input = usernameOrEmail.trim().toLowerCase();
  let email = input;
  
  if (!email.includes("@")) {
    let u = input;
    if (u.startsWith("admin_")) {
      u = u.substring(6);
    }
    email = `admin_${u}@bitez.local`;
  }
  
  // Try logging in with the prefixed password first for legacy bitez.local users
  let prefixedPassword = password;
  if (email.endsWith("@bitez.local")) {
    let p = password;
    if (p.startsWith("admin-")) {
      p = p.substring(6);
    }
    prefixedPassword = `admin-${p}`;
  }
  
  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, email, prefixedPassword);
  } catch (err: any) {
    if (email.endsWith("@bitez.local") && (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.message?.includes("invalid-credential"))) {
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    } else {
      throw err;
    }
  }

  // Verification step: Check if the user document exists in firestore and has is_approved = true
  if (userCredential && userCredential.user) {
    const uid = userCredential.user.uid;
    const adminDocRef = doc(db, "admins", uid);
    let adminDoc;
    try {
      adminDoc = await getDocFromServer(adminDocRef);
    } catch (e) {
      adminDoc = await getDoc(adminDocRef);
    }

    const isApproved = adminDoc.exists() && adminDoc.data()?.is_approved === true;

    if (!isApproved) {
      await auth.signOut();
      throw new Error("Access pending developer approval. Please contact the administrator.");
    }
  }

  return true;
}

export async function signUpMasterAdmin(
  emailInput: string,
  passwordInput: string,
  collegeName: string,
  departmentName: string,
  departmentNumber: string
) {
  const email = emailInput.trim().toLowerCase();

  // 1. Create auth user
  const userCredential = await createUserWithEmailAndPassword(auth, email, passwordInput);
  const uid = userCredential.user.uid;

  // 2. Save document in Firestore "admins" collection
  const approvedVal = false;

  const adminDocRef = doc(db, "admins", uid);
  await setDoc(adminDocRef, {
    uid,
    email,
    college_name: collegeName.trim(),
    department_name: departmentName.trim(),
    department_number: departmentNumber.trim(),
    is_approved: approvedVal,
    created_at: new Date().toISOString()
  });

  // 3. Immediately sign out newly created user to prevent auto-login
  await auth.signOut();
  return true;
}

export async function logAudit(
  action_type: string,
  target?: string,
  details?: Record<string, unknown>,
) {
  try {
    const s = getSession();
    if (!s?.username) return;

    await addDoc(collection(db, "audit_logs"), {
      username: s.username,
      action_type,
      target: target ?? null,
      details: details ?? null,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn("Firebase logAudit failed:", err);
  }
}