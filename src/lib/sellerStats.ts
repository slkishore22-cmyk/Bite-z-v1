// Pure helpers that aggregate Order data into the shapes the seller-side
// dashboards expect. Kept dependency-free so the dashboards can call them
// in `useMemo` without re-hitting localStorage.

import type { Order } from "./sellerOrders";
import type { SellerCategory } from "./sellerInventory";

export type RangeKey = "today" | "week" | "month";

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export function rangeBounds(range: RangeKey, ref: Date = new Date()): { from: number; to: number } {
  const to = ref.getTime();
  const start = startOfDay(ref);
  if (range === "today") return { from: start.getTime(), to };
  if (range === "week") {
    const d = new Date(start);
    d.setDate(d.getDate() - 6);
    return { from: d.getTime(), to };
  }
  // month
  const d = new Date(start);
  d.setDate(d.getDate() - 29);
  return { from: d.getTime(), to };
}

export function ordersInRange(orders: Order[], from: number, to: number): Order[] {
  // Sales aggregations include only orders that have been recorded as sales:
  //  - Online: recorded immediately on payment success
  //  - COD: recorded only when the order is completed
  // Cancelled and Expired orders are excluded.
  return orders.filter(
    (o) =>
      o.createdAt >= from &&
      o.createdAt <= to &&
      o.status !== "Cancelled" &&
      o.status !== "Expired" &&
      o.isSalesRecorded === true,
  );
}

export function totalRevenue(orders: Order[]): number {
  return orders.reduce((s, o) => s + o.total, 0);
}

export function totalUnits(orders: Order[]): number {
  return orders.reduce(
    (s, o) => s + o.items.reduce((x, i) => x + i.qty, 0),
    0,
  );
}

export type CategorySummary = {
  category: SellerCategory;
  totalSold: number;
  revenue: number;
  items: { name: string; sold: number; revenue: number }[];
};

export function summariseByCategory(orders: Order[]): CategorySummary[] {
  const cats = new Map<
    SellerCategory,
    {
      totalSold: number;
      revenue: number;
      items: Map<string, { name: string; sold: number; revenue: number }>;
    }
  >();

  for (const o of orders) {
    for (const it of o.items) {
      const c = cats.get(it.category) ?? {
        totalSold: 0,
        revenue: 0,
        items: new Map(),
      };
      c.totalSold += it.qty;
      c.revenue += it.qty * it.price;
      const cur = c.items.get(it.itemId) ?? {
        name: it.name,
        sold: 0,
        revenue: 0,
      };
      cur.sold += it.qty;
      cur.revenue += it.qty * it.price;
      c.items.set(it.itemId, cur);
      cats.set(it.category, c);
    }
  }

  return Array.from(cats.entries()).map(([category, v]) => ({
    category,
    totalSold: v.totalSold,
    revenue: v.revenue,
    items: Array.from(v.items.values()).sort((a, b) => b.sold - a.sold),
  }));
}

/** Hour buckets across the day for the dashboard chart. */
export function hourlySales(orders: Order[], ref: Date = new Date()): { time: string; value: number }[] {
  const day = startOfDay(ref).getTime();
  const buckets: number[] = Array.from({ length: 12 }, () => 0);
  for (const o of orders) {
    if (o.createdAt < day) continue;
    const h = new Date(o.createdAt).getHours();
    const idx = Math.min(11, Math.max(0, Math.floor(h / 2)));
    buckets[idx] += o.total;
  }
  const labels = [
    "12 AM", "02 AM", "04 AM", "06 AM",
    "08 AM", "10 AM", "12 PM", "02 PM",
    "04 PM", "06 PM", "08 PM", "10 PM",
  ];
  return buckets.map((value, i) => ({ time: labels[i], value }));
}

export function peakHourLabel(orders: Order[]): string {
  const hours = new Array(24).fill(0);
  for (const o of orders) hours[new Date(o.createdAt).getHours()] += o.total;
  let best = 0;
  let bestVal = 0;
  hours.forEach((v, i) => {
    if (v > bestVal) {
      bestVal = v;
      best = i;
    }
  });
  if (bestVal === 0) return "—";
  const h12 = best % 12 === 0 ? 12 : best % 12;
  const ap = best < 12 ? "AM" : "PM";
  return `${h12}:00 ${ap}`;
}

export function topItem(orders: Order[]): string {
  const map = new Map<string, { name: string; qty: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = map.get(it.itemId) ?? { name: it.name, qty: 0 };
      cur.qty += it.qty;
      map.set(it.itemId, cur);
    }
  }
  let best: { name: string; qty: number } | null = null;
  map.forEach((v) => {
    if (!best || v.qty > best.qty) best = v;
  });
  return best ? best.name : "—";
}