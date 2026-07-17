import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Shell from "../components/Shell";
import { db } from "../db";
import { axisStyle, daysAgoISO, inr, tooltipStyle } from "../format";

type Spend = { order_id: string | null; seller_id: string | null; amount: number; payment_method: string | null; product_names: string[] | null; created_at: string };
type Analytics = { screen_name: string; dwell_seconds: number; session_id: string | null; created_at: string };

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [spends, setSpends] = useState<Spend[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [sellers, setSellers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: sp }, { data: an }, { data: sl }] = await Promise.all([
        db.from("user_spend").select("order_id, seller_id, amount, payment_method, product_names, created_at").eq("user_id", id),
        db.from("user_analytics").select("screen_name, dwell_seconds, session_id, created_at").eq("user_id", id),
        db.from("sellers").select("id, canteen_name"),
      ]);
      setSpends(sp ?? []);
      const cutoff = daysAgoISO(30);
      setAnalytics((an ?? []).filter((r: any) => r.created_at >= cutoff));
      setSellers(Object.fromEntries((sl ?? []).map((s: { id: string; canteen_name: string }) => [s.id, s.canteen_name])));
    })();
  }, [id]);

  const dailySpend = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 29; i >= 0; i--) m.set(daysAgoISO(i), 0);
    spends.forEach((s) => {
      const d = s.created_at.slice(0,10);
      if (m.has(d)) m.set(d, (m.get(d) ?? 0) + Number(s.amount));
    });
    return [...m.entries()].map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [spends]);

  const products = useMemo(() => {
    const m = new Map<string, { count: number; spend: number }>();
    spends.forEach((s) => (s.product_names ?? []).forEach((n) => {
      const r = m.get(n) ?? { count: 0, spend: 0 };
      r.count += 1; r.spend += Number(s.amount) / Math.max((s.product_names ?? []).length, 1);
      m.set(n, r);
    }));
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a,b) => b.count - a.count).slice(0, 10);
  }, [spends]);

  const sessions = new Set(analytics.map((a) => a.session_id).filter(Boolean));
  const totalDwell = analytics.reduce((a, r) => a + r.dwell_seconds, 0);
  const avgSession = sessions.size ? totalDwell / sessions.size : 0;
  const screens = analytics.reduce((m, r) => m.set(r.screen_name, (m.get(r.screen_name) ?? 0) + r.dwell_seconds), new Map<string, number>());
  const mostVisited = [...screens.entries()].sort((a,b) => b[1] - a[1])[0];

  const totalSpend = spends.reduce((a,s) => a + Number(s.amount), 0);
  const days = Math.max(1, Math.ceil((Date.now() - new Date(spends.at(-1)?.created_at ?? Date.now()).getTime()) / (86400000)));
  const months = Math.max(1, days / 30);

  return (
    <Shell>
      <button className="ma-btn ma-btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>← Back</button>
      <div className="ma-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>User</div>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: "white" }}>{id}</div>
      </div>

      <div className="ma-grid-stats" style={{ marginBottom: 16 }}>
        <Stat label="Total spend" value={inr(totalSpend)} />
        <Stat label="Avg / day" value={inr(totalSpend / days)} />
        <Stat label="Avg / month" value={inr(totalSpend / months)} />
        <Stat label="Avg session time" value={`${Math.round(avgSession)}s`} sub={mostVisited ? `Most visited: ${mostVisited[0]}` : ""} />
      </div>

      <div className="ma-card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Spend timeline (30 days)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailySpend}>
            <CartesianGrid stroke="#1E1E2E" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="amount" fill="#2563EB" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="ma-grid-2">
        <div className="ma-card">
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Top purchased</h3>
          {products.length === 0 ? <div className="ma-empty">No purchases yet</div> : products.map((p) => (
            <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--ma-border)" }}>
              <span>{p.name}</span><span style={{ color: "var(--ma-text-2)" }}>{p.count}x · {inr(p.spend)}</span>
            </div>
          ))}
        </div>

        <div className="ma-card">
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Last 10 orders</h3>
          <table className="ma-table">
            <thead><tr><th>Date</th><th>Items</th><th>Amount</th><th>Pay</th><th>Canteen</th></tr></thead>
            <tbody>
              {spends.slice().sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0, 10).map((s, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td style={{ fontSize: 12 }}>{(s.product_names ?? []).join(", ") || "—"}</td>
                  <td>{inr(s.amount)}</td>
                  <td>{s.payment_method ?? "—"}</td>
                  <td>{s.seller_id ? sellers[s.seller_id] ?? "—" : "—"}</td>
                </tr>
              ))}
              {spends.length === 0 && <tr><td colSpan={5} className="ma-empty">No orders</td></tr>}
            </tbody>
          </table>
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