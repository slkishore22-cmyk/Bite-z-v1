import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { checkUserIdAvailable, signupUser } from "@/lib/userAuth";
import { BitezBloom, btnStyle, lgStyle } from "./Login";

type FormState = {
  fullName: string;
  userId: string;
  phone: string;
  collegeName: string;
  pin: string;
  confirmPin: string;
};

const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    fullName: "",
    userId: "",
    phone: "",
    collegeName: "",
    pin: "",
    confirmPin: "",
  });
  const [loading, setLoading] = useState(false);
  const [userIdError, setUserIdError] = useState("");

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { fullName, userId, phone, collegeName, pin, confirmPin } = form;
    setUserIdError("");
    if (fullName.trim().length < 2) return toast.error("Enter your full name");
    if (!/^[a-z0-9_]{3,30}$/.test(userId))
      return setUserIdError("3+ chars, lowercase letters, numbers or _");
    if (!/^\d{10}$/.test(phone)) return toast.error("Phone must be 10 digits");
    if (!collegeName.trim()) return toast.error("Enter your college");
    if (!/^\d{4}$/.test(pin)) return toast.error("PIN must be 4 digits");
    if (pin !== confirmPin) return toast.error("PINs don't match");

    setLoading(true);
    try {
      const available = await checkUserIdAvailable(userId);
      if (!available) {
        setUserIdError("User ID already taken");
        setLoading(false);
        return;
      }
      await signupUser({
        fullName: fullName.trim(),
        userId,
        phone,
        collegeName: collegeName.trim(),
        pin,
      });
      navigate("/app/home", { replace: true });
    } catch (err) {
      toast.error((err as Error).message || "Could not create account");
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
          width: 40,
          height: 40,
          background: "hsl(var(--user-surface) / 0.78)",
          backdropFilter: "blur(12px)",
          border: "1px solid hsl(var(--user-border) / 0.8)",
          boxShadow: "0 8px 22px hsl(220 25% 40% / 0.08)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#1D1D1F" }}>
          arrow_back
        </span>
      </button>

      <div className="user-content border-rose-200 pt-12 pb-16" style={{ maxWidth: 520 }}>
        <div className="px-2 mb-6">
          <h1
            className="font-semibold leading-tight mb-1"
            style={{ fontSize: 34, color: "#1D1D1F", letterSpacing: "-0.022em" }}
          >
            Create Account
          </h1>
          <p style={{ fontSize: 17, color: "#6E6E73" }}>Join Bitez today</p>
        </div>

        <form
          onSubmit={submit}
          className="user-card p-6 space-y-3.5"
          style={{ borderRadius: 20 }}
        >
          <Field icon="person" placeholder="Full Name"
            value={form.fullName} onChange={(v) => set("fullName", v)} autoComplete="name" />

          <div>
            <Field icon="badge" placeholder="Create User ID"
              value={form.userId}
              onChange={(v) => set("userId", v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              autoCapitalize="none" />
            {userIdError ? (
              <p className="ml-1 mt-1" style={{ fontSize: 12, color: "#EF4444" }}>{userIdError}</p>
            ) : (
              <p className="ml-1 mt-1" style={{ fontSize: 12, color: "#86868B" }}>
                This is your unique login ID
              </p>
            )}
          </div>

          <Field icon="call" placeholder="Phone Number" type="tel" inputMode="numeric"
            maxLength={10} value={form.phone}
            onChange={(v) => set("phone", v.replace(/\D/g, "").slice(0, 10))} autoComplete="tel" />

          <Field icon="school" placeholder="College Name"
            value={form.collegeName} onChange={(v) => set("collegeName", v)} />

          <PinField icon="lock" placeholder="Set Login PIN"
            value={form.pin} onChange={(v) => set("pin", v)} />

          <PinField icon="lock" placeholder="Confirm PIN"
            value={form.confirmPin} onChange={(v) => set("confirmPin", v)} />

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={btnStyle}
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <span style={{ fontSize: 15, color: "#6E6E73" }}>
            Already have an account?
          </span>{" "}
          <Link to="/app/login" className="font-bold ml-1"
            style={{ color: "#0071E3", fontSize: 15 }}>Sign In</Link>
        </div>
      </div>
    </main>
  );
};

type FieldProps = {
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  autoComplete?: string;
  autoCapitalize?: string;
};

const Field = ({ icon, placeholder, value, onChange, type = "text",
  inputMode, maxLength, autoComplete, autoCapitalize }: FieldProps) => (
  <div className="lg-input flex items-center px-5" style={lgStyle}>
    <span className="material-symbols-outlined mr-4"
      style={{ color: "#6E6E73", fontSize: 22 }}>{icon}</span>
    <input
      type={type}
      inputMode={inputMode}
      maxLength={maxLength}
      autoComplete={autoComplete}
      autoCapitalize={autoCapitalize}
      autoCorrect="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-transparent outline-none border-none"
      style={{ fontSize: 17, color: "#1D1D1F" }}
    />
  </div>
);

const PinField = ({ icon, placeholder, value, onChange }:
  Pick<FieldProps, "icon" | "placeholder" | "value" | "onChange">) => (
  <div className="lg-input flex items-center px-5" style={lgStyle}>
    <span className="material-symbols-outlined mr-4"
      style={{ color: "#6E6E73", fontSize: 22 }}>{icon}</span>
    <input
      type="password"
      inputMode="numeric"
      maxLength={4}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      className="flex-1 bg-transparent outline-none border-none font-medium"
      style={{ fontSize: 17, letterSpacing: "0.5em", color: "#1D1D1F" }}
    />
  </div>
);

export default Signup;