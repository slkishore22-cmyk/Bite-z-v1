import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Shell from "../components/Shell";
import { db } from "../db";
import { CHART_COLORS, axisStyle, daysAgoISO, inr, todayISO, tooltipStyle } from "../format";
import { toast } from "sonner";

type Seller = { id: string; canteen_name: string; is_active: boolean; is_suspended: boolean };
type Sale = { seller_id: string; date: string; total_orders: number; total_revenue: number };

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeUsersToday, setActiveUsersToday] = useState(0);
  const [mode, setMode] = useState<"qr" | "online">("qr");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initial load from localStorage for preview testing
    const localMode = localStorage.getItem("order_processing_mode");
    if (localMode === "online" || localMode === "qr") {
      setMode(localMode as "qr" | "online");
    }

    let loadedCount = 0;
    const checkLoading = () => {
      loadedCount++;
      if (loadedCount >= 4) {
        setLoading(false);
      }
    };

    const unsubSellers = db.from("sellers").onSnapshot(({ data }) => {
      if (data) setSellers(data);
      checkLoading();
    });

    const unsubSales = db.from("seller_sales")
      .gte("date", daysAgoISO(30))
      .onSnapshot(({ data }) => {
        if (data) setSales(data);
        checkLoading();
      });

    const unsubAnalytics = db.from("user_analytics")
      .gte("created_at", todayISO())
      .onSnapshot(({ data }) => {
        if (data) {
          const uniq = new Set(data.map((r: any) => r.user_id).filter(Boolean));
          setActiveUsersToday(uniq.size);
        }
        checkLoading();
      });

    const unsubSettings = db.from("app_settings")
      .eq("key", "order_processing_mode")
      .onSnapshot(({ data }) => {
        const modeData = data && data.length > 0 ? data[0] : null;
        if (modeData?.value === "online") {
          setMode("online");
          localStorage.setItem("order_processing_mode", "online");
        } else if (modeData?.value === "qr") {
          setMode("qr");
          localStorage.setItem("order_processing_mode", "qr");
        }
        checkLoading();
      });

    return () => {
      unsubSellers();
      unsubSales();
      unsubAnalytics();
      unsubSettings();
    };
  }, []);

  const today = todayISO();
  const yesterday = daysAgoISO(1);
  const todayRows = sales.filter((s) => s.date === today);
  const ydayRows = sales.filter((s) => s.date === yesterday);
  const gmvToday = todayRows.reduce((a, r) => a + Number(r.total_revenue || 0), 0);
  const gmvYday = ydayRows.reduce((a, r) => a + Number(r.total_revenue || 0), 0);
  const ordersToday = todayRows.reduce((a, r) => a + Number(r.total_orders || 0), 0);
  const activeSellers = sellers.filter((s) => s.is_active && !s.is_suspended).length;

  const change = gmvYday > 0 ? ((gmvToday - gmvYday) / gmvYday) * 100 : null;

  // Build per-day per-seller line chart data (last 30 days)
  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) dates.push(daysAgoISO(i));
  const sellerById = Object.fromEntries(sellers.map((s) => [s.id, s.canteen_name]));
  const trendData = dates.map((d) => {
    const row: Record<string, string | number> = { date: d.slice(5) };
    sellers.forEach((s) => { row[s.canteen_name] = 0; });
    sales.filter((r) => r.date === d).forEach((r) => {
      const k = sellerById[r.seller_id] ?? "?";
      row[k] = Number(row[k] ?? 0) + Number(r.total_revenue || 0);
    });
    return row;
  });

  const top5 = [...sellers]
    .map((s) => ({
      name: s.canteen_name,
      revenue: todayRows.filter((r) => r.seller_id === s.id).reduce((a, r) => a + Number(r.total_revenue || 0), 0),
    }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const distribution = sellers.map((s) => ({
    name: s.canteen_name,
    value: todayRows.filter((r) => r.seller_id === s.id).reduce((a, r) => a + Number(r.total_orders || 0), 0),
  })).filter((r) => r.value > 0);

  // Alerts
  const alerts: string[] = [];
  sellers.forEach((s) => {
    if (!s.is_active || s.is_suspended) return;
    const t = todayRows.find((r) => r.seller_id === s.id);
    if (!t || t.total_orders === 0) alerts.push(`⚠ ${s.canteen_name} — no sales today`);
    const last3 = sales.filter((r) => r.seller_id === s.id && r.date >= daysAgoISO(3));
    if (last3.length === 0) alerts.push(`⚠ ${s.canteen_name} — inactive 3 days`);
  });

  const handleSaveChanges = async () => {
    setSaving(true);
    localStorage.setItem("order_processing_mode", mode);
    try {
      const { error } = await db.from("app_settings").upsert({
        key: "order_processing_mode",
        value: mode,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Order processing mode updated successfully!");
    } catch (e) {
      console.warn("Could not save to remote database, saved locally instead", e);
      toast.success("Order processing mode saved locally for testing!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell>
      {loading ? (
        <div className="ma-grid-stats">
          {[0,1,2,3].map((i) => <div key={i} className="ma-skeleton" style={{ height: 110 }} />)}
        </div>
      ) : (
        <>
          <div className="ma-grid-stats">
            <StatCard icon="payments" tone="#2563EB" value={inr(gmvToday)} label="Gross Merchandise Value · Today"
              sub={change == null ? "no data yesterday" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% vs yesterday`}
              subColor={change == null ? "#6B7280" : change >= 0 ? "#22C55E" : "#EF4444"} />
            <StatCard icon="store" tone="#22C55E" value={String(activeSellers)} label="Active canteens" sub={`${sellers.length} total`} />
            <StatCard icon="shopping_bag" tone="#F59E0B" value={String(ordersToday)} label="Orders across all canteens" />
            <StatCard icon="group" tone="#8B5CF6" value={String(activeUsersToday)} label="Unique users active today" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginTop: 16 }} className="ma-overview-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="ma-card">
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Revenue trend (30 days)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData}>
                    <CartesianGrid stroke="#1E1E2E" />
                    <XAxis dataKey="date" tick={axisStyle} />
                    <YAxis tick={axisStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
                    {sellers.map((s, i) => (
                      <Line key={s.id} type="monotone" dataKey={s.canteen_name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="ma-grid-2">
                <div className="ma-card">
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Top 5 sellers today</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={top5} layout="vertical" margin={{ left: 30 }}>
                      <CartesianGrid stroke="#1E1E2E" />
                      <XAxis type="number" tick={axisStyle} />
                      <YAxis dataKey="name" type="category" tick={axisStyle} width={100} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="revenue" fill="#2563EB" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="ma-card">
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Order distribution today</h3>
                  {distribution.length === 0 ? (
                    <div className="ma-empty">No orders yet today</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                          {distribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <aside style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: "var(--ma-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Alerts</h3>
              {alerts.length === 0 ? (
                <div className="ma-card" style={{ borderColor: "#1E3D1E", background: "#0A1A0A", color: "#86EFAC" }}>
                  All canteens healthy ✓
                </div>
              ) : alerts.map((a, i) => (
                <div key={i} className="ma-card" style={{ background: "#1A0A0A", borderColor: "#3D1515", padding: 14, fontSize: 13 }}>
                  {a}
                </div>
              ))}
            </aside>
          </div>

          {/* Order Processing Mode Configuration Card */}
          <div
            className="ma-card"
            style={{
              marginTop: 24,
              background: "var(--ma-surface)",
              border: "1px solid var(--ma-border)",
              borderRadius: 16,
              padding: 24,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ma-text)" }}>
              Order Processing Mode
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--ma-text-2)" }}>
              Choose how orders are processed for this canteen.
            </p>

            <hr style={{ border: 0, borderTop: "1px solid var(--ma-border)", margin: "16px 0" }} />

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="radio"
                name="order_processing_mode"
                value="qr"
                checked={mode === "qr"}
                onChange={() => setMode("qr")}
                style={{
                  marginTop: 4,
                  accentColor: "var(--ma-primary)",
                  cursor: "pointer",
                  transform: "scale(1.1)",
                }}
              />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ma-text)" }}>
                  QR Payment Mode
                </span>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--ma-text-2)", lineHeight: 1.5 }}>
                  Customer pays at the billing counter using any UPI application after the QR code is scanned.
                </p>
              </div>
            </label>

            <hr style={{ border: 0, borderTop: "1px solid var(--ma-border)", margin: "16px 0" }} />

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="radio"
                name="order_processing_mode"
                value="online"
                checked={mode === "online"}
                onChange={() => setMode("online")}
                style={{
                  marginTop: 4,
                  accentColor: "var(--ma-primary)",
                  cursor: "pointer",
                  transform: "scale(1.1)",
                }}
              />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ma-text)" }}>
                  Online Payment Mode
                </span>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--ma-text-2)", lineHeight: 1.5 }}>
                  Customer pays instantly through Razorpay and receives a Digital Bill.
                </p>
              </div>
            </label>

            <hr style={{ border: 0, borderTop: "1px solid var(--ma-border)", margin: "16px 0" }} />

            <div>
              <button
                type="button"
                className="ma-btn"
                disabled={saving}
                onClick={handleSaveChanges}
                style={{
                  padding: "10px 24px",
                  borderRadius: 9999,
                  fontWeight: 700,
                  fontSize: 14,
                  background: "var(--ma-primary)",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving changes..." : "Save Changes"}
              </button>
            </div>
          </div>

          <DangerZone />
        </>
      )}
    </Shell>
  );
}

function StatCard({ icon, tone, value, label, sub, subColor }: {
  icon: string; tone: string; value: string; label: string; sub?: string; subColor?: string;
}) {
  return (
    <div className="ma-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="ma-stat-icon" style={{ background: `${tone}22`, color: tone }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "white", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--ma-text-2)" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: subColor ?? "var(--ma-text-3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const resetBtnStyle: React.CSSProperties = {
    background: "#7F1D1D",
    color: "#FCA5A5",
    borderRadius: 9999,
    padding: "10px 24px",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      // 1. Clear local storage first to ensure clean state
      if (typeof window !== "undefined") {
        Object.keys(window.localStorage).forEach((key) => {
          if (key.toLowerCase().startsWith("bitez")) {
            window.localStorage.removeItem(key);
          }
        });
      }

      // 2. Clear remote tables, catching errors if collections don't exist yet
      const labels = [
        "user_analytics", "user_spend", "seller_sessions", "seller_sales",
        "seller_products", "orders", "sellers",
      ];
      for (const table of labels) {
        try {
          const { data, error: readError } = await db.from(table).select("id");
          if (!readError && data) {
            for (const row of data) {
              await db.from(table).delete().eq("id", row.id);
            }
          }
        } catch (tableErr) {
          console.warn(`Could not clear table ${table}:`, tableErr);
        }
      }

      toast.success("App reset complete. All data cleared.");
      setOpen(false);
      setConfirmText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="ma-card"
        style={{
          marginTop: 24,
          border: "1px solid #7F1D1D",
          background: "#1A0A0A",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, color: "#FCA5A5", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Danger Zone
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ma-text-2)" }}>
          Permanently delete all sellers, inventory, orders and user data. This action cannot be undone.
        </p>
        <div>
          <button type="button" style={resetBtnStyle} onClick={() => setOpen(true)}>
            Factory Reset
          </button>
        </div>
      </div>

      {open && (
        <div
          onClick={() => !busy && setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0F0F1A", border: "1px solid #7F1D1D", borderRadius: 12,
              padding: 24, maxWidth: 460, width: "90%", display: "flex", flexDirection: "column", gap: 14,
            }}
          >
            <h3 style={{ margin: 0, color: "#FCA5A5", fontSize: 18 }}>Factory Reset</h3>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ma-text-2)", lineHeight: 1.5 }}>
              This will permanently delete ALL sellers, inventory, orders and user data. This cannot be undone. Type <strong style={{ color: "#FCA5A5" }}>RESET</strong> to confirm.
            </p>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET"
              style={{
                padding: "10px 12px", borderRadius: 8, border: "1px solid #2A2A3A",
                background: "#1A1A2A", color: "white", fontSize: 14, outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setOpen(false); setConfirmText(""); }}
                style={{
                  padding: "10px 20px", borderRadius: 9999, background: "transparent",
                  border: "1px solid #2A2A3A", color: "var(--ma-text-2)", cursor: "pointer", fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || confirmText !== "RESET"}
                onClick={handleReset}
                style={{ ...resetBtnStyle, opacity: busy || confirmText !== "RESET" ? 0.5 : 1 }}
              >
                {busy ? "Resetting…" : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}