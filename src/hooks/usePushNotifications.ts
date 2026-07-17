import { useState, useEffect, useCallback } from "react";
import { db, auth } from "@/integrations/firebase/client";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Static VAPID key placeholder for client-side registration configuration
const MOCK_VAPID_KEY = "BDtUvq994x_kF81iH8W93UfH97fD402iJz20194883UHF8842iJz201_938UHF8842iJz201";

async function getVapidPublicKey(): Promise<string> {
  return MOCK_VAPID_KEY;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [isiOS, setIsiOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsiOS(isIOSDevice);

    const isPWAMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsPWA(isPWAMode);

    const hasServiceWorker = "serviceWorker" in navigator;
    const hasPushManager = "PushManager" in window;
    const hasNotification = "Notification" in window;

    if (isIOSDevice && !isPWAMode) {
      setIsSupported(false);
    } else {
      setIsSupported(hasServiceWorker && hasPushManager && hasNotification);
    }

    if ("Notification" in window) setPermission(Notification.permission);

    (async () => {
      try {
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
        if (!reg) return setIsSubscribed(false);
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch {
        setIsSubscribed(false);
      }
    })();
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) throw new Error("Push notifications are not supported");
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") throw new Error("Notification permission denied");

      const publicKey = await getVapidPublicKey();

      const registration = await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const p256dhKey = subscription.getKey("p256dh");
      const authKey = subscription.getKey("auth");
      if (!p256dhKey || !authKey) throw new Error("Failed to get subscription keys");

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)));
      const subAuth = btoa(String.fromCharCode(...new Uint8Array(authKey)));

      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const safeEndpoint = btoa(subscription.endpoint).replace(/[^a-zA-Z0-9]/g, "_");
      const docRef = doc(db, "push_subscriptions", `${user.uid}_${safeEndpoint}`);
      
      await setDoc(docRef, {
        user_id: user.uid,
        endpoint: subscription.endpoint,
        p256dh,
        auth: subAuth,
        created_at: new Date().toISOString()
      });

      setIsSubscribed(true);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      if (!reg) return setIsSubscribed(false);
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const user = auth.currentUser;
        if (user) {
          const safeEndpoint = btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, "_");
          const docRef = doc(db, "push_subscriptions", `${user.uid}_${safeEndpoint}`);
          await deleteDoc(docRef).catch(() => null);
        }
      }
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isSupported, isSubscribed, permission, isLoading, isiOS, isPWA, subscribe, unsubscribe };
}