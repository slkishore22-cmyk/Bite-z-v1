import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStoredUserId, loginWithPin, clearLocalSession } from "@/lib/userAuth";
import { getUserSession } from "@/utils/sessionManager";
import { auth } from "@/integrations/firebase/client";

const UserLogin = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [userId, setUserId] = useState(() => getStoredUserId());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);
  const shakeTimer = useRef<number | null>(null);

  useEffect(() => {
    const checkRedirect = () => {
      const session = getUserSession();
      const currentUser = auth.currentUser;
      if (session && currentUser) {
        navigate("/app/home", { replace: true });
      } else if (session && !currentUser) {
        clearLocalSession();
      }
    };

    checkRedirect();
    const t = setTimeout(checkRedirect, 100);
    return () => clearTimeout(t);
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!/^[a-z0-9_]{3,30}$/.test(userId.trim().toLowerCase())) {
      setErrorMsg("Enter your User ID");
      triggerShake();
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setErrorMsg("Enter your 4-digit PIN");
      triggerShake();
      return;
    }
    setLoading(true);
    try {
      await loginWithPin(userId.trim().toLowerCase(), pin);
      navigate("/app/home", { replace: true });
    } catch (err) {
      setErrorMsg((err as Error).message || "Incorrect User ID or PIN");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShake(false), 500);
  };

  return (
    <main
      className="user-page relative flex flex-col items-center justify-start sm:justify-center antialiased overflow-y-auto pt-6 pb-16"
      style={{ color: "hsl(var(--user-text))", minHeight: "100dvh" }}
    >
      <BitezBloom />
      <div className="pt-4 pb-6 flex flex-col items-center justify-center">
        <h1
          className="font-extrabold tracking-tight leading-none mb-4 bitez-glow"
          style={{ fontSize: 44, color: "#1D1D1F" }}
        >
          Bitez
        </h1>
        <div className="flex items-center gap-2">
          <span
            className="font-semibold uppercase"
            style={{ fontSize: 13, color: "#86868B", letterSpacing: "0.05em" }}
          >
            FRESH. FAST. YOURS.
          </span>
          <span
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              background: "#0071E3",
              animation: "bitez-pulse 3s infinite ease-in-out",
            }}
          />
        </div>
      </div>

      <div className="user-content border-rose-200" style={{ maxWidth: 448 }}>
        <h2
          className="text-center mb-2"
          style={{ fontSize: 24, fontWeight: 700, color: "#1D1D1F" }}
        >
          Welcome back
        </h2>
        <p
          className="text-center mb-10"
          style={{ fontSize: 15, color: "#86868B" }}
        >
          Sign in to continue
        </p>

        <form onSubmit={submit} className="space-y-8">
          <div>
            <label
              className="block ml-1 mb-2 uppercase font-semibold tracking-wider"
              style={{ fontSize: 13, color: "#86868B" }}
            >
              ENTER USER ID
            </label>
            <div
              className="lg-input flex items-center px-5"
              style={{
                ...lgStyle,
                animation: shake ? "bitez-shake 0.5s" : undefined,
              }}
            >
              <span
                className="material-symbols-outlined mr-4"
                style={{ color: "#8E8E93", fontSize: 22 }}
              >
                badge
              </span>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={userId}
                onChange={(e) =>
                  setUserId(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  )
                }
                placeholder="your_user_id"
                className="flex-1 bg-transparent outline-none border-none font-medium"
                style={{ fontSize: 17, color: "#1D1D1F" }}
              />
            </div>
          </div>

          <div>
            <label
              className="block ml-1 mb-2 uppercase font-semibold tracking-wider"
              style={{ fontSize: 13, color: "#86868B" }}
            >
              ENTER LOGIN PIN
            </label>
            <div
              className="lg-input flex items-center px-5"
              style={{
                ...lgStyle,
                animation: shake ? "bitez-shake 0.5s" : undefined,
              }}
            >
              <span
                className="material-symbols-outlined mr-4"
                style={{ color: "#8E8E93", fontSize: 22 }}
              >
                dialpad
              </span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="••••"
                className="flex-1 bg-transparent outline-none border-none font-medium"
                style={{
                  fontSize: 20,
                  letterSpacing: "0.5em",
                  color: "#1D1D1F",
                }}
                autoFocus
              />
            </div>
            {errorMsg && (
              <div
                className="ml-1 mt-2"
                style={{ fontSize: 13, color: "#EF4444" }}
              >
                {errorMsg}
              </div>
            )}
            <div className="text-right pr-1 mt-3">
              <Link
                to="/app/forgot-pin"
                className="font-medium"
                style={{ color: "#0071E3", fontSize: 14 }}
              >
                Forgot PIN?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            style={btnStyle}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-4 sm:mt-8 text-center">
          <span style={{ fontSize: 15, color: "#86868B" }}>
            Don't have an account?
          </span>{" "}
          <Link
            to="/app/signup"
            className="font-bold ml-1"
            style={{ color: "#0071E3", fontSize: 15 }}
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
};

export const lgStyle: React.CSSProperties = {
  background: "hsl(var(--user-surface) / 0.66)",
  backdropFilter: "blur(18px) saturate(145%)",
  WebkitBackdropFilter: "blur(18px) saturate(145%)",
  border: "1px solid hsl(var(--user-border) / 0.82)",
  boxShadow: "0 8px 24px hsl(220 25% 40% / 0.08)",
  height: 64,
  borderRadius: 12,
};

export const btnStyle: React.CSSProperties = {
  background: "#0071E3",
  borderRadius: 9999,
  height: 54,
  fontSize: 17,
  color: "#FFFFFF",
  boxShadow: "0 4px 14px 0 rgba(0,113,227,0.3)",
};

export const BitezBloom = () => (
  <div
    aria-hidden
    className="absolute -translate-x-1/2 rounded-full pointer-events-none"
    style={{
      top: "-10%",
      left: "50%",
      width: 600,
      height: 600,
      background: "hsl(212 82% 66% / 0.12)",
      filter: "blur(100px)",
    }}
  />
);

export default UserLogin;