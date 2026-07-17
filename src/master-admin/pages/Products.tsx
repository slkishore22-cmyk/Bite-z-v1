import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import Shell from "../components/Shell";
import { db } from "../db";
import { CHART_COLORS, inr, tooltipStyle } from "../format";

type Product = { id: string; seller_id: string; product_name: string; emoji: string | null; price: number; category: string | null; total_sold: number; total_revenue: number; is_active: boolean; last_sold_at: string | null };

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Record<string, string>>({});
  const [sellerFilter, setSellerFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"revenue" | "sold" | "price">("revenue");

  useEffect(() => { (async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      db.from("seller_products").select("*"),
      db.from("sellers").select("id, canteen_name"),
    ]);
    setProducts(p ?? []);
    setSellers(Object.fromEntries((s ?? []).map((x: { id: string; canteen_name: string }) => [x.id, x.canteen_name])));
  })(); }, []);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (sellerFilter !== "all") list = list.filter((p) => p.seller_id === sellerFilter);
    if (catFilter !== "all") list = list.filter((p) => (p.category ?? "").toLowerCase() === catFilter);
    if (statusFilter === "active") list = list.filter((p) => p.is_active);
    if (statusFilter === "inactive") list = list.filter((p) => !p.is_active);
    if (statusFilter === "dead") list = list.filter((p) => p.total_sold === 0);
    list.sort((a,b) => sortKey === "sold" ? b.total_sold - a.total_sold : sortKey === "price" ? Number(b.price) - Number(a.price) : Number(b.total_revenue) - Number(a.total_revenue));
    return list;
  }, [products, sellerFilter, catFilter, statusFilter, sortKey]);

  const top5 = [...products].sort((a,b) => b.total_sold - a.total_sold).slice(0, 5);
  const bottom5 = [...products].sort((a,b) => a.total_sold - b.total_sold).slice(0, 5);

  const byCat = (key: "total_revenue" | "total_sold") => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.category ?? "Other", (m.get(p.category ?? "Other") ?? 0) + Number(p[key] || 0)));
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  };

  return (
    <Shell>
      <div className="ma-grid-2" style={{ marginBottom: 16 }}>
        <div className="ma-card" style={{ borderColor: "#FBBF24" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#FBBF24", textTransform: "uppercase", letterSpacing: "0.06em" }}>★ Top 5 platform-wide</h3>
          {top5.length === 0 ? <div className="ma-empty">No products</div> : top5.map((p, i) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--ma-border)" }}>
              <span>{i+1}. {p.emoji ?? "•"} {p.product_name} <span style={{ color: "var(--ma-text-3)", fontSize: 11 }}>· {sellers[p.seller_id] ?? "—"}</span></span>
              <span style={{ color: "#93C5FD" }}>{p.total_sold} · {inr(p.total_revenue)}</span>
            </div>
          ))}
        </div>
        <div className="ma-card" style={{ borderColor: "#7F1D1D" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#FCA5A5", textTransform: "uppercase", letterSpacing: "0.06em" }}>⚠ Dead stock — bottom 5</h3>
          {bottom5.length === 0 ? <div className="ma-empty">No products</div> : bottom5.map((p) => {
            const days = p.last_sold_at ? Math.floor((Date.now() - new Date(p.last_sold_at).getTime()) / 86400000) : null;
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--ma-border)" }}>
                <span>{p.emoji ?? "•"} {p.product_name} <span style={{ color: "var(--ma-text-3)", fontSize: 11 }}>· {sellers[p.seller_id] ?? "—"}</span></span>
                <span style={{ color: "#FCA5A5", fontSize: 12 }}>{days == null ? "Never sold" : `${days}d ago`}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ma-grid-3" style={{ marginBottom: 16 }}>
        <CatChart title="Revenue by category" data={byCat("total_revenue")} />
        <CatChart title="Units sold by category" data={byCat("total_sold")} />
        <div className="ma-card">
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Top seller per category</h3>
          {["Food","Snacks","Drinks"].map((c) => {
            const top = products.filter((p) => (p.category ?? "").toLowerCase() === c.toLowerCase()).sort((a,b) => b.total_sold - a.total_sold)[0];
            return <div key={c} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--ma-border)" }}>
              <span>{c}</span><span style={{ color: "var(--ma-text-2)" }}>{top ? `${top.emoji ?? ""} ${top.product_name}` : "—"}</span>
            </div>;
          })}
        </div>
      </div>

      <div className="ma-card" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="ma-input" value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} style={{ width: 200 }}>
          <option value="all">All sellers</option>
          {Object.entries(sellers).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="ma-input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ width: 160 }}>
          <option value="all">All categories</option><option value="food">Food</option><option value="snacks">Snacks</option><option value="drinks">Drinks</option>
        </select>
        <select className="ma-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160 }}>
          <option value="all">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="dead">Dead stock</option>
        </select>
        <select className="ma-input" value={sortKey} onChange={(e) => setSortKey(e.target.value as never)} style={{ width: 180 }}>
          <option value="revenue">Sort: Revenue</option><option value="sold">Sort: Units sold</option><option value="price">Sort: Price</option>
        </select>
      </div>

      <div className="ma-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="ma-table">
          <thead><tr><th></th><th>Product</th><th>Canteen</th><th>Cat</th><th>Price</th><th>Sold</th><th>Revenue</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={8} className="ma-empty">No products</td></tr>
              : filtered.map((p) => <tr key={p.id}>
                <td>{p.emoji ?? "•"}</td><td>{p.product_name}</td><td>{sellers[p.seller_id] ?? "—"}</td>
                <td>{p.category ?? "—"}</td><td>{inr(p.price)}</td><td>{p.total_sold}</td>
                <td style={{ color: "#93C5FD" }}>{inr(p.total_revenue)}</td>
                <td>{p.total_sold === 0 ? <span className="ma-pill ma-pill-red">Dead</span> : p.is_active ? <span className="ma-pill ma-pill-green">Active</span> : <span className="ma-pill ma-pill-gray">Inactive</span>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function CatChart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div className="ma-card">
      <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h3>
      {data.length === 0 ? <div className="ma-empty">No data</div> : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}