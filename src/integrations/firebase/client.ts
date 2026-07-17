import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyByVSQNmGAf5cltdo4moqRun5zu_Bn2NIc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "bite-z.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "bite-z",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "bite-z.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "345543663409",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:345543663409:web:3835e6f33049f4e20ada10",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-2GM7Q7CFKP"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics runs client-side only and if supported
export let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}
