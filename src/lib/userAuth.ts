import { auth, db } from "@/integrations/firebase/client";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import {
  saveUserSession,
  clearUserSession,
  getUserSession,
} from "@/utils/sessionManager";

const USERID_KEY = "bitez_user_id";
const LEGACY_SESSION_KEYS = ["bitez_user_session_v1", "bitez-user-session"];

export type UserSessionData = {
  id: string;
  full_name: string;
  user_id: string;
  phone: string;
  college_name: string;
  role: "user";
  savedAt: number;
};

export function getStoredUserId() {
  return localStorage.getItem(USERID_KEY) || "";
}

function persist(s: Omit<UserSessionData, "role" | "savedAt">) {
  clearLocalSession();
  saveUserSession(s);
  try { localStorage.setItem(USERID_KEY, s.user_id); } catch { /* ignore */ }
  return { ...s, role: "user", savedAt: Date.now() } as UserSessionData;
}

export function clearLocalSession() {
  clearUserSession();
  for (const k of LEGACY_SESSION_KEYS) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
    try { sessionStorage.removeItem(k); } catch { /* ignore */ }
  }
}

export type SignupInput = {
  fullName: string;
  userId: string;
  phone: string;
  collegeName: string;
  pin: string;
};

export async function signupUser(input: SignupInput) {
  const uidName = input.userId.trim().toLowerCase();
  const email = `${uidName}@bitez.local`;
  const password = `bitezpin-${input.pin}`;

  // 1. Create authentication user in Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const authUid = userCredential.user.uid;

  // 2. Save user profile document in Firestore
  const userDocRef = doc(db, "users", authUid);
  const profile = {
    id: authUid,
    user_id: uidName,
    full_name: input.fullName,
    phone: input.phone,
    college_name: input.collegeName,
    role: "user" as const,
    created_at: new Date().toISOString()
  };
  await setDoc(userDocRef, profile);

  return persist({
    id: authUid,
    user_id: uidName,
    full_name: input.fullName,
    phone: input.phone,
    college_name: input.collegeName,
  });
}

export async function checkUserIdAvailable(userId: string) {
  const uidName = userId.trim().toLowerCase();
  try {
    const q = query(collection(db, "users"), where("user_id", "==", uidName));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (err) {
    console.warn("Firebase check-id-available query failed, assuming ID available:", err);
    return true;
  }
}

export async function loginWithPin(userId: string, pin: string) {
  const uidName = userId.trim().toLowerCase();
  const email = `${uidName}@bitez.local`;
  const password = `bitezpin-${pin}`;

  // 1. Sign in with Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const authUid = userCredential.user.uid;

  // 2. Retrieve user profile document from Firestore
  const userDocRef = doc(db, "users", authUid);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
    throw new Error("User profile not found");
  }

  const data = userDoc.data();
  return persist({
    id: authUid,
    full_name: data.full_name || "",
    user_id: data.user_id || uidName,
    phone: data.phone || "",
    college_name: data.college_name || "",
  });
}

export async function resetPin(userId: string, phone: string, newPin: string) {
  const uidName = userId.trim().toLowerCase();
  // Query the user by userId & phone
  const q = query(
    collection(db, "users"),
    where("user_id", "==", uidName),
    where("phone", "==", phone)
  );
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    throw new Error("User ID or phone number does not match");
  }

  // Note: To fully reset password in Firebase Auth client-side, we would need to be signed in
  // or use a secure serverless cloud function to update the user.
  // For now we simulate success in development, and log.
  console.log(`PIN reset requested for user: ${uidName}. Firebase updatePassword requires admin privileges without existing session.`);
}

export async function logoutUser() {
  clearLocalSession();
  try {
    await auth.signOut();
  } catch { /* ignore */ }
  try { localStorage.removeItem("bitez-cache-v2"); } catch { /* ignore */ }
  try { localStorage.removeItem(USERID_KEY); } catch { /* ignore */ }
}

export { getUserSession };