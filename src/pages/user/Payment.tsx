/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clearCart, getCart } from "@/lib/userCart";
import { saveOrderLocally, recordSalesAndSpend } from "@/lib/sellerOrders";
import { pinItem } from "@/lib/userPins";
import { db } from "@/integrations/firebase/client";
import { doc, getDoc, collection, setDoc } from "firebase/firestore";
import { getUserSession } from "@/utils/sessionManager";
import { beginOrder, endOrder } from "@/utils/orderGuard";
import { getActiveDiscountPctForSeller } from "@/lib/sellerOffers";

const liquidGlass: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(40px)",
  WebkitBackdropFilter: "blur(40px)",
  borderRadius: 26,
  boxShadow:
    "inset 0 1.5px 0 0 rgba(255,255,255,0.55), 0 8px 32px rgba(0,0,0,0.06)",
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(0,0,0,0.03)",
};

const glassHighlight: React.CSSProperties = {
  content: '""',
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "45%",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)",
  pointerEvents: "none",
  zIndex: 1,
};

const Payment = () => {
  const HERO_IMG =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCiwJoiptyTfJjocBll2nIls6RlxY48tdulifddR5Ese8rvs5cmf6-rAcmLqNJxycS-Dr7ud8C7bRLZRUD8N8A5ClckwSyiZ_53kZFF9u5ZDYD5J8K1_wyYKp6HVxKbxaknaAEVb8RLOCcRXNnp5rNMMv94vETDcFlU2eZrm_p6ruQmZFNwjJWcWWFNNfZGOR3CbPJ7D-ISlZkiKOjKJmaxhuWB07R05v80Qyr406FF2HO2IXveIpxwF4qF68gr1dwINcGXsEKikaWe";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [placing, setPlacing] = useState(false);
  const [processingMode, setProcessingMode] = useState<"qr" | "online">("qr");
  const selectedCanteenId = params.get("canteenId");

  const cart = getCart();
  const canteenKeys = new Set(cart.map((c) => c.canteenId ?? "__unknown__"));
  const activeCart = selectedCanteenId
    ? cart.filter((c) => (c.canteenId ?? "__unknown__") === selectedCanteenId)
    : canteenKeys.size <= 1
    ? cart
    : [];

  const firstCartItem = activeCart[0];
  const subtotal = activeCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountPct = getActiveDiscountPctForSeller(firstCartItem?.canteenId);
  const total = Math.round(subtotal * (1 - discountPct / 100));

  useEffect(() => {
    void import("@/pages/user/OrderStatus");
    const fetchMode = async () => {
      try {
        const docRef = doc(db, "app_settings", "order_processing_mode");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data()?.value === "online") {
          setProcessingMode("online");
        }
      } catch (err) {
        console.error("Error fetching order processing mode:", err);
      }
    };
    fetchMode();
  }, []);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpayPayment = async () => {
    try {
      beginOrder();
    } catch {
      return;
    }
    if (placing) {
      endOrder();
      return;
    }
    if (activeCart.length === 0) {
      endOrder();
      navigate("/app/cart");
      return;
    }
    const sessionForCheck = getUserSession();
    if (!sessionForCheck?.id) {
      endOrder();
      alert("Please sign in again to place this order.");
      navigate("/app/login");
      return;
    }

    setPlacing(true);
    const loaded = await loadRazorpay();
    if (!loaded) {
      setPlacing(false);
      endOrder();
      alert("Failed to load Razorpay payment gateway. Please check your internet connection.");
      return;
    }

    const options = {
      key: (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || "rzp_test_TDflQrS9fjUjPq",
      amount: total * 100,
      currency: "INR",
      name: "Campus Bites",
      description: `Payment to ${firstCartItem?.canteenName || "Central Canteen"}`,
      handler: async function (response: any) {
        try {
          const orderUuid = doc(collection(db, "orders")).id;
          const nowTime = Date.now();
          const orderNum = `CB${Math.floor(1000 + Math.random() * 9000)}`;

          const orderData = {
            id: orderNum,
            uid: orderUuid,
            createdAt: nowTime,
            status: "preparing",
            expiresAt: null,
            payment: "Online",
            paymentStatus: "SUCCESS",
            isSoundPlayed: false,
            isSalesRecorded: false,
            items: activeCart.map((c) => ({
              itemId: c.itemId,
              name: c.name,
              icon: c.icon,
              category: c.category,
              price: c.price,
              qty: c.qty,
              canteenId: c.canteenId,
              canteenIcon: c.canteenIcon,
            })),
            subtotal: total,
            total: total,
            sellerId: firstCartItem?.canteenId ?? null,
            sellerName: firstCartItem?.canteenName ?? null,
            sellerIcon: firstCartItem?.canteenIcon ?? null,
            appUserId: sessionForCheck.id,
            notes: JSON.stringify({
              payment_method: "online",
              transaction_reference: response.razorpay_payment_id,
              items: activeCart.map((c) => ({
                itemId: c.itemId,
                name: c.name,
                icon: c.icon,
                category: c.category,
                price: c.price,
                qty: c.qty,
                canteenId: c.canteenId,
                canteenIcon: c.canteenIcon,
              })),
              user_name: sessionForCheck.full_name || sessionForCheck.email || "Customer",
            }),
            created_at: new Date(nowTime).toISOString(),
            order_number: orderNum
          };

          await setDoc(doc(db, "orders", orderUuid), orderData);
          const order = orderData;

          try {
            await recordSalesAndSpend(orderData as any);
          } catch (err) {
            console.warn("Failed to record sales on payment success:", err);
          }

          saveOrderLocally({
            id: order.order_number || order.id.slice(0, 8),
            uid: order.uid,
            createdAt: new Date(order.created_at).getTime(),
            payment: "Online",
            status: "Pending",
            items: activeCart.map((c) => ({
              itemId: c.itemId,
              name: c.name,
              icon: c.icon,
              category: c.category,
              price: c.price,
              qty: c.qty,
              canteenId: c.canteenId,
              canteenIcon: c.canteenIcon,
            })),
            subtotal: subtotal,
            total: total,
            sellerId: firstCartItem?.canteenId ?? null,
            sellerName: firstCartItem?.canteenName ?? null,
            paymentStatus: "SUCCESS",
            isSalesRecorded: false,
          });

          clearCart(firstCartItem?.canteenId ?? "__unknown__");
          activeCart.forEach((c) => pinItem(c.itemId));

          setPlacing(false);
          endOrder();

          navigate(`/app/order-status?id=${order.uid}&method=online`, { replace: true });
        } catch (err) {
          setPlacing(false);
          endOrder();
          alert("Order placement failed: " + (err instanceof Error ? err.message : String(err)));
        }
      },
      prefill: {
        name: sessionForCheck.full_name || "",
        contact: sessionForCheck.phone || "",
        email: sessionForCheck.email || "",
      },
      notes: {
        canteen_id: firstCartItem?.canteenId || "",
        student_id: sessionForCheck.id || "",
      },
      theme: {
        color: "#2563EB",
      },
      modal: {
        ondismiss: function() {
          setPlacing(false);
          endOrder();
        }
      }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  const placeOrder = async (method: "cod" | "upi") => {
    try {
      beginOrder();
    } catch {
      return;
    }
    if (placing) {
      endOrder();
      return;
    }
    if (activeCart.length === 0) {
      endOrder();
      navigate("/app/cart");
      return;
    }
    const sessionForCheck = getUserSession();
    if (!sessionForCheck?.id) {
      endOrder();
      alert("Please sign in again to place this order.");
      navigate("/app/login");
      return;
    }
    setPlacing(true);

    try {
        const qrValue = `BITEZ-${sessionForCheck.id.slice(0, 8).toUpperCase()}-${Date.now()}`;

        const orderUuid = doc(collection(db, "orders")).id;
        const nowTime = Date.now();
        const orderNum = `CB${Math.floor(1000 + Math.random() * 9000)}`;
        const expiresAt = method === "cod" ? nowTime + 2 * 60 * 60 * 1000 : null;

        const orderData = {
          id: orderNum,
          uid: orderUuid,
          createdAt: nowTime,
          status: "pending",
          expiresAt,
          payment: method === "cod" ? "Cash" : "Online",
          paymentStatus: "PENDING",
          isSoundPlayed: false,
          isSalesRecorded: false,
          items: activeCart.map((c) => ({
            itemId: c.itemId,
            name: c.name,
            icon: c.icon,
            category: c.category,
            price: c.price,
            qty: c.qty,
            canteenId: c.canteenId,
            canteenIcon: c.canteenIcon,
          })),
          subtotal: total,
          total: total,
          sellerId: firstCartItem?.canteenId ?? null,
          sellerName: firstCartItem?.canteenName ?? null,
          sellerIcon: firstCartItem?.canteenIcon ?? null,
          appUserId: sessionForCheck.id,
          notes: JSON.stringify({
            payment_method: method,
            qr_code: qrValue,
            items: activeCart.map((c) => ({
              itemId: c.itemId,
              name: c.name,
              icon: c.icon,
              category: c.category,
              price: c.price,
              qty: c.qty,
              canteenId: c.canteenId,
              canteenIcon: c.canteenIcon,
            })),
            user_name: sessionForCheck.email || "Customer",
          }),
          created_at: new Date(nowTime).toISOString(),
          order_number: orderNum,
          qr_code: qrValue
        };

        await setDoc(doc(db, "orders", orderUuid), orderData);
        const order = orderData;

        saveOrderLocally({
          id: order.id,
          uid: order.uid,
          createdAt: new Date(order.created_at).getTime(),
          payment: method === "cod" ? "Cash" : "Online",
          status: "Pending",
          items: activeCart.map((c) => ({
            itemId: c.itemId,
            name: c.name,
            icon: c.icon,
            category: c.category,
            price: c.price,
            qty: c.qty,
            canteenId: c.canteenId,
            canteenIcon: c.canteenIcon,
          })),
          subtotal: subtotal,
          total: total,
          sellerId: firstCartItem?.canteenId ?? null,
          sellerName: firstCartItem?.canteenName ?? null,
          paymentStatus: "PENDING",
        });

        clearCart(firstCartItem?.canteenId ?? "__unknown__");
        activeCart.forEach((c) => pinItem(c.itemId));

        setPlacing(false);
        endOrder();

        navigate(`/order-qr?id=${order.uid}`, {
          state: {
            orderId: order.id,
            qrValue: order.qr_code,
            amount: total,
            method,
            items: activeCart.map((c) => ({
              itemId: c.itemId,
              name: c.name,
              icon: c.icon,
              category: c.category,
              price: c.price,
              qty: c.qty,
              canteenId: c.canteenId,
              canteenIcon: c.canteenIcon,
            })),
          },
          replace: true,
        });
    } catch (err) {
        setPlacing(false);
        endOrder();
        alert("Could not create order. Please try again: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div
      className="user-page"
      style={{ color: "hsl(var(--user-text))", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="fixed z-50 flex items-center justify-center transition-all duration-[400ms] ease-in-out active:scale-95"
        style={{
          top: "calc(20px + var(--ios-pwa-safe-top))",
          left: 16,
          width: 40,
          height: 40,
          background: "transparent",
          border: "none",
          padding: 0,
        }}
      >
        <span className="material-symbols-outlined" style={{ color: "#1D1D1F", fontSize: 28 }}>
          arrow_back
        </span>
      </button>

      <main
        className="user-content flex flex-col w-full mx-auto px-4 sm:px-6"
        style={{
          paddingTop: "calc(84px + var(--ios-pwa-safe-top) + var(--ios-pwa-top-breathing))",
          maxWidth: "40rem",
          gap: 40,
        }}
      >
        <div
          className="relative overflow-hidden flex items-end w-full"
          style={{
            borderRadius: 26,
            height: 256,
            padding: 32,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <img
            alt="Premium Light Aesthetic"
            src={HERO_IMG}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(255,255,255,0.9), rgba(255,255,255,0.2), transparent)",
            }}
          />
          <div className="relative z-10">
            <span
              className="uppercase font-bold"
              style={{
                background: "#1D1D1F",
                color: "#FFFFFF",
                fontSize: 10,
                letterSpacing: "0.1em",
                padding: "4px 12px",
                borderRadius: 9999,
              }}
            >
              Secure Checkout
            </span>
            <h2
              className="font-extrabold tracking-tighter"
              style={{ fontSize: 30, marginTop: 8, color: "#1D1D1F" }}
            >
              Finalize Order
            </h2>
            <p
              className="font-medium"
              style={{ color: "#6E6E73", fontSize: 14, marginTop: 4 }}
            >
              Choose your preferred payment method
            </p>
          </div>
        </div>



        <section className="flex flex-col w-full" style={{ gap: 20 }}>
          <button
            type="button"
            disabled={placing}
            onClick={handleRazorpayPayment}
            className="w-full text-left group active:scale-[0.98] transition-all duration-[400ms] ease-out flex items-center justify-between"
            style={{ ...liquidGlass, padding: 20, borderRadius: 20, opacity: placing ? 0.5 : 1 }}
          >
            <span style={glassHighlight} aria-hidden />
            <div className="flex items-center relative z-10" style={{ gap: 14 }}>
              <div
                className="flex items-center justify-center group-hover:scale-105 transition-transform duration-[400ms]"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(37,99,235,0.10)",
                  color: "#2563EB",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}
                >
                  credit_card
                </span>
              </div>
              <div>
                <h3
                  className="font-bold tracking-tight"
                  style={{ color: "#1D1D1F", fontSize: 15 }}
                >
                  Pay via Razorpay (Online)
                </h3>
                <p style={{ color: "#6E6E73", fontSize: 12, marginTop: 2 }}>
                  Pay securely using UPI, Cards, Netbanking or Wallets
                </p>
              </div>
            </div>
            <span
              className="material-symbols-outlined relative z-10"
              style={{ color: "#1D1D1F", fontSize: 22 }}
            >
              chevron_right
            </span>
          </button>

          <button
            type="button"
            disabled={placing}
            onClick={() => placeOrder("cod")}
            className="w-full text-left group active:scale-[0.98] transition-all duration-[400ms] ease-out flex items-center justify-between"
            style={{ ...liquidGlass, padding: 20, borderRadius: 20, opacity: placing ? 0.5 : 1 }}
          >
            <span style={glassHighlight} aria-hidden />
            <div className="flex items-center relative z-10" style={{ gap: 14 }}>
              <div
                className="flex items-center justify-center group-hover:scale-105 transition-transform duration-[400ms]"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(52,199,89,0.10)",
                  color: "#34C759",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}
                >
                  payments
                </span>
              </div>
              <div>
                <h3
                  className="font-bold tracking-tight"
                  style={{ color: "#1D1D1F", fontSize: 15 }}
                >
                  Cash on Delivery
                </h3>
                <p style={{ color: "#6E6E73", fontSize: 12, marginTop: 2 }}>
                  Pay with Cash at Canteen
                </p>
              </div>
            </div>
            <span
              className="material-symbols-outlined relative z-10"
              style={{ color: "#1D1D1F", fontSize: 22 }}
            >
              chevron_right
            </span>
          </button>

          <button
            type="button"
            disabled={placing}
            onClick={() => placeOrder("upi")}
            className="w-full text-left group active:scale-[0.98] transition-all duration-[400ms] ease-out flex items-center justify-between"
            style={{ ...liquidGlass, padding: 20, borderRadius: 20, opacity: placing ? 0.5 : 1 }}
          >
            <span style={glassHighlight} aria-hidden />
            <div className="flex items-center relative z-10" style={{ gap: 14 }}>
              <div
                className="flex items-center justify-center group-hover:scale-105 transition-transform duration-[400ms]"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(0,122,255,0.10)",
                  color: "#007AFF",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}
                >
                  qr_code
                </span>
              </div>
              <div>
                <h3
                  className="font-bold tracking-tight"
                  style={{ color: "#1D1D1F", fontSize: 15 }}
                >
                  UPI Payment (Scan Canteen QR)
                </h3>
                <p style={{ color: "#6E6E73", fontSize: 12, marginTop: 2 }}>
                  Pay with any UPI App by scanning canteen QR code
                </p>
              </div>
            </div>
            <span
              className="material-symbols-outlined relative z-10"
              style={{ color: "#1D1D1F", fontSize: 22 }}
            >
              chevron_right
            </span>
          </button>
        </section>
      </main>
    </div>
  );
};

export default Payment;