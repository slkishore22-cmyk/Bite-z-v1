/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getOrders,
  loadOrdersFromBackend,
  setOrderStatus,
  subscribeOrders,
  type Order as StoreOrder,
} from "@/lib/sellerOrders";
import { getSellerSession } from "@/utils/sessionManager";
import { db, auth } from "@/integrations/firebase/client";
import { doc, getDoc, updateDoc, collection, query as fsQuery, where, getDocs, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";

type TabKey = "live" | "history";
type ViewKey = "bulk" | "individual";

type BulkRow = {
  emoji: string;
  name: string;
  category: string;
  units: number;
  tone: "primary" | "accent" | "warning";
};

type OrderItem = { emoji: string; name: string; qty: number };
type Order = {
  id: string;
  uid: string;
  agoMinutes: number;
  payment: "Online" | "Cash";
  total: number;
  items: OrderItem[];
  completedAt?: Date;
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const toneClasses: Record<BulkRow["tone"], string> = {
  primary: "text-primary",
  accent: "text-accent",
  warning: "text-warning",
};

const formatAgo = (m: number) => {
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} hr ago`;
};

const SellerOrders = () => {
  const [tab, setTab] = useState<TabKey>("live");
  const [view, setView] = useState<ViewKey>("bulk");
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState<Date>(() => startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => endOfDay(new Date()));
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>(() => getOrders());
  const [sellerId, setSellerId] = useState<string | null>(() => getSellerSession()?.id ?? null);
  const [verifyOrder, setVerifyOrder] = useState<any>(null);

  const handleQRScan = async (scannedQRValue: string) => {
    try {
      let qrData: any = null;
      try {
        if (scannedQRValue.startsWith("{")) {
          qrData = JSON.parse(scannedQRValue);
        }
      } catch (e) {
        console.warn("QR value is not JSON, treating as raw ID", e);
      }

      if (qrData) {
        const cleanOrderId = qrData.orderId.replace("#", "");
        let dbRes: any = null;

        // Try getting order by Doc ID (which is the uid)
        const docSnap = await getDoc(doc(db, "orders", cleanOrderId));
        if (docSnap.exists() && docSnap.data().status === "pending") {
          dbRes = { id: docSnap.id, ...(docSnap.data() as any) };
        } else {
          // Fallback: search by order_number
          const qNum = fsQuery(collection(db, "orders"), where("order_number", "==", cleanOrderId), where("status", "==", "pending"));
          const snapNum = await getDocs(qNum);
          if (!snapNum.empty) {
            dbRes = { id: snapNum.docs[0].id, ...(snapNum.docs[0].data() as any) };
          }
        }

        if (!dbRes) {
          toast.error("Order not found in database or already processed.");
          return;
        }

        setVerifyOrder({
          orderId: qrData.orderId,
          studentName: qrData.studentName,
          rollNumber: qrData.studentId,
          department: qrData.department || "N/A",
          items: qrData.items || [],
          totalAmount: qrData.totalAmount,
          dbId: dbRes.id,
          rawQRValue: scannedQRValue,
          dbRecord: dbRes
        });
      } else {
        const cleanScanVal = scannedQRValue.trim();
        let dbRes: any = null;

        const docSnap = await getDoc(doc(db, "orders", cleanScanVal));
        if (docSnap.exists() && docSnap.data().status === "pending") {
          dbRes = { id: docSnap.id, ...(docSnap.data() as any) };
        } else {
          const qNum = fsQuery(collection(db, "orders"), where("order_number", "==", cleanScanVal), where("status", "==", "pending"));
          const snapNum = await getDocs(qNum);
          if (!snapNum.empty) {
            dbRes = { id: snapNum.docs[0].id, ...(snapNum.docs[0].data() as any) };
          }
        }

        if (!dbRes) {
          toast.error("Order not found or already processed.");
          return;
        }

        let notesMeta: any = {};
        try {
          notesMeta = typeof dbRes.notes === "string" ? JSON.parse(dbRes.notes || "{}") : (dbRes.notes || {});
        } catch (e) {}

        setVerifyOrder({
          orderId: dbRes.order_number ? `#${dbRes.order_number}` : `#${dbRes.id.slice(0, 8).toUpperCase()}`,
          studentName: notesMeta.user_name || "Bitez Student",
          rollNumber: notesMeta.user_id || "N/A",
          department: notesMeta.college_name || "Main Campus",
          items: notesMeta.items || [],
          totalAmount: dbRes.total || 0,
          dbId: dbRes.id,
          rawQRValue: scannedQRValue,
          dbRecord: dbRes
        });
      }
    } catch (err) {
      toast.error("Scan processing failed.");
    }
  };

  const handleGenerateBill = async () => {
    if (!verifyOrder) return;
    try {
      const user = auth.currentUser;
      const staffIdentifier = user?.email || user?.uid || "Staff Scanner";

      let notesMeta: any = {};
      try {
        notesMeta = typeof verifyOrder.dbRecord.notes === "string" 
          ? JSON.parse(verifyOrder.dbRecord.notes || "{}") 
          : (verifyOrder.dbRecord.notes || {});
      } catch {}
      notesMeta.qr_scanned_at = new Date().toISOString();
      notesMeta.qr_scanned_by = staffIdentifier;

      await setOrderStatus(verifyOrder.dbId, "confirmed", JSON.stringify(notesMeta));

      // Simulated Thermal Receipt printing
      const receiptText = `
================================
          CAMPUS BITES
================================
Order: ${verifyOrder.orderId}
Date: ${new Date().toLocaleString()}
Student: ${verifyOrder.studentName}
Roll No: ${verifyOrder.rollNumber}
Dept: ${verifyOrder.department}
--------------------------------
Items: 
${verifyOrder.items.map((i: any) => `${i.icon || "🍽️"} ${i.name || i.n || "Item"}\n  ${i.qty || i.q || 1} x Rs.${(i.price || 0).toFixed(2)}      Rs.  ${((i.price || 0) * (i.qty || i.q || 1)).toFixed(2)}`).join("\n")}
--------------------------------
TOTAL AMOUNT:      Rs.  ${verifyOrder.totalAmount.toFixed(2)}
Payment: Counter UPI
Status: SCANNED - CONFIRMED
================================
  Thank you for your order!     
================================
      `;
      console.log("Sending payload to thermal printer:\n", receiptText);

      toast.success(`Bill generated! Physical receipt printed.`);
      setVerifyOrder(null);

      // Reload orders list
      loadOrdersFromBackend(sellerId).then(setStoreOrders).catch(() => {});
    } catch (err) {
      toast.error("Billing failed. Please try again.");
    }
  };

  useEffect(() => {
    const sid = getSellerSession()?.id ?? null;
    setSellerId(sid);
    const unsub = subscribeOrders(() => setStoreOrders(getOrders()));
    loadOrdersFromBackend(sid).then(setStoreOrders).catch(() => setStoreOrders([]));

    const q = sid 
      ? fsQuery(collection(db, "orders"), where("sellerId", "==", sid))
      : fsQuery(collection(db, "orders"));

    const unsubRealtime = onSnapshot(q, () => {
      loadOrdersFromBackend(sid).then(setStoreOrders).catch(() => {});
    }, (err) => {
      console.error("Firestore seller orders realtime listener failed:", err);
    });

    return () => {
      unsub();
      unsubRealtime();
    };
  }, []);

  // Scope every derived list to the currently logged-in seller so other
  // sellers' cached orders never leak into bulk/individual views.
  const sellerOrders = useMemo(
    () => (sellerId ? storeOrders.filter((o) => o.sellerId === sellerId) : storeOrders),
    [storeOrders, sellerId],
  );

  const liveOrders: Order[] = useMemo(
    () =>
      sellerOrders
        .filter((o) => {
          const s = (o.status || "").toLowerCase();
          return s === "pending" || s === "preparing" || s === "confirmed";
        })
        .map(toOrder),
    [sellerOrders],
  );

  const historyOrders: Order[] = useMemo(
    () =>
      sellerOrders
        .filter((o) => {
          const s = (o.status || "").toLowerCase();
          return s === "completed" || s === "cancelled" || s === "expired";
        })
        .map(toOrder),
    [sellerOrders],
  );

  // Aggregate items across live orders for the bulk summary view.
  const bulkRows: BulkRow[] = useMemo(() => {
    const map = new Map<string, BulkRow & { units: number }>();
    const tones: BulkRow["tone"][] = ["primary", "accent", "warning"];
    sellerOrders
      .filter((o) => {
        const s = (o.status || "").toLowerCase();
        return s === "pending" || s === "preparing" || s === "confirmed";
      })
      .forEach((o) =>
        o.items.forEach((it) => {
          // Stable composite key: prefer itemId, but always include name+category
          // so different products never collide on a missing/duplicate itemId,
          // and the same product across orders always merges into one row.
          const key = `${(it.itemId ?? "").trim()}|${it.name.trim().toLowerCase()}|${it.category}`;
          const cur = map.get(key);
          if (cur) cur.units += it.qty;
          else
            map.set(key, {
              emoji: it.icon,
              name: it.name,
              category: it.category,
              units: it.qty,
              tone: tones[map.size % tones.length],
            });
        }),
      );
    return Array.from(map.values()).sort((a, b) => b.units - a.units);
  }, [sellerOrders]);

  const sourceOrders = useMemo(() => {
    if (tab === "live") return liveOrders;
    const from = startOfDay(startDate).getTime();
    const to = endOfDay(endDate).getTime();
    return historyOrders.filter((o) => {
      if (!o.completedAt) return false;
      const t = o.completedAt.getTime();
      return t >= from && t <= to;
    });
  }, [tab, startDate, endDate, liveOrders, historyOrders]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sourceOrders;
    return sourceOrders.filter(
      (o) =>
        o.id.includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q))
    );
  }, [sourceOrders, query]);

  const totalOrders = sourceOrders.length;

  return (
    <div className="seller-admin-shell">
      <div className="seller-admin-content">
        {/* Header */}
        <header className="flex items-center gap-3">
          <Link
            to="/seller/dashboard"
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">Orders</h1>
        </header>

        {/* Tabs */}
        <div className="mt-6 flex items-center gap-6 border-b border-border">
          {(["live", "history"] as TabKey[]).map((k) => {
            const active = tab === k;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`relative pb-3 text-sm font-bold tracking-wide transition ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {k === "live" ? "Live Orders" : "History"}
                {active && (
                  <span className="absolute -bottom-px left-0 h-0.5 w-8 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* View segmented — only on Live */}
        {tab === "live" && (
          <div className="mt-5 inline-flex rounded-full bg-secondary/70 p-1">
            {(["bulk", "individual"] as ViewKey[]).map((k) => {
              const active = view === k;
              return (
                <button
                  key={k}
                  onClick={() => setView(k)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition ${
                    active ? "bg-background text-primary shadow-card" : "text-muted-foreground"
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        )}

        {/* QR Scanner simulation section */}
        {tab === "live" && (
          <div className="mt-6 rounded-3xl border border-border bg-gradient-card p-5 shadow-card">
            <h3 className="text-xs font-bold tracking-[0.2em] text-muted-foreground mb-3">
              SCAN CUSTOMER QR
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Scan or enter QR value (BITEZ-...)"
                className="flex-1 rounded-full border border-border bg-secondary/60 py-2.5 px-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      void handleQRScan(val);
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  const val = input.value.trim();
                  if (val) {
                    void handleQRScan(val);
                    input.value = "";
                  }
                }}
                className="rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground transition hover:bg-primary/90"
              >
                Scan
              </button>
            </div>
          </div>
        )}

        {/* Date range — only on History */}
        {tab === "history" && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <DateField label="Start date" value={startDate} onChange={(d) => setStartDate(startOfDay(d))} />
            <DateField label="End date" value={endDate} onChange={(d) => setEndDate(endOfDay(d))} />
          </div>
        )}

        {tab === "live" && view === "bulk" ? (
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-[0.2em] text-muted-foreground">
                BULK SUMMARY
              </h2>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-primary">
                FROM {totalOrders} ORDERS
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {bulkRows.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-card p-4 shadow-card"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
                    {row.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold leading-tight">{row.name}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      {row.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-extrabold ${toneClasses[row.tone]}`}>
                      {row.units}
                    </p>
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                      UNITS
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-6">
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" style={{ fontSize: 20 }}>
                search
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by order ID or item"
                className="w-full rounded-full border border-border bg-secondary/60 py-3 pl-11 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="mt-4 space-y-4">
              {filteredOrders.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
                  No orders found
                </p>
              )}
              {filteredOrders.map((o) => (
                <article
                  key={o.uid}
                  className="rounded-2xl border border-border bg-gradient-card p-4 shadow-card"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
                        ORDER ID
                      </p>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight">#{format4DigitId(o.id)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
                        STATUS
                      </p>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {formatAgo(o.agoMinutes)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-secondary/50 p-3">
                    {o.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 text-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base">{it.emoji}</span>
                          <span className="truncate font-semibold">{it.name}</span>
                        </div>
                        <span className="font-bold text-muted-foreground">x{it.qty}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
                        PAYMENT
                      </p>
                      <p
                        className={`mt-0.5 text-sm font-bold ${
                          o.payment === "Online" ? "text-warning" : "text-success"
                        }`}
                      >
                        {o.payment}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
                        TOTAL
                      </p>
                      <p className="mt-0.5 text-xl font-extrabold">₹{o.total}</p>
                    </div>
                  </div>
                  {tab === "live" && (
                    <button
                      type="button"
                      onClick={() => setOrderStatus(o.uid, "Completed")}
                      className="mt-3 w-full rounded-full bg-primary py-2 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:bg-primary/90"
                    >
                      Mark Completed
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Live syncing pill */}
      {tab === "live" && (
        <div className="pointer-events-none fixed bottom-5 left-0 right-0 flex justify-center">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 shadow-card backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-foreground">
              LIVE SYNCING
            </span>
          </div>
        </div>
      )}

      {/* verification modal overlay */}
      {verifyOrder && (
        <div
          onClick={() => setVerifyOrder(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            color: "#FFFFFF",
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111118",
              border: "1px solid #1E1E2E",
              borderRadius: "24px",
              padding: "24px",
              maxWidth: "440px",
              width: "90%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#2563EB" }}>
                Verify Customer Order
              </h3>
              <button
                onClick={() => setVerifyOrder(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#9CA3AF"
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ borderBottom: "1px solid #1E1E2E" }} />

            {/* Student details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#9CA3AF", fontSize: "13px" }}>Student Name</span>
                <span style={{ fontWeight: "700", color: "#FFFFFF", fontSize: "14px" }}>
                  {verifyOrder.studentName}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#9CA3AF", fontSize: "13px" }}>Roll Number</span>
                <span style={{ fontWeight: "700", color: "#FFFFFF", fontSize: "14px" }}>
                  {verifyOrder.rollNumber}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#9CA3AF", fontSize: "13px" }}>Department</span>
                <span style={{ fontWeight: "700", color: "#FFFFFF", fontSize: "14px" }}>
                  {verifyOrder.department}
                </span>
              </div>
            </div>

            <div style={{ borderBottom: "1px solid #1E1E2E" }} />

            {/* Items */}
            <div>
              <span style={{ color: "#9CA3AF", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Ordered Items
              </span>
              <div style={{ marginTop: 8, background: "#181824", borderRadius: "16px", padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
                {verifyOrder.items.map((item: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span>
                      {item.icon || item.emoji || "🍽️"} {item.name || item.n} <strong style={{ color: "#2563EB" }}>x{item.qty || item.q}</strong>
                    </span>
                    <span style={{ fontWeight: "700" }}>
                      ₹{(item.price || 0) * (item.qty || item.q || 1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <span style={{ color: "#9CA3AF", fontSize: "14px", fontWeight: "600" }}>Total Amount</span>
              <span style={{ fontSize: "24px", fontWeight: "800", color: "#FFFFFF" }}>
                ₹{verifyOrder.totalAmount}
              </span>
            </div>

            <div style={{ borderBottom: "1px solid #1E1E2E", margin: "4px 0" }} />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setVerifyOrder(null)}
                style={{
                  flex: 1,
                  height: "44px",
                  borderRadius: "22px",
                  background: "transparent",
                  border: "1px solid #2A2A3A",
                  color: "#9CA3AF",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateBill}
                style={{
                  flex: 1,
                  height: "44px",
                  borderRadius: "22px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Generate Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const format4DigitId = (id: string): string => {
  if (!id) return "";
  const numericOnly = id.replace(/[^0-9]/g, "");
  return numericOnly.length >= 4 ? numericOnly.slice(-4) : id.slice(-4);
};

export default SellerOrders;

// Convert a store order to the local UI shape.
function toOrder(o: StoreOrder): Order {
  const completedAt = o.completedAt ? new Date(o.completedAt) : undefined;
  const ago = Math.max(0, Math.floor((Date.now() - o.createdAt) / 60000));
  return {
    id: o.id,
    uid: o.uid,
    agoMinutes: ago,
    payment: o.payment,
    total: o.total,
    items: o.items.map((i) => ({ emoji: i.icon, name: i.name, qty: i.qty })),
    completedAt,
  };
}

type DateFieldProps = {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
};

const DateField = ({ label, value, onChange }: DateFieldProps) => {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
        {label.toUpperCase()}
      </p>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between rounded-full border border-border bg-secondary/60 px-4 py-2.5 text-sm font-semibold transition hover:border-primary/40"
            )}
          >
            <span>{format(value, "dd MMM yyyy")}</span>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => d && onChange(d)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
