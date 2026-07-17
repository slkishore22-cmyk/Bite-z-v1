import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession, logAudit } from "../auth";
import { clearAdminSession } from "@/utils/sessionManager";
import { useAdminPwa } from "../useAdminPwa";
import SeedDataAlert from "./SeedDataAlert";
import "../theme.css";

const NAV = [
  { to: "/master-admin/overview", label: "Overview", icon: "home" },
  { to: "/master-admin/sellers", label: "Sellers", icon: "store" },
  { to: "/master-admin/sellers/new", label: "Create Seller", icon: "add_circle" },
  { to: "/master-admin/users", label: "User Analytics", icon: "group" },
  { to: "/master-admin/sales", label: "Sales Reports", icon: "bar_chart" },
  { to: "/master-admin/behaviour", label: "Behaviour Insights", icon: "visibility" },
  { to: "/master-admin/products", label: "Product Performance", icon: "inventory_2" },
  { to: "/master-admin/audit", label: "Audit Log", icon: "schedule" },
];

const PAGE_TITLES: Record<string, string> = {
  "/master-admin/overview": "Overview",
  "/master-admin/sellers": "Sellers",
  "/master-admin/sellers/new": "Create Seller",
  "/master-admin/users": "User Analytics",
  "/master-admin/sales": "Sales Reports",
  "/master-admin/behaviour": "Behaviour Insights",
  "/master-admin/products": "Product Performance",
  "/master-admin/audit": "Audit Log",
};

function pageTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/master-admin/sellers/")) return "Seller Detail";
  if (pathname.startsWith("/master-admin/users/")) return "User Detail";
  return "Master Control";
}

export default function Shell({ children }: { children: React.ReactNode }) {
  useAdminPwa();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(() => new Date());
  const session = getSession();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const signOut = async () => {
    await logAudit("ADMIN_LOGOUT", session?.username);
    clearSession();
    clearAdminSession();
    navigate("/master-admin/login", { replace: true });
  };

  return (
    <div className="ma-root">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div className="ma-shell">
        <aside className={`ma-sidebar ${open ? "open" : ""}`}>
          <div className="ma-sidebar-brand">
            <div className="ma-sidebar-brand-dot">B</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Bitez</div>
              <div style={{ fontSize: 10, color: "var(--ma-text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Master Control
              </div>
            </div>
          </div>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/master-admin/sellers"}
              className={({ isActive }) => `ma-nav-item ${isActive ? "active" : ""}`}
            >
              <span className="material-symbols-outlined">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          <button onClick={signOut} className="ma-nav-item" style={{ width: "100%", background: "none", border: 0, marginTop: 12, textAlign: "left" }}>
            <span className="material-symbols-outlined">logout</span>
            Sign Out
          </button>
        </aside>

        <div className="ma-main">
          <header className="ma-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="ma-btn-ghost ma-mobile-toggle"
                onClick={() => setOpen((v) => !v)}
                style={{ background: "transparent", border: 0, color: "white", cursor: "pointer" }}
                aria-label="Toggle menu"
              >
                <span className="material-symbols-outlined">menu</span>
              </button>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: "white", margin: 0 }}>
                {pageTitle(location.pathname)}
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="ma-pill ma-pill-blue">Master Admin</span>
              <span style={{ color: "var(--ma-text-2)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {time.toLocaleTimeString()}
              </span>
              <button onClick={signOut} className="ma-btn ma-btn-ghost" style={{ padding: "6px 14px" }}>
                Sign Out
              </button>
            </div>
          </header>
          <main className="ma-page">
            <SeedDataAlert />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}