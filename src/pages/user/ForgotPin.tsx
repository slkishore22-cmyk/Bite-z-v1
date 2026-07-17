import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { resetPin } from "@/lib/userAuth";
import { BitezBloom, btnStyle, lgStyle } from "./Login";

const ForgotPin = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-z0-9_]{3,30}$/.test(userId)) return toast.error("Enter your User ID");
    if (!/^\d{10,15}$/.test(phone)) return toast.error("Enter your registered phone number");
    if (!/^\d{4}$/.test(pin)) return toast.error("PIN must be 4 digits");
    if (pin !== confirm) return toast.error("PINs don't match");
    setLoading(true);
    try {
      await resetPin(userId, phone, pin);
      toast.success("PIN reset successfully");
      setTimeout(() => navigate("/app/login", { replace: true }), 1500);
    } catch (err) {
      toast.error((err as Error).message || "Could not reset PIN");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="user-page relative antialiased overflow-y-auto"
      style={{ color: "hsl(var(--user-text))", minHeight: "100dvh" }}
    >
      <BitezBloom />
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="fixed top-4 left-4 z-20 inline-flex items-center justify-center rounded-full"
        style={{
          width: 40, height: 40,
          background: "hsl(var(--user-surface) / 0.78)",
          backdropFilter: "blur(12px)",
          border: "1px solid hsl(var(--user-border) / 0.8)",
          boxShadow: "0 8px 22px hsl(220 25% 40% / 0.08)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#1D1D1F" }}>arrow_back</span>
      </button>

      <div className="user-content border-rose-200 pt-12 pb-16" style={{ maxWidth: 448 }}>
        <h1 className="font-semibold leading-tight mb-1"
          style={{ fontSize: 34, color: "#1D1D1F", letterSpacing: "-0.022em" }}>
          Reset PIN
        </h1>
        <p className="mb-6" style={{ fontSize: 17, color: "#6E6E73" }}>
          Enter your User ID to reset
        </p>

        <form onSubmit={submit} className="space-y-4">
          <Row icon="badge">
            <input
              type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={userId}
              onChange={(e) => setUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="Your User ID"
              className="flex-1 bg-transparent outline-none border-none"
              style={{ fontSize: 17, color: "#1D1D1F" }}
            />
          </Row>
          <Row icon="call">
            <input
              type="tel" inputMode="numeric" maxLength={15}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
              placeholder="Registered phone number"
              className="flex-1 bg-transparent outline-none border-none"
              style={{ fontSize: 17, color: "#1D1D1F" }}
            />
          </Row>
          <Row icon="lock">
            <input
              type="password" inputMode="numeric" maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="New PIN"
              className="flex-1 bg-transparent outline-none border-none font-medium"
              style={{ fontSize: 17, letterSpacing: "0.5em", color: "#1D1D1F" }}
            />
          </Row>
          <Row icon="lock">
            <input
              type="password" inputMode="numeric" maxLength={4}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Confirm PIN"
              className="flex-1 bg-transparent outline-none border-none font-medium"
              style={{ fontSize: 17, letterSpacing: "0.5em", color: "#1D1D1F" }}
            />
          </Row>
          <button type="submit" disabled={loading}
            className="w-full font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            style={btnStyle}>
            {loading ? "Resetting…" : "Reset PIN"}
          </button>
        </form>
      </div>
    </main>
  );
};

const Row = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div className="lg-input flex items-center px-5" style={lgStyle}>
    <span className="material-symbols-outlined mr-4"
      style={{ color: "#6E6E73", fontSize: 22 }}>{icon}</span>
    {children}
  </div>
);

export default ForgotPin;