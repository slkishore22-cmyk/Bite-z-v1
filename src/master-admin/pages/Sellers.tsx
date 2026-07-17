import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Shell from "../components/Shell";
import { db } from "@/integrations/firebase/client";
import { collection, getDocs, doc, updateDoc, query, where, onSnapshot } from "firebase/firestore";
import { logAudit } from "../auth";
import { inr, todayISO } from "../format";

type Seller = {
  id: string; name: string; canteen_name: string; phone: string;
  is_active: boolean; is_suspended: boolean; created_at: string;
};
type Sale = { seller_id: string; total_orders: number; total_revenue: number };

export default function Sellers() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [sortKey, setSortKey] = useState<"date" | "revenue" | "orders">("date");

  useEffect(() => {
    setLoading(true);

    const unsubSellers = onSnapshot(collection(db, "sellers"), (sellersSnap) => {
      const sellersList = sellersSnap.docs.map((d) => ({
        id: d.id,
        created_at: d.data().created_at || new Date().toISOString(),
        ...d.data()
      })) as Seller[];
      setSellers(sellersList);
      setLoading(false);
    }, (err) => {
      console.warn("Firebase load sellers failed:", err);
      toast.error("Failed to load sellers");
      setLoading(false);
    });

    const salesQuery = query(collection(db, "seller_sales"), where("date", "==", todayISO()));
    const unsubSales = onSnapshot(salesQuery, (salesSnap) => {
      const salesList = salesSnap.docs.map((d) => d.data()) as Sale[];
      setSales(salesList);
    }, (err) => {
      console.warn("Firebase load sales failed:", err);
    });

    return () => {
      unsubSellers();
      unsubSales();
    };
  }, []);

  const enriched = useMemo(() => {
    return sellers.map((s) => {
      const today = sales.filter((r) => r.seller_id === s.id);
      return {
        ...s,
        revenueToday: today.reduce((a, r) => a + Number(r.total_revenue || 0), 0),
        ordersToday: today.reduce((a, r) => a + Number(r.total_orders || 0), 0),
      };
    });
  }, [sellers, sales]);

  const filtered = useMemo(() => {
    let list = enriched.filter((s) => {
      if (status === "active" && (!s.is_active || s.is_suspended)) return false;
      if (status === "suspended" && !s.is_suspended) return false;
      const t = q.trim().toLowerCase();
      if (!t) return true;
      return (s.name || "").toLowerCase().includes(t) || (s.canteen_name || "").toLowerCase().includes(t) || (s.phone || "").includes(t);
    });
    list = list.sort((a, b) => {
      if (sortKey === "revenue") return b.revenueToday - a.revenueToday;
      if (sortKey === "orders") return b.ordersToday - a.ordersToday;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [enriched, q, status, sortKey]);

  const toggleSuspend = async (s: Seller) => {
    const next = !s.is_suspended;
    try {
      const docRef = doc(db, "sellers", s.id);
      await updateDoc(docRef, { 
        is_suspended: next,
        is_active: !next 
      });
      await logAudit(next ? "SELLER_SUSPENDED" : "SELLER_REACTIVATED", s.id, { canteen_name: s.canteen_name });
      toast.success(next ? "Seller suspended" : "Seller reactivated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update seller");
    }
  };

  return (
    <Shell>
      <div className="ma-card" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input className="ma-input" placeholder="Search name, canteen, phone…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select className="ma-input" value={status} onChange={(e) => setStatus(e.target.value as never)} style={{ width: 160 }}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select className="ma-input" value={sortKey} onChange={(e) => setSortKey(e.target.value as never)} style={{ width: 200 }}>
          <option value="date">Sort: Date joined</option>
          <option value="revenue">Sort: Revenue today</option>
          <option value="orders">Sort: Orders today</option>
        </select>
        <button className="ma-btn" onClick={() => navigate("/master-admin/sellers/new")}>+ New Seller</button>
      </div>

      <div className="ma-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 24 }}>{[0,1,2,3].map((i) => <div key={i} className="ma-skeleton" style={{ height: 36, marginBottom: 8 }} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="ma-empty">
            <span className="material-symbols-outlined" style={{ fontSize: 36, display: "block", marginBottom: 8 }}>store</span>
            No sellers yet. Create your first one.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="ma-table">
              <thead>
                <tr>
                  <th>Canteen</th><th>Seller</th><th>Phone</th><th>Status</th>
                  <th>Today's Revenue</th><th>Orders Today</th><th>Joined</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700, color: "white" }}>{s.canteen_name}</td>
                    <td style={{ color: "var(--ma-text-2)" }}>{s.name}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--ma-text-2)" }}>{s.phone}</td>
                    <td>
                      {s.is_suspended ? <span className="ma-pill ma-pill-red">Suspended</span>
                        : s.is_active ? <span className="ma-pill ma-pill-green">Active</span>
                        : <span className="ma-pill ma-pill-gray">Inactive</span>}
                    </td>
                    <td style={{ color: "#93C5FD", fontWeight: 700 }}>{inr(s.revenueToday)}</td>
                    <td>{s.ordersToday}</td>
                    <td style={{ color: "var(--ma-text-2)" }}>{new Date(s.created_at).toLocaleDateString()}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="ma-btn ma-btn-outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => navigate(`/master-admin/sellers/${s.id}`)}>View</button>
                      <button className={`ma-btn ${s.is_suspended ? "ma-btn-success" : "ma-btn-danger"}`} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => toggleSuspend(s)}>
                        {s.is_suspended ? "Reactivate" : "Suspend"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}