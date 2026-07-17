import { useNavigate } from "react-router-dom";
import { useState } from "react";
import UserLayout from "@/components/user/UserLayout";
import { getUserSession } from "@/utils/sessionManager";
import { logoutUser } from "@/lib/userAuth";

const Profile = () => {
  const navigate = useNavigate();
  const s = getUserSession() as
    | { full_name?: string; name?: string; email?: string }
    | null;
  const fullName = s?.full_name || s?.name || "Friend";
  const initial = fullName.charAt(0).toUpperCase();
  const firstName = fullName.split(" ")[0];
  const handleLogout = async () => {
    await logoutUser();
    navigate("/app/login", { replace: true });
  };
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pressTimer, setPressTimer] = useState<number | null>(null);
  const startPress = () => {
    const t = window.setTimeout(() => setRevealed(true), 1500);
    setPressTimer(t);
  };
  const endPress = () => {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };
  return (
  <UserLayout>
    <div
      className="user-page pb-32 antialiased"
      style={{ color: "hsl(var(--user-text))" }}
    >
      <main className="user-content border-rose-200 user-content-readable pt-12">
        <h1 className="text-2xl font-bold tracking-tight mb-8">
          Hey, {firstName} 👋
        </h1>
        <div className="lg-card p-6">
          <div className="relative z-10 flex items-center gap-4">
            <div
              onMouseDown={startPress}
              onMouseUp={endPress}
              onMouseLeave={endPress}
              onTouchStart={startPress}
              onTouchEnd={endPress}
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ background: "#2563EB", color: "#fff", userSelect: "none", cursor: "pointer" }}
              aria-label="Hold to reveal account actions"
            >
              {initial}
            </div>
            <div>
              <p className="text-base font-semibold">{fullName}</p>
              <p className="text-sm" style={{ color: "#6E6E73" }}>
                {s?.email || ""}
              </p>
            </div>
          </div>
        </div>
        {revealed && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="mt-10 mx-auto block text-xs underline opacity-60 hover:opacity-100"
            style={{ color: "#8E8E93" }}
          >
            Sign out of this device
          </button>
        )}
        {confirming && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold mb-2" style={{ color: "#1D1D1F" }}>
                Sign out?
              </h2>
              <p className="text-sm mb-6" style={{ color: "#6E6E73" }}>
                You'll need your User ID and PIN to sign back in.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setConfirming(false); setRevealed(false); }}
                  className="flex-1 h-11 rounded-full font-semibold"
                  style={{ background: "#F2F2F7", color: "#1D1D1F" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 h-11 rounded-full font-semibold"
                  style={{ background: "#EF4444", color: "#fff" }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  </UserLayout>
  );
};

export default Profile;
