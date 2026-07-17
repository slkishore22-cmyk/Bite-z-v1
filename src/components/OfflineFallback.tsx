import { useEffect, useState } from "react";
import { isOffline, subscribeOffline } from "@/lib/pwa";

/**
 * Full-screen friendly offline state. Shown when the device is offline AND
 * the caller passes `show` (typically: critical data is missing and no cache
 * was available). Sits above the page so the user never sees a blank screen.
 */
const OfflineFallback = ({ show }: { show?: boolean }) => {
  const [offline, setOffline] = useState(isOffline());
  useEffect(() => subscribeOffline(setOffline), []);

  if (!offline || !show) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "#F5F5F7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        paddingTop: 24,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.8)",
          boxShadow:
            "0 10px 30px -10px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
          display: "grid",
          placeItems: "center",
          marginBottom: 20,
          fontSize: 32,
        }}
      >
        📡
      </div>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          margin: "0 0 8px",
          color: "#1D1D1F",
          letterSpacing: "-0.01em",
        }}
      >
        You're offline
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "#86868B",
          margin: "0 0 24px",
          maxWidth: 320,
          lineHeight: 1.45,
        }}
      >
        We couldn't reach Bitez right now. Your cart and recent orders are safe — we'll sync as soon as you're back online.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: "#0071E3",
          color: "#fff",
          border: 0,
          height: 48,
          padding: "0 22px",
          borderRadius: 9999,
          fontSize: 16,
          fontWeight: 700,
          boxShadow: "0 4px 14px 0 rgba(0,113,227,0.3)",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
};

export default OfflineFallback;