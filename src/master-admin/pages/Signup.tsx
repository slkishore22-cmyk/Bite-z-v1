import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signUpMasterAdmin } from "../auth";
import "../theme.css";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentNumber, setDepartmentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!collegeName.trim()) {
      setError("College Name is required");
      return;
    }

    if (!departmentName.trim()) {
      setError("Department Name is required");
      return;
    }

    if (!departmentNumber.trim()) {
      setError("Department Number is required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await signUpMasterAdmin(
        trimmedEmail,
        password,
        collegeName,
        departmentName,
        departmentNumber
      );
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration request failed");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="ma-root" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <div style={{
          width: "100%", maxWidth: 460, background: "#111118",
          borderRadius: 20, padding: "40px 48px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          border: "1px solid var(--ma-border)",
          textAlign: "center"
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "rgba(16,185,129,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px auto",
          }}>
            <span className="material-symbols-outlined" style={{ color: "#10B981", fontSize: 30 }}>mark_email_read</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "white", margin: 0 }}>Request Submitted</h1>
          
          <div style={{ margin: "20px 0", padding: "16px 20px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ fontSize: 13, color: "#9CA3AF", lineHeight: "1.6", margin: 0 }}>
              Your admin account request for <strong>{email}</strong> has been registered in Firebase.
            </p>
            <p style={{ fontSize: 13, color: "#EF4444", fontWeight: "600", marginTop: 12, marginBottom: 0 }}>
              ⚠️ Access Pending Approval
            </p>
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 6, marginBottom: 0 }}>
              Please ask the developer to approve your account document in the Firestore `admins` collection before logging in.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/master-admin/login")}
            className="ma-btn"
            style={{ width: "100%", padding: "12px 20px", fontSize: 15 }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ma-root" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <form onSubmit={submit} style={{
        width: "100%", maxWidth: 465, background: "#111118",
        borderRadius: 20, padding: "40px 44px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        border: "1px solid var(--ma-border)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: "rgba(37,99,235,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14,
          }}>
            <span className="material-symbols-outlined" style={{ color: "#2563EB", fontSize: 28 }}>person_add</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "white", margin: 0 }}>Request Access</h1>
          <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4, textAlign: "center" }}>
            Register new Master Admin account request
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="ma-label">Email ID</label>
          <input className="ma-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@college.edu" required />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="ma-label">College Name</label>
          <input className="ma-input" value={collegeName} onChange={(e) => setCollegeName(e.target.value)} placeholder="e.g. Engineering College" required />
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="ma-label">Dept Name</label>
            <input className="ma-input" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="e.g. CSE" required />
          </div>
          <div style={{ flex: 1 }}>
            <label className="ma-label">Dept Number</label>
            <input className="ma-input" value={departmentNumber} onChange={(e) => setDepartmentNumber(e.target.value)} placeholder="e.g. 101" required />
          </div>
        </div>
        
        <div style={{ marginBottom: 14, position: "relative" }}>
          <label className="ma-label">Password</label>
          <input className="ma-input" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required style={{ paddingRight: 44 }} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label="Toggle password" style={{
            position: "absolute", right: 12, top: 32,
            background: "transparent", border: 0, color: "#6B7280", cursor: "pointer",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{show ? "visibility_off" : "visibility"}</span>
          </button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="ma-label">Confirm Password</label>
          <input className="ma-input" type={show ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
        </div>

        {error && <div style={{ color: "#FCA5A5", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={loading} className="ma-btn" style={{ width: "100%", padding: "14px 20px", fontSize: 16 }}>
          {loading ? "Submitting request…" : "Submit Request"}
        </button>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>Already have an account? </span>
          <button
            type="button"
            onClick={() => navigate("/master-admin/login")}
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
            Sign In
          </button>
        </div>
      </form>
    </div>
  );
}
