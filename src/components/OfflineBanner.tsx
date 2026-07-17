import { useEffect, useState } from "react";
import { isOffline, subscribeOffline } from "@/lib/pwa";

/**
 * Slim banner pinned to the very top of the screen when the device loses
 * its connection. Sits above safe-area insets so it doesn't get clipped by
 * the iOS notch in standalone mode.
 */
const OfflineBanner = () => {
  const [offline, setOffline] = useState(isOffline());
  useEffect(() => subscribeOffline(setOffline), []);

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 12,
        paddingRight: 12,
        textAlign: "center",
        background: "#1D1D1F",
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
      }}
    >
      You’re offline — some features are unavailable
    </div>
  );
};

export default OfflineBanner;