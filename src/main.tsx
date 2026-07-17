import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyPwaHeadForPath, getAdminStandaloneRedirect } from "@/lib/pwaLaunch";

const installRouteManifest = () => {
  // Force a one-time purge of all legacy browser cache to prevent mock/seed data bleeding
  if (typeof window !== "undefined") {
    if (window.localStorage.getItem("bitez_cache_purged_v3") !== "true") {
      Object.keys(window.localStorage).forEach((key) => {
        if (key.toLowerCase().startsWith("bitez")) {
          window.localStorage.removeItem(key);
        }
      });
      window.localStorage.setItem("bitez_cache_purged_v3", "true");
    }
  }
  applyPwaHeadForPath();
};

installRouteManifest();

const adminStandaloneRedirect = getAdminStandaloneRedirect();
if (adminStandaloneRedirect && adminStandaloneRedirect !== window.location.pathname) {
  window.history.replaceState(null, "", adminStandaloneRedirect);
  applyPwaHeadForPath(adminStandaloneRedirect);
}

const markIosPwa = () => {
  if (typeof window === "undefined") return;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isAppleTouch = /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const isStandalone = nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  document.documentElement.classList.toggle("ios-device", isAppleTouch);
  document.documentElement.classList.toggle("ios-pwa", isAppleTouch && isStandalone);
  document.documentElement.classList.toggle("pwa-standalone", isStandalone);
  document.documentElement.classList.toggle("android-pwa", isStandalone && /Android/i.test(nav.userAgent));
};

markIosPwa();

createRoot(document.getElementById("root")!).render(<App />);

/* ---------- PWA service worker registration ----------
 * vite-plugin-pwa generates /sw.js for the main PWA shell. We deliberately
 * skip registering it inside Lovable preview or iframe contexts (it would
 * cause stale content / navigation interference). The dedicated push
 * service worker at /sw-push.js is registered separately by the
 * usePushNotifications hook only when the user opts in.
 */
(function registerPwaSw() {
  if (typeof window === "undefined") return;

  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovableproject-dev.com");

  if (!("serviceWorker" in navigator)) return;

  if (isPreviewHost || isInIframe) {
    // Clean up any previously-registered SWs in preview contexts.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        // Keep /sw-push.js so push notifications still work where supported,
        // but unregister the auto-update PWA shell to avoid stale caches.
        const url = r.active?.scriptURL || "";
        if (!url.endsWith("/sw-push.js")) r.unregister();
      });
    });
    return;
  }

  // Production: if an older PWA shell service worker exists, register the
  // static cleanup worker once so installed apps stop serving stale screens.
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      const hasShellWorker = regs.some((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        return !url.endsWith("/sw-push.js");
      });
      if (hasShellWorker) {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
      }
    });
  });
})();

/* ---------- VisualViewport-driven app height ----------
 * iOS Safari doesn't shrink 100dvh when the keyboard opens, so the bottom
 * nav can end up under the keyboard. We expose --app-vh that always equals
 * the *visible* viewport, computed from window.visualViewport when present
 * and falling back to window.innerHeight. This is the most reliable strategy
 * across iOS Safari, Chrome Android, and standalone PWAs.
 */
(function installAppViewport() {
  if (typeof window === "undefined") return;
  const vv = window.visualViewport;
  let raf = 0;
  const apply = () => {
    window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(() => {
      const h = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-vh", `${h}px`);
    });
  };
  apply();
  if (vv) {
    vv.addEventListener("resize", apply);
  }
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
})();
