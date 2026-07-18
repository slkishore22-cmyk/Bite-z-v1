/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { db } from "@/integrations/firebase/client";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { getUserSession } from "@/utils/sessionManager";
import { getOrderById } from "@/lib/sellerOrders";

const format4DigitId = (id: string): string => {
  if (!id) return "";
  const numericOnly = id.replace(/[^0-9]/g, "");
  return numericOnly.length >= 4 ? numericOnly.slice(-4) : id.slice(-4);
};

const OrderQRScreen = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("id") || state?.orderId;

  const [orderStatus, setOrderStatus] = useState("pending");
  const [paymentLaunched, setPaymentLaunched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingMode, setProcessingMode] = useState<"qr" | "online">("qr");

  // Dynamic order details (loaded from DB if state is missing on refresh)
  const [orderInfo, setOrderInfo] = useState<any>({
    qrValue: state?.qrValue || state?.qr_code,
    amount: state?.amount,
    items: state?.items,
    orderNumber: state?.orderNumber,
    sellerId: state?.sellerId,
  });

  // Redirect if mode is online
  useEffect(() => {
    const fetchMode = async () => {
      const localMode = localStorage.getItem("order_processing_mode");
      if (localMode === "online") {
        setProcessingMode("online");
        if (orderId) {
          navigate(`/app/order-status?id=${orderId}&method=online`, { replace: true });
          return;
        }
      }
      try {
        const docRef = doc(db, "app_settings", "order_processing_mode");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const val = docSnap.data()?.value;
          if (val === "online") {
            setProcessingMode("online");
            localStorage.setItem("order_processing_mode", "online");
            if (orderId) {
              navigate(`/app/order-status?id=${orderId}&method=online`, { replace: true });
            }
          } else if (val === "qr") {
            setProcessingMode("qr");
            localStorage.setItem("order_processing_mode", "qr");
          }
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchMode();
  }, [orderId, navigate]);

  // Canteen/Seller metadata (including dynamic merchant upiId and canteenName)
  const [sellerInfo, setSellerInfo] = useState<{ upiId: string; canteenName: string } | null>(null);

  // Load order and seller details
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError("No order ID provided.");
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        let data: any = null;
        try {
          const orderDoc = await getDoc(doc(db, "orders", orderId));
          if (orderDoc.exists()) {
            data = { id: orderDoc.id, ...orderDoc.data() };
          }
        } catch (dbQueryErr) {
          console.warn("Firestore order fetch failed, attempting local fallback...", dbQueryErr);
        }

        if (!data) {
          // Local fallback
          const localOrder = getOrderById(orderId);
          if (localOrder) {
            setOrderStatus(localOrder.status === "Completed" ? "delivered" : "pending");
            setOrderInfo({
              qrValue: localOrder.uid || localOrder.id,
              amount: localOrder.total,
              items: localOrder.items,
              orderNumber: localOrder.id,
              sellerId: localOrder.sellerId,
            });
            setSellerInfo({
              upiId: "canteen@upi",
              canteenName: localOrder.sellerName || "Central Canteen",
            });
            return;
          }

          setError("Order not found.");
          return;
        }

        const order = data as any;
        setOrderStatus(order.status);

        // Parse custom metadata from notes column
        let notesMeta: any = {};
        try {
          notesMeta = typeof order.notes === "string" ? JSON.parse(order.notes || "{}") : (order.notes || {});
        } catch (e) {
          console.error("Failed to parse order notes JSON:", e);
        }

        setOrderInfo({
          qrValue: notesMeta.qr_code || order.id,
          amount: order.total || order.subtotal || 0,
          items: notesMeta.items || [],
          orderNumber: order.order_number,
          sellerId: order.seller_id,
        });

        // Fetch canteen/seller profile to get their specific UPI ID and canteen name
        const sellerId = order.seller_id;
        if (sellerId) {
          const sellerDoc = await getDoc(doc(db, "sellers", sellerId));
          if (sellerDoc.exists()) {
            const seller = sellerDoc.data();
            setSellerInfo({
              upiId: seller.upi_id || "",
              canteenName: seller.canteen_name || "Bitez Canteen",
            });
          }
        }
      } catch (err: any) {
        console.error("Failed to load details:", err);
        setError("Unable to load order payment credentials.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Listen for staff scan in real time
  useEffect(() => {
    if (!orderId) return;

    const unsub = onSnapshot(doc(db, "orders", orderId), (docSnap) => {
      if (docSnap.exists()) {
        const newStatus = docSnap.data()?.status || "pending";
        setOrderStatus(newStatus);

        // If staff scanned (confirmed) — show Pay Now button
        if (newStatus === "confirmed") {
          // Vibrate phone to alert user
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
        }

        // If already paid (preparing / delivered / completed) — navigate to confirmation/order status
        if (newStatus === "preparing" || newStatus === "delivered" || newStatus === "Completed") {
          navigate(`/app/order-status?method=upi&id=${orderId}`, { replace: true });
        }
      }
    }, (err) => {
      console.error("Realtime subscription error for order status:", err);
    });

    return () => {
      unsub();
    };
  }, [orderId, navigate]);

  // Open UPI app with merchant details pre-filled
  const handlePayNow = () => {
    if (!sellerInfo?.upiId) {
      alert("Canteen UPI ID is not configured. Please pay at counter.");
      return;
    }
    setPaymentLaunched(true);

    const merchantUPI = sellerInfo.upiId;
    const merchantName = sellerInfo.canteenName;
    const payAmount = orderInfo.amount || 0;

    const orderNumberPart = orderInfo.orderNumber
      ? (orderInfo.orderNumber.startsWith("CB") ? orderInfo.orderNumber : `CB${orderInfo.orderNumber}`)
      : `CB202600${orderId.slice(0, 4).toUpperCase()}`;

    const upiLink =
      `upi://pay?` +
      `pa=${merchantUPI}` +
      `&pn=${encodeURIComponent(merchantName)}` +
      `&am=${payAmount.toFixed(0)}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(`CampusBites_Order_${orderNumberPart}`)}` +
      `&tr=${orderId.slice(0, 8)}`;

    // Open UPI app — works on Android and iOS
    window.location.href = upiLink;
  };

  const amountVal = orderInfo.amount || 0;
  const itemsVal = orderInfo.items || [];

  const session = getUserSession();
  const qrCodeJsonVal = useMemo(() => {
    if (!orderId) return "";
    return JSON.stringify({
      orderId: orderInfo.orderNumber ? `#${orderInfo.orderNumber}` : `#CB${orderId.slice(0, 8).toUpperCase()}`,
      studentId: session?.user_id || session?.id || "N/A",
      studentName: session?.full_name || "Student",
      department: session?.college_name || "N/A",
      canteenId: orderInfo.sellerId || "",
      items: itemsVal.map((i: any) => ({ name: i.name, qty: i.qty, price: i.price })),
      totalAmount: amountVal
    });
  }, [orderId, orderInfo, session, itemsVal, amountVal]);

  if (loading) {
    return (
      <div
        className="user-page"
        style={{
          minHeight: "100dvh",
          background: "hsl(var(--user-app-bg))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <p style={{ color: "hsl(var(--user-text))", fontWeight: "600" }}>Loading payment details...</p>
      </div>
    );
  }

  if (error || !orderId) {
    return (
      <div
        className="user-page"
        style={{
          minHeight: "100dvh",
          background: "hsl(var(--user-app-bg))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          textAlign: "center",
          gap: "16px",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#EF4444" }}>
          error
        </span>
        <p style={{ color: "hsl(var(--user-text))", fontWeight: "600", margin: 0 }}>{error || "Order not found."}</p>
        <button
          onClick={() => navigate("/app/home")}
          style={{
            padding: "12px 24px",
            background: "#2563EB",
            color: "#ffffff",
            border: "none",
            borderRadius: "12px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div
      className="user-page"
      style={{
        minHeight: "100dvh",
        background: "hsl(var(--user-app-bg))",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "calc(24px + var(--ios-pwa-safe-top)) 20px 24px",
        gap: "24px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ width: "100%", textAlign: "center", marginTop: "12px" }}>
        <h2
          style={{
            fontSize: "22px",
            fontWeight: "800",
            color: "hsl(var(--user-text))",
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          Show QR at Counter
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "hsl(var(--user-muted))",
            marginTop: "6px",
            fontWeight: "500",
          }}
        >
          Staff will scan this QR to confirm your order
        </p>
      </div>

      {/* QR Code */}
      <div
        className="user-card"
        style={{
          background: "#ffffff",
          padding: "24px",
          borderRadius: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "18px",
          width: "100%",
          maxWidth: "320px",
          border: "1px solid hsl(var(--user-border))",
          boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
        }}
      >
        <QRCodeSVG
          value={qrCodeJsonVal}
          size={220}
          level="M"
          includeMargin={false}
          fgColor="#0F172A"
          bgColor="#ffffff"
        />

        {/* Order amount */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: "28px",
              fontWeight: "800",
              color: "#0F172A",
              margin: 0,
            }}
          >
            ₹{amountVal.toFixed(2)}
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "#64748B",
              marginTop: "4px",
              fontWeight: "600",
              letterSpacing: "0.5px",
            }}
          >
            ORDER #{format4DigitId(orderId)}
          </p>
        </div>
      </div>

      {/* Order items summary */}
      <div
        className="user-card"
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#ffffff",
          borderRadius: "20px",
          padding: "16px 20px",
          border: "1px solid hsl(var(--user-border))",
        }}
      >
        <h4
          style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "#64748B",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "12px",
          }}
        >
          Items Summary
        </h4>
        {itemsVal.map((item: any, i: number) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: i < itemsVal.length - 1 ? "1px solid #F1F5F9" : "none",
            }}
          >
            <span
              style={{
                fontSize: "14px",
                color: "#0F172A",
                fontWeight: "500",
              }}
            >
              {item.icon} {item.name} × {item.qty}
            </span>
            <span
              style={{
                fontSize: "14px",
                color: "#0F172A",
                fontWeight: "700",
              }}
            >
              ₹{(item.price * item.qty).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Warning if canteen has no UPI ID configured */}
      {sellerInfo && !sellerInfo.upiId && (
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: "16px 20px",
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: "16px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "14px", color: "#DC2626", fontWeight: "bold" }}>
            Payment Config Error
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "#991B1B",
              fontWeight: "500",
            }}
          >
            This canteen ({sellerInfo.canteenName}) has not configured their merchant UPI ID in their settings panel. Please contact canteen staff to complete checkout.
          </span>
        </div>
      )}

      {/* Status indicator */}
      {orderStatus === "pending" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 20px",
            background: "#FEF3C7",
            border: "1px solid #FDE68A",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "400px",
            justifyContent: "center",
          }}
        >
          <div
            className="pulse-dot"
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#D97706",
            }}
          />
          <span
            style={{
              fontSize: "14px",
              color: "#B45309",
              fontWeight: "600",
            }}
          >
            Waiting for staff to scan...
          </span>
        </div>
      )}

      {/* PAY NOW button — appears after staff scans */}
      {(orderStatus === "confirmed" || orderStatus === "preparing" || orderStatus === "delivered") && !paymentLaunched && (
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            animation: "slideUp 0.3s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px 20px",
              background: "#DCFCE7",
              border: "1px solid #BBF7D0",
              borderRadius: "16px",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "16px", color: "#16A34A", fontWeight: "bold" }}>✓</span>
            <span
              style={{
                fontSize: "14px",
                color: "#15803D",
                fontWeight: "600",
              }}
            >
              Order Confirmed by Staff
            </span>
          </div>

          <button
            onClick={handlePayNow}
            disabled={!sellerInfo?.upiId}
            style={{
              width: "100%",
              padding: "16px",
              background: sellerInfo?.upiId ? "#2563EB" : "#94A3B8",
              color: "#ffffff",
              border: "none",
              borderRadius: "16px",
              fontSize: "16px",
              fontWeight: "700",
              cursor: sellerInfo?.upiId ? "pointer" : "not-allowed",
              boxShadow: sellerInfo?.upiId ? "0 4px 12px rgba(37,99,235,0.2)" : "none",
              transition: "background 0.2s",
            }}
          >
            Pay ₹{amountVal.toFixed(2)} via UPI
          </button>

          <p
            style={{
              fontSize: "12px",
              color: "hsl(var(--user-muted))",
              textAlign: "center",
              margin: 0,
              fontWeight: "500",
            }}
          >
            Opens your UPI app automatically
          </p>
        </div>
      )}

      {/* After UPI app launched */}
      {paymentLaunched && (
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: "20px",
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            borderRadius: "16px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}
        >
          <p
            style={{
              fontSize: "14px",
              color: "#1D4ED8",
              fontWeight: "600",
              margin: 0,
            }}
          >
            Payment Initiated
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#1E40AF",
              margin: 0,
              fontWeight: "500"
            }}
          >
            Please complete the payment in your UPI app, then show your payment confirmation screen to the canteen staff.
          </p>
          <p style={{ fontSize: "11px", color: "#2563EB", margin: 0, fontWeight: "600" }}>
            Waiting for canteen staff confirmation...
          </p>
        </div>
      )}

      <style>{`
        .pulse-dot {
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default OrderQRScreen;

