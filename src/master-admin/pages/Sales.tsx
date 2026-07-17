import { useEffect, useMemo, useState } from "react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, CartesianGrid, Tooltip, XAxis, YAxis, Legend } from "recharts";
import Shell from "../components/Shell";
import { db } from "../db";
import { CHART_COLORS, axisStyle, daysAgoISO, inr, todayISO, tooltipStyle } from "../format";

type Range = "today" | "week" | "month" | "custom";
type Sale = { seller_id: string; date: string; total_orders: number; total_revenue: number };
type Product = { seller_id: string; product_name: string; total_sold: number };
type Spend = { payment_method: string | null; amount: number; created_at: string };

export default function Sales() {
  const [range, setRange] = useState<Range>("week");
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [sellers, setSellers] = useState<{ id: string; canteen_name: string }[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [spends, setSpends] = useState<Spend[]>([]);

  useEffect(() => {
    if (range === "today") { setFrom(todayISO()); setTo(todayISO()); }
    else if (range === "week") { setFrom(daysAgoISO(7)); setTo(todayISO()); }
    else if (range === "month") { setFrom(daysAgoISO(30)); setTo(todayISO()); }
  }, [range]);

  useEffect(() => {
    const unsubSellers = db.from("sellers").onSnapshot(({ data }) => {
      if (data) setSellers(data);
    });

    const unsubSales = db.from("seller_sales")
      .gte("date", from)
      .lte("date", to)
      .onSnapshot(({ data }) => {
        if (data) setSales(data);
      });

    const unsubProducts = db.from("seller_products").onSnapshot(({ data }) => {
      if (data) setProducts(data);
    });

    const unsubSpends = db.from("user_spend")
      .gte("created_at", from)
      .lte("created_at", to + "T23:59:59")
      .onSnapshot(({ data }) => {
        if (data) setSpends(data);
      });

    return () => {
      unsubSellers();
      unsubSales();
      unsubProducts();
      unsubSpends();
    };
  }, [from, to]);

  const totalGmv = sales.reduce((a,r) => a + Number(r.total_revenue), 0);
  const totalOrders = sales.reduce((a,r) => a + Number(r.total_orders), 0);
  const aov = totalOrders ? totalGmv / totalOrders : 0;
  const byDate = sales.reduce((m, r) => m.set(r.date, (m.get(r.date) ?? 0) + Number(r.total_revenue)), new Map<string, number>());
  const bestDay = [...byDate.entries()].sort((a,b) => b[1]-a[1])[0];

  const sellerById = Object.fromEntries(sellers.map((s) => [s.id, s.canteen_name]));

  const tableRows = useMemo(() => sellers.map((s) => {
    const rows = sales.filter((r) => r.seller_id === s.id);
    const revenue = rows.reduce((a,r) => a + Number(r.total_revenue), 0);
    const orders = rows.reduce((a,r) => a + Number(r.total_orders), 0);
    const top = products.filter((p) => p.seller_id === s.id).sort((a,b) => b.total_sold - a.total_sold)[0]?.product_name ?? "—";
    return { id: s.id, name: s.canteen_name, orders, revenue, aov: orders ? revenue / orders : 0, top };
  }).filter((r) => r.revenue > 0 || r.orders > 0).sort((a,b) => b.revenue - a.revenue), [sellers, sales, products]);

  const dates: string[] = useMemo(() => {
    const out: string[] = [];
    const start = new Date(from); const end = new Date(to);
    const d = new Date(start);
    while (d <= end) { out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate() + 1); }
    return out;
  }, [from, to]);

  const chartData = dates.map((d) => {
    const row: Record<string, string | number> = { date: d.slice(5) };
    sellers.forEach((s) => { row[s.canteen_name] = 0; });
    sales.filter((r) => r.date === d).forEach((r) => {
      const k = sellerById[r.seller_id] ?? "?";
      row[k] = Number(row[k] ?? 0) + Number(r.total_revenue);
    });
    return row;
  });

  const payment = spends.reduce((m, s) => { const k = (s.payment_method ?? "other").toUpperCase(); m.set(k, (m.get(k) ?? 0) + Number(s.amount)); return m; }, new Map<string, number>());
  const paymentData = [...payment.entries()].map(([name, value]) => ({ name, value }));

  const exportCsv = () => {
    const header = ["Seller","Orders","Revenue","Avg Order","Top Product"];
    const lines = [header.join(",")].concat(tableRows.map((r) => [r.name, r.orders, r.revenue, r.aov.toFixed(2), r.top].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sales_${from}_${to}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <Shell>
      <div className="ma-card" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(["today","week","month","custom"] as Range[]).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`ma-pill ${range === r ? "ma-pill-blue" : "ma-pill-gray"}`} style={{ cursor: "pointer", padding: "8px 16px", border: 0 }}>
            {r === "today" ? "Today" : r === "week" ? "This Week" : r === "month" ? "This Month" : "Custom"}
          </button>
        ))}
        {range === "custom" && (
          <>
            <input className="ma-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 170 }} />
            <input className="ma-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 170 }} />
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className="ma-btn ma-btn-outline" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="ma-grid-stats" style={{ marginBottom: 16 }}>
        <Stat label="Total GMV" value={inr(totalGmv)} />
        <Stat label="Orders" value={String(totalOrders)} />
        <Stat label="Avg order value" value={inr(aov)} />
        <Stat label="Best day" value={bestDay ? bestDay[0] : "—"} sub={bestDay ? inr(bestDay[1]) : ""} />
      </div>

      <div className="ma-card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Revenue by seller</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#1E1E2E" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
            {sellers.map((s, i) => <Line key={s.id} type="monotone" dataKey={s.canteen_name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="ma-grid-2">
        <div className="ma-card" style={{ padding: 0 }}>
          <h3 style={{ margin: "16px 16px 8px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Per seller</h3>
          <table className="ma-table">
            <thead><tr><th>Seller</th><th>Orders</th><th>Revenue</th><th>AOV</th><th>Top product</th></tr></thead>
            <tbody>
              {tableRows.length === 0 ? <tr><td colSpan={5} className="ma-empty">No data</td></tr>
                : tableRows.map((r) => <tr key={r.id}><td style={{ fontWeight: 700 }}>{r.name}</td><td>{r.orders}</td><td style={{ color: "#93C5FD" }}>{inr(r.revenue)}</td><td>{inr(r.aov)}</td><td>{r.top}</td></tr>)}
            </tbody>
          </table>
        </div>

        <div className="ma-card">
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Payment split</h3>
          {paymentData.length === 0 ? <div className="ma-empty">No payments tracked</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {paymentData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ma-card">
      <div style={{ fontSize: 12, color: "var(--ma-text-2)" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "white", marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--ma-text-3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}