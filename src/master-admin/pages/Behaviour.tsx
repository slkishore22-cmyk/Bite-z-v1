import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Shell from "../components/Shell";
import { db } from "../db";
import { axisStyle, tooltipStyle } from "../format";

type A = { screen_name: string; event_type: string; dwell_seconds: number; scroll_depth_pct: number; session_id: string | null };

export default function Behaviour() {
  const [rows, setRows] = useState<A[]>([]);
  useEffect(() => { (async () => { const { data } = await db.from("user_analytics").select("screen_name, event_type, dwell_seconds, scroll_depth_pct, session_id").limit(5000); setRows(data ?? []); })(); }, []);

  const dwellByScreen = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    rows.filter((r) => r.event_type === "screen_view").forEach((r) => {
      const c = m.get(r.screen_name) ?? { sum: 0, n: 0 };
      c.sum += r.dwell_seconds; c.n += 1; m.set(r.screen_name, c);
    });
    return [...m.entries()].map(([screen, v]) => ({ screen, avg: Math.round(v.sum / v.n) })).sort((a,b) => b.avg - a.avg);
  }, [rows]);

  const scrollByScreen = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    rows.forEach((r) => { const c = m.get(r.screen_name) ?? { sum: 0, n: 0 }; c.sum += r.scroll_depth_pct; c.n += 1; m.set(r.screen_name, c); });
    return [...m.entries()].map(([screen, v]) => ({ screen, avg: Math.round(v.sum / v.n), n: v.n })).sort((a,b) => b.avg - a.avg);
  }, [rows]);

  const taps = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.event_type === "tap").forEach((r) => m.set(r.screen_name, (m.get(r.screen_name) ?? 0) + 1));
    return [...m.entries()].map(([screen, count]) => ({ screen, count })).sort((a,b) => b.count - a.count);
  }, [rows]);

  const sessionDurations = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => { if (!r.session_id) return; m.set(r.session_id, (m.get(r.session_id) ?? 0) + r.dwell_seconds); });
    const buckets = [{ b: "0-30s", c: 0 }, { b: "30s-2m", c: 0 }, { b: "2-5m", c: 0 }, { b: "5-10m", c: 0 }, { b: "10m+", c: 0 }];
    [...m.values()].forEach((d) => {
      if (d <= 30) buckets[0].c++; else if (d <= 120) buckets[1].c++;
      else if (d <= 300) buckets[2].c++; else if (d <= 600) buckets[3].c++; else buckets[4].c++;
    });
    return buckets;
  }, [rows]);

  const funnel = useMemo(() => {
    const counts = ["Menu", "Cart", "Checkout", "Payment", "OrderStatus"].map((s) => {
      const sessions = new Set(rows.filter((r) => r.screen_name === s).map((r) => r.session_id).filter(Boolean));
      return { step: s, count: sessions.size };
    });
    return counts;
  }, [rows]);

  const tag = (p: number) => p >= 80 ? <span className="ma-pill ma-pill-green">High engagement</span>
    : p >= 40 ? <span className="ma-pill ma-pill-amber">Medium</span>
    : <span className="ma-pill ma-pill-red">Drop-off risk</span>;

  return (
    <Shell>
      <div className="ma-card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Where users spend the most time</h3>
        {dwellByScreen.length === 0 ? <div className="ma-empty">No analytics yet</div> : (
          <ResponsiveContainer width="100%" height={Math.max(220, dwellByScreen.length * 32)}>
            <BarChart data={dwellByScreen} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid stroke="#1E1E2E" />
              <XAxis type="number" tick={axisStyle} />
              <YAxis dataKey="screen" type="category" tick={axisStyle} width={110} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avg" fill="#2563EB" radius={[0,6,6,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="ma-grid-2" style={{ marginBottom: 16 }}>
        <div className="ma-card" style={{ padding: 0 }}>
          <h3 style={{ margin: "16px 16px 8px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Scroll depth</h3>
          <table className="ma-table">
            <thead><tr><th>Screen</th><th>Avg %</th><th>Sessions</th><th>Engagement</th></tr></thead>
            <tbody>
              {scrollByScreen.length === 0 ? <tr><td colSpan={4} className="ma-empty">No data</td></tr>
                : scrollByScreen.map((r) => <tr key={r.screen}><td>{r.screen}</td><td>{r.avg}%</td><td>{r.n}</td><td>{tag(r.avg)}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="ma-card">
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Most tapped screens</h3>
          {taps.length === 0 ? <div className="ma-empty">No taps logged</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={taps.slice(0, 8)}>
                <CartesianGrid stroke="#1E1E2E" />
                <XAxis dataKey="screen" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#22C55E" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="ma-grid-2">
        <div className="ma-card">
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Session duration</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sessionDurations}>
              <CartesianGrid stroke="#1E1E2E" />
              <XAxis dataKey="b" tick={axisStyle} />
              <YAxis tick={axisStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="c" fill="#F59E0B" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="ma-card">
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Drop-off funnel</h3>
          {funnel.map((f, i) => {
            const prev = funnel[0]?.count || 1;
            const pct = Math.round((f.count / prev) * 100);
            const drop = i > 0 ? Math.round(((funnel[i-1].count - f.count) / Math.max(funnel[i-1].count, 1)) * 100) : 0;
            return (
              <div key={f.step} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{f.step}</span><span style={{ color: "var(--ma-text-2)" }}>{f.count} · {pct}%</span>
                </div>
                <div style={{ height: 8, background: "#1E1E2E", borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "#2563EB" }} />
                </div>
                {i > 0 && drop > 0 && <div style={{ fontSize: 11, color: "#FCA5A5", marginTop: 2 }}>↓ {drop}% drop-off</div>}
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}