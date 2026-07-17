import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getOrders, loadOrdersFromBackend, subscribeOrders, type Order } from "@/lib/sellerOrders";
import {
  ordersInRange,
  rangeBounds,
  summariseByCategory,
  totalRevenue,
  type RangeKey,
} from "@/lib/sellerStats";
import { getSellerSession } from "@/utils/sessionManager";
import { db } from "@/integrations/firebase/client";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍛",
  Snacks: "🍟",
  Drinks: "🥤",
};

const SalesDashboard = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("today");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>(() => getOrders());

  useEffect(() => {
    const sellerId = getSellerSession()?.id;
    const unsub = subscribeOrders(() => setOrders(getOrders()));
    
    const fetchOrders = () => {
      loadOrdersFromBackend(sellerId).then(setOrders).catch(() => setOrders([]));
    };

    fetchOrders();

    const q = sellerId 
      ? query(collection(db, "orders"), where("sellerId", "==", sellerId))
      : query(collection(db, "orders"));

    const unsubRealtime = onSnapshot(q, () => {
      fetchOrders();
    }, (err) => {
      console.warn("Firestore sales dashboard orders realtime listener failed:", err);
    });

    return () => {
      unsub();
      unsubRealtime();
    };
  }, []);

  const { from, to } = useMemo(() => rangeBounds(range), [range]);
  const ranged = useMemo(() => ordersInRange(orders, from, to), [orders, from, to]);
  const revenue = useMemo(() => totalRevenue(ranged), [ranged]);
  const categories = useMemo(() => summariseByCategory(ranged), [ranged]);
  const totalCats = categories.length;
  // Default-open the first category for visual consistency.
  const effectiveOpenKey = openKey ?? categories[0]?.category ?? null;

  return (
    <div className="seller-admin-shell">
      <div className="seller-admin-content">
        {/* Title */}
        <section className="flex items-start gap-3">
          <Link
            to="/seller/dashboard"
            aria-label="Back"
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-extrabold tracking-tight">Sales Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your canteen performance
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-secondary/70 p-1">
              {(["today", "week", "month"] as RangeKey[]).map((k) => {
                const active = range === k;
                return (
                  <button
                    key={k}
                    onClick={() => setRange(k)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition sm:px-4 sm:text-xs ${
                      active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                    }`}
                  >
                    {k}
                    {active && (
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        check_circle
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => navigate("/seller/sales/reports")}
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-primary transition hover:bg-primary/20 sm:px-4 sm:text-xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                bar_chart
              </span>
              <span className="whitespace-nowrap">View Reports</span>
            </button>
          </div>
          </div>
        </section>

        {/* Sales card */}
        <section className="mt-5 rounded-3xl border border-border bg-gradient-card p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                trending_up
              </span>
              +8.5%
            </span>
          </div>
          <p className="mt-5 text-xs font-bold tracking-[0.2em] text-muted-foreground">
            {range === "today" ? "TODAY'S SALES" : range === "week" ? "THIS WEEK" : "THIS MONTH"}
          </p>
          <p className="mt-1.5 text-4xl font-extrabold tracking-tight">
            ₹{revenue.toLocaleString("en-IN")}
            <span className="ml-2 align-middle text-xs font-bold tracking-wide text-muted-foreground">
              INR
            </span>
          </p>
        </section>

        {/* Sales by category */}
        <section className="mt-7">
          <div className="flex items-end justify-between">
            <h3 className="text-lg font-extrabold tracking-tight">Sales by Category</h3>
            <span className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground">
              {totalCats} CATEGORIES
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {categories.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
                No sales in this range yet.
              </p>
            )}
            {categories.map((cat) => {
              const open = effectiveOpenKey === cat.category;
              return (
                <div
                  key={cat.category}
                  className="overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-card"
                >
                  <button
                    onClick={() => setOpenKey(open ? "" : cat.category)}
                    className="flex w-full items-center gap-3 p-4 text-left"
                    aria-expanded={open}
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
                      {CATEGORY_EMOJI[cat.category] ?? "🍽️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold leading-tight">{cat.category}</p>
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        {cat.totalSold} items sold
                      </p>
                    </div>
                    <span
                      className="material-symbols-outlined text-muted-foreground transition-transform"
                      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      keyboard_arrow_down
                    </span>
                  </button>

                  {open && (
                    <div className="border-t border-border/60 bg-secondary/30 p-3 space-y-2">
                      {cat.items.map((it) => (
                        <div
                          key={it.name}
                          className="flex items-center justify-between rounded-xl bg-background/60 px-4 py-2.5"
                        >
                          <span className="truncate text-sm font-semibold">{it.name}</span>
                          <span className="text-sm font-bold text-primary">{it.sold} sold</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom stats */}
        <section className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-gradient-card p-4 shadow-card">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-warning/15 text-warning">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                schedule
              </span>
            </div>
            <p className="mt-3 text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
              PEAK HOUR
            </p>
            <p className="mt-1 text-xl font-extrabold tracking-tight">
              {peakHourLabelLocal(ranged)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-gradient-card p-4 shadow-card">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                star
              </span>
            </div>
            <p className="mt-3 text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
              TOP ITEM
            </p>
            <p className="mt-1 truncate text-xl font-extrabold tracking-tight">
              {topItemLocal(ranged)}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SalesDashboard;

function peakHourLabelLocal(orders: Order[]): string {
  if (orders.length === 0) return "—";
  const hours = new Array(24).fill(0);
  for (const o of orders) hours[new Date(o.createdAt).getHours()] += o.total;
  let best = 0;
  let bestVal = 0;
  hours.forEach((v, i) => { if (v > bestVal) { bestVal = v; best = i; } });
  if (bestVal === 0) return "—";
  const h12 = best % 12 === 0 ? 12 : best % 12;
  return `${h12}:00 ${best < 12 ? "AM" : "PM"}`;
}

function topItemLocal(orders: Order[]): string {
  if (orders.length === 0) return "—";
  const map = new Map<string, { name: string; qty: number }>();
  for (const o of orders) for (const it of o.items) {
    const cur = map.get(it.itemId) ?? { name: it.name, qty: 0 };
    cur.qty += it.qty;
    map.set(it.itemId, cur);
  }
  let best: { name: string; qty: number } | null = null;
  map.forEach((v) => { if (!best || v.qty > best.qty) best = v; });
  return best ? best.name : "—";
}
