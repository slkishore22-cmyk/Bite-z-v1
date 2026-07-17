import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  getOrderById,
  getOrders,
  loadOrdersFromBackend,
  subscribeOrders,
  setOrderStatus,
  type Order,
} from "@/lib/sellerOrders";
import { getUserSession } from "@/utils/sessionManager";
import OrderConfirmedAnimation from "../../components/OrderConfirmedAnimation";
import { QRCodeSVG } from "qrcode.react";
import { db } from "@/integrations/firebase/client";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

const format4DigitId = (id: string): string => {
  if (!id) return "";
  const numericOnly = id.replace(/[^0-9]/g, "");
  return numericOnly.length >= 4 ? numericOnly.slice(-4) : id.slice(-4);
};

const OrderStatus = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const method = (params.get("method") || "cod").toLowerCase();
  const orderParamId = params.get("id");
  const isHistory = params.get("history") === "1";

  const [revealed, setRevealed] = useState(false);
  const [taps, setTaps] = useState(0);
  const [processingMode, setProcessingMode] = useState<"qr" | "online">("online");
  const [dbOrder, setDbOrder] = useState<any>(null);
  const reduceMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isAppleTouch = /iPad|iPhone|iPod/.test(nav.userAgent) ||
      (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
    return isAppleTouch || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Pull the most recent order (or the one referenced in the URL).
  // Subscribe so a late-arriving backend sync (or realtime update) hydrates
  // the page if the order wasn't yet in localStorage on first paint.
  const resolve = (): Order | undefined =>
    orderParamId ? getOrderById(orderParamId) : getOrders()[0];
  const [order, setOrder] = useState<Order | undefined>(() => resolve());

  useEffect(() => {
    setOrder(resolve());
    const unsub = subscribeOrders(() => setOrder(resolve()));
    // If the order is missing (e.g., fresh session, new device, cache wipe),
    // pull from backend and retry. This is the root-cause fix for "items
    // missing" when tapping a canteen in My Orders.
    let cancelled = false;
    const ensure = async () => {
      if (resolve()) return;
      try {
        await loadOrdersFromBackend(null, getUserSession()?.id);
      } catch {
        /* offline — subscription will pick it up later */
      }
      if (!cancelled) setOrder(resolve());
    };
    ensure();
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderParamId]);



  // Fetch and subscribe to DB order
  useEffect(() => {
    if (!order?.uid) return;
    const unsub = onSnapshot(doc(db, "orders", order.uid), (docSnap) => {
      if (docSnap.exists()) {
        setDbOrder({ id: docSnap.id, ...docSnap.data() });
      }
    }, (err) => {
      console.error("Error subscribing to database order:", err);
    });

    return () => {
      unsub();
    };
  }, [order?.uid]);

  const isCompleted = dbOrder?.status === "delivered" || dbOrder?.status === "Completed" || dbOrder?.status === "completed";

  useEffect(() => {
    const fetchMode = async () => {
      try {
        const docRef = doc(db, "app_settings", "order_processing_mode");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data()?.value === "qr") {
          setProcessingMode("qr");
        } else {
          setProcessingMode("online");
        }
      } catch (err) {
        console.error("Error fetching order processing mode:", err);
        setProcessingMode("online");
      }
    };
    fetchMode();
  }, []);

  useEffect(() => {
    if (isCompleted && !isHistory) {
      toast.success("Order completed successfully!");
      const t = setTimeout(() => {
        navigate("/app/home");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [isCompleted, navigate, isHistory]);

  useEffect(() => {
    if (taps > 0) {
      const timer = setTimeout(() => setTaps(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [taps]);

  const handleCompleteTap = async () => {
    if (taps < 2) {
      setTaps((t) => t + 1);
    } else {
      try {
        if (order?.uid) {
          await setOrderStatus(order.uid, "Completed");
          setDbOrder((prev: any) => prev ? { ...prev, status: "Completed" } : null);
        }
        setTaps(0);
      } catch (err) {
        alert("Failed to complete order: " + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  const orderId = order?.id ?? "----";
  const items = order?.items ?? [];
  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const total = order?.total ?? 0;
  const subtotal = order?.subtotal ?? total;
  const hasDiscount = subtotal > total;
  const sellerName = order?.sellerName ?? "Canteen";
  const sellerIcon = order?.sellerIcon ?? items.find((i) => i.canteenIcon)?.canteenIcon ?? "🍽️";

  const paymentLabel = method === "upi" ? "Paid via UPI" : "Cash on Delivery";
  const paymentSub = method === "upi" ? "Transaction Successful" : "Pay at pickup";

  // COD countdown — order is valid for 2h from creation.
  const isCod = order?.payment === "Cash";
  const expiresAt = order?.expiresAt ?? null;
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isCod || !expiresAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [isCod, expiresAt]);
  const remainingMs = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const formatRemaining = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };
  const showCodTimer = isCod && expiresAt != null && (order?.status || "").toLowerCase() === "pending";

  const notesMeta = useMemo(() => {
    try {
      return dbOrder?.notes ? JSON.parse(dbOrder.notes) : {};
    } catch {
      return {};
    }
  }, [dbOrder]);

  const isDigitalBill = processingMode === "online" || isCompleted;

  if (isDigitalBill) {
    // isCompleted resolves from parent scope
    const completedAtTime = dbOrder?.completedAt || dbOrder?.completed_at || dbOrder?.paid_at || dbOrder?.updated_at || new Date().toISOString();
    const formattedCompletedTime = new Date(completedAtTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <div
        className="user-page w-full flex flex-col items-center"
        style={{
          minHeight: "100dvh",
          background: "#F8FAFC",
          color: "#0F172A",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          padding: "calc(12px + var(--ios-pwa-safe-top)) 20px 24px",
        }}
      >
        {/* Back navigation */}
        <div style={{ width: "100%", maxWidth: "380px", display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
          <button
            onClick={() => navigate(isHistory ? "/app/orders" : "/app/home")}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <span className="material-symbols-outlined" style={{ color: "#0F172A", fontSize: 28 }}>
              arrow_back
            </span>
          </button>
        </div>

        {/* Success header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#DCFCE7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              boxShadow: "0 4px 10px rgba(22,163,74,0.1)",
            }}
          >
            <span className="material-symbols-outlined" style={{ color: "#15803D", fontSize: 28, fontWeight: "bold" }}>
              check
            </span>
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0F172A", margin: 0, letterSpacing: "-0.5px" }}>
            Order Placed
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B", marginTop: 4, fontWeight: "500" }}>
            Show this bill to the canteen staff to receive your order.
          </p>
        </div>

        {/* Digital Bill Card */}
        <div
          style={{
            width: "100%",
            maxWidth: "380px",
            background: "#ffffff",
            borderRadius: "0px",
            padding: "24px",
            boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
            position: "relative",
            borderLeft: "1px solid #F1F5F9",
            borderRight: "1px solid #F1F5F9",
          }}
        >
          {/* Top Scalloped Edge */}
          <div
            style={{
              position: "absolute",
              top: -12,
              left: 0,
              right: 0,
              height: 12,
              background: "radial-gradient(circle at 8px -4px, transparent 6px, #ffffff 7px)",
              backgroundSize: "16px 12px",
              backgroundRepeat: "repeat-x",
            }}
          />

          {/* Card Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Leaf Icon SVG */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6">
                <path d="M2,21 C2,21 5,14 12,14 C12,14 17,9 18,6 C19,3 15,2 12,5 C9,8 9,12 9,12 C9,12 4,12 2,21 Z" />
                <path d="M12,21 C12,21 14,16 19,16 C19,16 22,12 23,10 C24,8 21,7 19,9 C17,11 17,14 17,14 C17,14 13,14 12,21 Z" opacity="0.7" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", letterSpacing: "-0.2px" }}>
                Campus Bites
              </span>
            </div>
            <span
              style={{
                background: "#DCFCE7",
                color: "#15803D",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "800",
                letterSpacing: "0.5px",
              }}
            >
              PAID
            </span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: "24px", fontWeight: "800", color: "#0F172A", margin: 0 }}>
              {sellerName}
            </h3>
            <p style={{ fontSize: "13px", color: "#64748B", margin: "2px 0 0 0", fontWeight: "500" }}>
              Digital Bill
            </p>
          </div>

          {/* Dashed Separator with Order Number Pill */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", margin: "24px 0" }}>
            <div style={{ position: "absolute", left: 0, right: 0, borderBottom: "1px dashed #E2E8F0" }} />
            <span
              style={{
                position: "relative",
                background: "#ffffff",
                color: "#0F172A",
                padding: "4px 12px",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: "700",
                border: "1px dashed #CBD5E1",
              }}
            >
              Order #{format4DigitId(orderId)}
            </span>
          </div>

          {/* Ordered items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {items.map((item: any, idx: number) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: "15px", fontWeight: "600", color: "#0F172A" }}>
                    {item.name}
                  </span>
                  <span style={{ display: "block", fontSize: "12px", color: "#64748B", marginTop: 2, fontWeight: "500" }}>
                    ×{item.qty}
                  </span>
                </div>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A" }}>
                  ₹{item.price * item.qty}
                </span>
              </div>
            ))}
          </div>

          <div style={{ borderBottom: "1px dashed #E2E8F0", margin: "20px 0" }} />

          {/* Payment verified row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* UPI Icon text/logo */}
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "900",
                  fontStyle: "italic",
                  background: "#F1F5F9",
                  color: "#0F766E",
                  padding: "3px 6px",
                  borderRadius: "4px",
                  border: "1px solid #CBD5E1",
                }}
              >
                UPI
              </span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#475569" }}>
                Paid via UPI
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#16A34A" }}>
                Verified
              </span>
              <span className="material-symbols-outlined" style={{ color: "#16A34A", fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
          </div>

          <div style={{ borderBottom: "1px solid #E2E8F0", margin: "20px 0" }} />

          {/* Subtotal & Discount if applicable */}
          {hasDiscount && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "0 0 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", color: "#64748B" }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: "500" }}>₹{subtotal}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", color: "#16A34A", fontWeight: "600" }}>
                <span>Canteen Offer</span>
                <span>−₹{subtotal - total}</span>
              </div>
            </div>
          )}

          {/* Total row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#475569" }}>
              Total Paid
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {hasDiscount && (
                <span style={{ fontSize: "18px", fontWeight: "600", color: "#94A3B8", textDecoration: "line-through" }}>
                  ₹{subtotal}
                </span>
              )}
              <span style={{ fontSize: "28px", fontWeight: "800", color: "#0F172A" }}>
                ₹{total}
              </span>
            </div>
          </div>

          <div style={{ borderBottom: "1px dashed #E2E8F0", margin: "20px 0" }} />

          {/* Date issued row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              calendar_today
            </span>
            <div style={{ fontSize: "12px", fontWeight: "500" }}>
              <span style={{ color: "#94A3B8" }}>Issued</span>
              <span style={{ display: "block", color: "#64748B", marginTop: 2 }}>
                {new Date(order.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Bottom Scalloped Edge */}
          <div
            style={{
              position: "absolute",
              bottom: -12,
              left: 0,
              right: 0,
              height: 12,
              background: "radial-gradient(circle at 8px 16px, transparent 6px, #ffffff 7px)",
              backgroundSize: "16px 12px",
              backgroundRepeat: "repeat-x",
            }}
          />
        </div>

        {/* Canteen Staff complete order action */}
        <div style={{ width: "100%", maxWidth: "380px", marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {!isCompleted ? (
            <>
              <button
                onClick={handleCompleteTap}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 26,
                  background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                  color: "#ffffff",
                  fontSize: 15,
                  fontWeight: "700",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: "pointer",
                  boxShadow: "0 8px 20px rgba(37,99,235,0.15)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  verified_user
                </span>
                {taps === 0 ? "Complete Order" : `Tap ${taps + 1} of 3`}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748B" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  security
                </span>
                <span style={{ fontSize: "11px", fontWeight: "500", textAlign: "center" }}>
                  Only canteen staff should press this button after handing over the food.
                </span>
              </div>
            </>
          ) : (
            <div
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 16,
                background: "#DCFCE7",
                border: "1px solid #BBF7D0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#15803D", fontWeight: "700", fontSize: "15px" }}>
                <span>✓</span>
                <span>Order Completed</span>
              </div>
              <span style={{ fontSize: "12px", color: "#16A34A", fontWeight: "500" }}>
                Completed on {new Date(completedAtTime).toLocaleDateString([], { day: '2-digit', month: 'short' })} • {formattedCompletedTime}
              </span>
            </div>
          )}
        </div>


        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="user-page w-full flex flex-col items-center"
      style={{
        color: "hsl(var(--user-text))",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Top AppBar */}
      <header
        className="user-content border-rose-200 user-content-readable flex items-center justify-start"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)",
          paddingBottom: 10,
        }}
      >
        <h1 className="font-bold text-lg" style={{ color: "#0F172A" }}>
          Order Status
        </h1>
      </header>

      <main
        className="user-content border-rose-200 user-content-readable flex-1 flex flex-col items-center"
        style={{
          paddingTop: 8,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
        }}
      >
        <OrderConfirmedAnimation reduceMotion={reduceMotion} />

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-3 w-full">
          {/* QR Code — for billing scan */}
          <div
            className="flex flex-col items-center justify-center"
            style={{
              animation: reduceMotion ? "none" : 'ob-card-slide-up 500ms 800ms ease both',
              background: "#FFFFFF",
              padding: 24,
              borderRadius: 20,
              boxShadow: "0 4px 20px -4px rgba(0,0,0,0.05)",
              border: "1px solid #F1F5F9",
            }}
          >
            <span
              className="uppercase mb-4"
              style={{
                color: "#64748B",
                fontSize: 12,
                letterSpacing: "0.12em",
                fontWeight: 600,
              }}
            >
              Scan at Counter
            </span>
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 2px 12px -4px rgba(15,23,42,0.08)",
              }}
            >
              <QRCodeSVG
                value={JSON.stringify({
                  orderId,
                  total,
                  items: items.map((i) => ({ n: i.name, q: i.qty })),
                  seller: sellerName,
                  payment: order?.payment ?? method,
                  ts: order?.createdAt ?? Date.now(),
                })}
                size={320}
                level="H"
                bgColor="#FFFFFF"
                fgColor="#0F172A"
                marginSize={0}
              />
            </div>
            <p
              className="mt-4"
              style={{ color: "#64748B", fontSize: 12, textAlign: "center" }}
            >
              Show this to the billing counter for instant printing
            </p>
          </div>

          {/* Order ID */}
          <div
            className="flex flex-col items-center justify-center transition-all duration-400"
            style={{
              animation: reduceMotion ? "none" : 'ob-card-slide-up 500ms 900ms ease both',
              background: "#FFFFFF",
              padding: 16,
              borderRadius: 16,
              boxShadow: "0 4px 20px -4px rgba(0,0,0,0.05)",
              border: "1px solid #F1F5F9",
            }}
          >
            <span
              className="uppercase mb-1"
              style={{
                color: "#64748B",
                fontSize: 11,
                letterSpacing: "0.1em",
              }}
            >
              Order ID
            </span>
            <div
              className="font-bold mb-3"
              style={{
                color: "#0F172A",
                fontSize: 22,
                letterSpacing: "0.1em",
              }}
            >
              {revealed ? `#${orderId}` : "XXXX"}
            </div>
            <button
              onClick={() => {
                if (revealed) return;
                setRevealed(true);
                window.setTimeout(() => setRevealed(false), 5000);
              }}
              disabled={revealed}
              className="font-bold transition-all"
              style={{
                color: "#2563EB",
                fontSize: 12,
                padding: "6px 20px",
                borderRadius: 9999,
                border: "1px solid rgba(37,99,235,0.2)",
                background: "transparent",
                opacity: revealed ? 0.5 : 1,
                cursor: revealed ? "default" : "pointer",
              }}
            >
              {revealed ? "Revealed" : "Tap to reveal"}
            </button>
          </div>

          {/* Payment Info */}
          <div
            className="flex items-center justify-between"
            style={{
              animation: reduceMotion ? "none" : 'ob-card-slide-up 500ms 1050ms ease both',
              background: "#FFFFFF",
              padding: 16,
              borderRadius: 16,
              boxShadow: "0 4px 20px -4px rgba(0,0,0,0.05)",
              border: "1px solid #F1F5F9",
            }}
          >
            <div className="flex items-center" style={{ gap: 12 }}>
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 40, height: 40, background: "#F1F5F9" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#64748B" }}
                >
                  {method === "upi" ? "account_balance_wallet" : "payments"}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#0F172A" }}>
                  {paymentLabel}
                </p>
                <p style={{ fontSize: 12, color: "#64748B" }}>{paymentSub}</p>
                {showCodTimer && (
                  <p
                    style={{
                      fontSize: 12,
                      color: remainingMs < 10 * 60 * 1000 ? "#DC2626" : "#0F172A",
                      marginTop: 2,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {remainingMs > 0
                      ? `${formatRemaining(remainingMs)} remaining`
                      : "Order expired"}
                  </p>
                )}
              </div>
            </div>
            <span
              className="material-symbols-outlined"
              style={{
                color: "#22C55E",
                fontVariationSettings: "'FILL' 1",
              }}
            >
              verified
            </span>
          </div>

          {/* Order Details */}
          <div
            className="relative overflow-hidden"
            style={{
              animation: reduceMotion ? "none" : 'ob-card-slide-up 500ms 1200ms ease both',
              background: "#FFFFFF",
              padding: 18,
              borderRadius: 16,
              boxShadow: "0 4px 20px -4px rgba(0,0,0,0.05)",
              border: "1px solid #F1F5F9",
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                top: 0,
                right: 0,
                width: 128,
                height: 128,
                marginRight: -64,
                marginTop: -64,
                opacity: 0.1,
                filter: "blur(48px)",
                background:
                  "linear-gradient(135deg, #B4C5FF 0%, #2563EB 100%)",
              }}
            />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex items-center min-w-0" style={{ gap: 10 }}>
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 40, height: 40, borderRadius: 9999, background: "#EFF6FF", fontSize: 22 }}
                >
                  {sellerIcon}
                </div>
                <div className="min-w-0">
                  <h3
                    className="font-bold mb-1"
                    style={{ fontSize: 18, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {sellerName}
                  </h3>
                  <p style={{ color: "#64748B", fontSize: 13 }}>
                    Order details
                  </p>
                </div>
              </div>
              <div
                className="font-bold uppercase"
                style={{
                  background: "#EFF6FF",
                  padding: "4px 12px",
                  borderRadius: 9999,
                  fontSize: 11,
                  color: "#2563EB",
                  letterSpacing: "-0.02em",
                }}
              >
                {itemCount} Item{itemCount === 1 ? "" : "s"}
              </div>
            </div>
            <div className="space-y-2 mb-4 relative z-10">
              {items.length === 0 ? (
                <div className="flex justify-between" style={{ fontSize: 14, color: "#64748B" }}>
                  <span>No items</span>
                </div>
              ) : (
                items.map((it, index) => (
                  <div
                    key={`${it.canteenId ?? "unknown"}-${it.itemId}-${index}`}
                    className="flex justify-between"
                    style={{ fontSize: 14, color: "#64748B" }}
                  >
                    <span>
                      <span style={{ marginRight: 6 }}>{it.icon}</span>
                      {it.name}
                    </span>
                    <span>x{it.qty}</span>
                  </div>
                ))
              )}
            </div>
            <div
              className="flex justify-between items-center relative z-10"
              style={{
                paddingTop: 12,
                borderTop: "1px solid #F1F5F9",
              }}
            >
              <span style={{ color: "#64748B", fontSize: 14 }}>
                Total Paid Amount
              </span>
              <span
                className="font-extrabold"
                style={{ fontSize: 20, color: "#0F172A" }}
              >
                ₹{total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="mt-5 w-full flex flex-col gap-4">
          <button
            onClick={() => navigate("/app/home")}
            className="w-full font-bold transition-all duration-400"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              border: "1px solid #E2E8F0",
              color: "#0F172A",
              padding: "14px 0",
              borderRadius: 9999,
              fontSize: 15,
            }}
          >
            Back to Home
          </button>
        </div>
      </main>
    </div>
  );
};

export default OrderStatus;