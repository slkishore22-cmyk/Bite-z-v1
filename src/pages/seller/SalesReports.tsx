import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getOrders, loadOrdersFromBackend, subscribeOrders, type Order } from "@/lib/sellerOrders";
import { ordersInRange, summariseByCategory, totalRevenue } from "@/lib/sellerStats";
import { getSellerSession } from "@/utils/sessionManager";
import { db } from "@/integrations/firebase/client";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const CATEGORY_ICON: Record<string, string> = {
  Food: "restaurant",
  Snacks: "bakery_dining",
  Drinks: "local_bar",
};

const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const formatINRShort = (n: number) =>
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n}`;

const SalesReports = () => {
  // Default: last 30 days.
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
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
      console.warn("Firestore sales reports orders realtime listener failed:", err);
    });

    return () => {
      unsub();
      unsubRealtime();
    };
  }, []);

  const ranged = useMemo(
    () => ordersInRange(orders, startDate.getTime(), endDate.getTime()),
    [orders, startDate, endDate],
  );
  const totalSales = useMemo(() => totalRevenue(ranged), [ranged]);
  const totalOrders = ranged.length;
  const avgPerDay = useMemo(() => {
    const days = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
    );
    return Math.round(totalSales / days);
  }, [totalSales, startDate, endDate]);
  const categories = useMemo(() => summariseByCategory(ranged), [ranged]);
  const effectiveOpenKey = openKey ?? categories[0]?.category ?? null;

  return (
    <div className="seller-admin-shell">
      <div className="seller-admin-content">
        {/* Header */}
        <header className="flex items-center gap-3">
          <Link
            to="/seller/sales"
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Sales Reports</h1>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              Active View: Analytics
            </p>
          </div>
        </header>

        {/* Date range */}
        <section className="mt-6 grid grid-cols-2 gap-3">
          <DateField label="Start Date" value={startDate} onChange={setStartDate} />
          <DateField label="End Date" value={endDate} onChange={setEndDate} />
        </section>

        <button
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-glow transition hover:bg-primary/90"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            insights
          </span>
          View Report
        </button>

        {/* Totals */}
        <section className="mt-6 rounded-3xl border border-border bg-gradient-card p-5 shadow-card">
          <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground">
            TOTAL SALES
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <p className="text-4xl font-extrabold tracking-tight">{formatINR(totalSales)}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
              +12.4% ↑
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-secondary/50 px-4 py-3">
              <p className="text-lg font-extrabold">{totalOrders.toLocaleString("en-IN")}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Orders
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/50 px-4 py-3">
              <p className="text-lg font-extrabold">{formatINRShort(avgPerDay)}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Avg / Day
              </p>
            </div>
          </div>
        </section>

        {/* Category breakdown */}
        <section className="mt-7">
          <h2 className="text-lg font-extrabold tracking-tight">Category Breakdown</h2>

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
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                        {CATEGORY_ICON[cat.category] ?? "restaurant"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold leading-tight">{cat.category}</p>
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        {cat.totalSold.toLocaleString("en-IN")} items sold
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-right">
                      <span className="text-base font-extrabold text-primary">
                        {formatINR(cat.revenue)}
                      </span>
                      <span
                        className="material-symbols-outlined text-muted-foreground transition-transform"
                        style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
                      >
                        {open ? "expand_more" : "chevron_right"}
                      </span>
                    </div>
                  </button>

                  {open && (
                    <div className="space-y-2 border-t border-border/60 bg-secondary/30 p-3">
                      {cat.items.map((it) => (
                        <div
                          key={it.name}
                          className="flex items-center justify-between rounded-xl bg-background/60 px-4 py-2.5"
                        >
                          <span className="truncate text-sm font-semibold">{it.name}</span>
                          <span className="text-sm font-bold text-primary">
                            {it.sold} qty
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold text-muted-foreground">
          <a href="#" className="transition hover:text-foreground">Support</a>
          <span className="opacity-40">•</span>
          <a href="#" className="transition hover:text-foreground">Privacy Policy</a>
          <span className="opacity-40">•</span>
          <a href="#" className="transition hover:text-foreground">System Status</a>
        </footer>
      </div>
    </div>
  );
};

export default SalesReports;

type DateFieldProps = {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
};

const DateField = ({ label, value, onChange }: DateFieldProps) => (
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
