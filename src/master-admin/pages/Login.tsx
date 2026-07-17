import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, loginMasterAdmin, setSession, clearSession, logAudit } from "../auth";
import { useAdminPwa } from "../useAdminPwa";
import { auth } from "@/integrations/firebase/client";
import "../theme.css";

export default function Login() {
  const navigate = useNavigate();
  useAdminPwa();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const unsub = auth.onAuthStateChanged((user) => {
      if (!alive) return;
      const session = getSession();
      if (session && user) {
        navigate("/master-admin/overview", { replace: true });
      } else if (session && !user) {
        clearSession();
      }
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Wipe any prior admin session (different account, legacy key, etc.)
      // BEFORE establishing the new one — prevents identity overlap.
      clearSession();

      const ok = await loginMasterAdmin(username.trim(), password);
      if (!ok) {
        setError("Invalid credentials");
        return;
      }
      
      setSession(username.trim());
      await logAudit("ADMIN_LOGIN", username.trim());
      navigate("/master-admin/overview", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ma-root" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <form onSubmit={submit} style={{
        width: "100%", maxWidth: 420, background: "#111118",
        borderRadius: 20, padding: "40px 48px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        border: "1px solid var(--ma-border)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "rgba(37,99,235,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}>
            <span className="material-symbols-outlined" style={{ color: "#2563EB", fontSize: 30 }}>verified_user</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", margin: 0 }}>Master Control</h1>
          <p style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
            Restricted access · Authorised personnel only
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="ma-label">Username or Email</label>
          <input className="ma-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </div>
        <div style={{ marginBottom: 16, position: "relative" }}>
          <label className="ma-label">Password</label>
          <input className="ma-input" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required style={{ paddingRight: 44 }} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label="Toggle password" style={{
            position: "absolute", right: 12, top: 32,
            background: "transparent", border: 0, color: "#6B7280", cursor: "pointer",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{show ? "visibility_off" : "visibility"}</span>
          </button>
        </div>

        {error && <div style={{ color: "#FCA5A5", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={loading} className="ma-btn" style={{ width: "100%", padding: "14px 20px", fontSize: 16 }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>Need an account? </span>
          <button
            type="button"
            onClick={() => navigate("/master-admin/signup")}
            style={{
              background: "transparent",
              border: 0,
              color: "#2563EB",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Request Access
          </button>
        </div>

        <p style={{ fontSize: 11, color: "#6B7280", marginTop: 20, textAlign: "center" }}>
          Sessions expire after 8 hours of inactivity.
        </p>
      </form>
    </div>
  );
}