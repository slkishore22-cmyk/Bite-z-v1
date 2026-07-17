import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import { db } from "@/integrations/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { inr, todayISO } from "../format";

type Spend = { user_id: string; amount: number; product_names: string[] | null; created_at: string; payment_method: string | null };
type AppUser = { id: string; full_name: string; user_id: string; phone: string; college_name: string; created_at: string };

export default function Users() {
  const navigate = useNavigate();
  const [spends, setSpends] = useState<Spend[]>([]);
  const [analyticsToday, setAnalyticsToday] = useState<{ user_id: string | null }[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const revealFor = (id: string) => {
    setReveal((s) => ({ ...s, [id]: true }));
    window.setTimeout(() => {
      setReveal((s) => ({ ...s, [id]: false }));
    }, 5000);
  };

  useEffect(() => {
    (async () => {
      try {
        // 1. Get user spend history
        const spendsSnap = await getDocs(collection(db, "user_spend"));
        const spendsList = spendsSnap.docs.map((d) => d.data() as Spend);

        // 2. Get user analytics today
        const analyticsQuery = query(collection(db, "user_analytics"), where("created_at", ">=", todayISO()));
        const analyticsSnap = await getDocs(analyticsQuery);
        const analyticsList = analyticsSnap.docs.map((d) => d.data() as { user_id: string | null });

        // 3. Get all users
        const usersSnap = await getDocs(collection(db, "users"));
        const usersList = usersSnap.docs.map((d) => {
          const uData = d.data();
          return {
            id: d.id,
            full_name: uData.full_name || "",
            user_id: uData.user_id || "",
            phone: uData.phone || "",
            college_name: uData.college_name || "",
            created_at: uData.created_at || new Date().toISOString()
          };
        }) as AppUser[];

        setSpends(spendsList);
        setAnalyticsToday(analyticsList);
        setUsers(usersList);
      } catch (err) {
        console.warn("Firebase load users metrics failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = todayISO();
  const month = today.slice(0,7);

  const spendByUser = useMemo(() => {
    const m = new Map<string, number>();
    spends.forEach((s) => m.set(s.user_id, (m.get(s.user_id) ?? 0) + Number(s.amount)));
    return m;
  }, [spends]);

  const rows = useMemo(() => {
    const map = new Map<string, { user_id: string; today: number; mo: number; orders: number; total: number; fav: Record<string, number>; last: string }>();
    spends.forEach((s) => {
      const r = map.get(s.user_id) ?? { user_id: s.user_id, today: 0, mo: 0, orders: 0, total: 0, fav: {}, last: s.created_at };
      r.orders += 1;
      r.total += Number(s.amount);
      if (s.created_at.slice(0,10) === today) r.today += Number(s.amount);
      if (s.created_at.startsWith(month)) r.mo += Number(s.amount);
      (s.product_names ?? []).forEach((n) => r.fav[n] = (r.fav[n] ?? 0) + 1);
      if (s.created_at > r.last) r.last = s.created_at;
      map.set(s.user_id, r);
    });
    return [...map.values()].map((r) => ({
      ...r,
      avg: r.orders ? r.total / r.orders : 0,
      favItem: Object.entries(r.fav).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "—",
    })).sort((a,b) => b.total - a.total);
  }, [spends, today, month]);

  const totalUsersToday = new Set(spends.filter((s) => s.created_at.slice(0,10) === today).map((s) => s.user_id)).size;
  const totalUsersBrowsed = new Set(analyticsToday.map((a) => a.user_id).filter(Boolean)).size;
  const onlyBrowsed = Math.max(totalUsersBrowsed - totalUsersToday, 0);
  const todaySpend = spends.filter((s) => s.created_at.slice(0,10) === today);
  const avgSpendToday = todaySpend.length ? todaySpend.reduce((a,s) => a + Number(s.amount), 0) / new Set(todaySpend.map((s) => s.user_id)).size : 0;
  const topUserToday = [...todaySpend.reduce((m, s) => { m.set(s.user_id, (m.get(s.user_id) ?? 0) + Number(s.amount)); return m; }, new Map<string, number>())].sort((a,b) => b[1]-a[1])[0];

  return (
    <Shell>
      <div className="ma-grid-stats" style={{ marginBottom: 16 }}>
        <Stat label="Avg spend per user today" value={inr(avgSpendToday)} />
        <Stat label="Highest spending user today" value={topUserToday ? inr(topUserToday[1]) : "—"} sub={topUserToday ? topUserToday[0].slice(0,8) : ""} />
        <Stat label="Users who ordered today" value={String(totalUsersToday)} />
        <Stat label="Browsed only" value={String(onlyBrowsed)} />
      </div>

      <div className="ma-card" style={{ padding: 0, marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", color: "white", fontWeight: 700 }}>All Users</div>
        {users.length === 0 ? <div className="ma-empty">No users registered yet</div>
          : <div style={{ overflowX: "auto" }}>
              <table className="ma-table">
                <thead><tr><th>Full Name</th><th>User ID</th><th>Phone</th><th>College</th><th>Joined</th><th>Total Spend</th></tr></thead>
                <tbody>
                  {users.map((u) => {
                    const r = reveal[u.id];
                    return (
                      <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/master-admin/users/${u.id}`)}>
                        <td style={{ color: "white" }}>{u.full_name}</td>
                        <td style={{ fontFamily: "monospace" }}>{u.user_id}</td>
                        <td onClick={(e) => { e.stopPropagation(); if (!r) revealFor(u.id); }}>
                          {r ? u.phone : "•••• ••••"}
                        </td>
                        <td>{u.college_name}</td>
                        <td style={{ color: "var(--ma-text-2)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td style={{ color: "#93C5FD" }}>{inr(spendByUser.get(u.id) ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>}
      </div>

      <div className="ma-card" style={{ padding: 0 }}>
        {loading ? <div style={{ padding: 24 }}><div className="ma-skeleton" style={{ height: 200 }} /></div>
          : rows.length === 0 ? <div className="ma-empty">No user spend data yet</div>
          : <div style={{ overflowX: "auto" }}>
              <table className="ma-table">
                <thead><tr><th>User</th><th>Today</th><th>Month</th><th>Avg Order</th><th>Orders</th><th>Last Active</th><th>Favourite</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.user_id} style={{ cursor: "pointer" }} onClick={() => navigate(`/master-admin/users/${r.user_id}`)}>
                      <td style={{ fontFamily: "monospace", color: "white" }}>{r.user_id.slice(0,8)}…</td>
                      <td style={{ color: "#93C5FD" }}>{inr(r.today)}</td>
                      <td>{inr(r.mo)}</td>
                      <td>{inr(r.avg)}</td>
                      <td>{r.orders}</td>
                      <td style={{ color: "var(--ma-text-2)" }}>{new Date(r.last).toLocaleString()}</td>
                      <td>{r.favItem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </Shell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ma-card">
      <div style={{ fontSize: 12, color: "var(--ma-text-2)" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "white", marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--ma-text-3)", marginTop: 4, fontFamily: "monospace" }}>{sub}</div>}
    </div>
  );
}