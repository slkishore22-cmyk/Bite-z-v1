import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getProfile, loadCurrentSellerProfile, saveProfileToBackend, type SellerProfile } from "@/lib/sellerProfile";
import { clearSellerSession as clearLegacySellerSession } from "@/lib/sellerAuth";
import { clearSellerSession } from "@/utils/sessionManager";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";

const canteenIcons = ["🍽️", "🍛", "🍔", "🍕", "🏪", "🥗", "☕"];

type Profile = Omit<SellerProfile, "id">;

const toDraft = (p: SellerProfile): Profile => {
  const { id: _id, ...rest } = p;
  return rest;
};

const SellerSettings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(() => toDraft(getProfile()));
  const [draft, setDraft] = useState<Profile>(profile);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const isComplete = useMemo(
    () =>
      Boolean(
        profile.canteenName.trim() &&
          profile.slogan.trim() &&
          profile.ownerPhone.trim() &&
          profile.accountNumber.trim() &&
          profile.ifsc.trim() &&
          profile.upiId.trim()
      ),
    [profile]
  );

  const [isEditing, setIsEditing] = useState(!isComplete);

  useEffect(() => {
    if (!isComplete) setIsEditing(true);
  }, [isComplete]);

  useEffect(() => {
    loadCurrentSellerProfile()
      .then((p) => {
        const next = toDraft(p);
        setProfile(next);
        setDraft(next);
      })
      .catch(() => null);
  }, []);

  const startEdit = () => {
    setDraft(profile);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (!isComplete) {
      toast.error("Complete your profile to continue");
      return;
    }
    setDraft(profile);
    setIsEditing(false);
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const required: Array<[keyof Profile, string]> = [
      ["canteenName", "Canteen Name"],
      ["slogan", "Slogan"],
      ["ownerPhone", "Owner Phone Number"],
      ["accountNumber", "Account Number"],
      ["ifsc", "IFSC Code"],
      ["upiId", "UPI ID"],
    ];
    for (const [k, label] of required) {
      if (!draft[k].trim()) {
        toast.error(`${label} is required`);
        return;
      }
    }
    try {
      const saved = await saveProfileToBackend(draft);
      setProfile(toDraft(saved));
      if (newPassword || currentPassword) {
        setCurrentPassword("");
        setNewPassword("");
        toast.success("Profile & password updated");
      } else {
        toast.success("Profile saved");
      }
      setIsEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    }
  };

  const updateDraft = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="seller-admin-shell">
      <main className="seller-admin-content">
        <header className="flex items-center gap-3">
          <Link
            to="/seller/dashboard"
            aria-label="Back to dashboard"
            className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              arrow_back
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold tracking-tight">Profile</h1>
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
              {isEditing ? "Manage your canteen profile and payments" : "Your canteen at a glance"}
            </p>
          </div>
          {!isEditing && isComplete && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-xs font-bold text-foreground transition hover:bg-secondary/80"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                edit
              </span>
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              clearSellerSession();
              clearLegacySellerSession();
              toast.success("Logged out");
              navigate("/seller/login", { replace: true });
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3.5 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/25"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              logout
            </span>
            Logout
          </button>
        </header>

        {!isEditing && isComplete ? (
          <section className="mt-10 flex flex-col items-center text-center">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-gradient-card text-7xl shadow-glow ring-2 ring-primary/30">
              {profile.icon}
            </div>
            <h2 className="mt-6 text-2xl font-extrabold tracking-tight">{profile.canteenName}</h2>
            <p className="mt-2 max-w-xs text-sm font-medium italic text-muted-foreground">
              "{profile.slogan}"
            </p>
            <div className="mt-8 w-full">
              <PushNotificationSettings />
            </div>
          </section>
        ) : (
          <form onSubmit={saveSettings} className="mt-7 space-y-5">
            <section className="rounded-3xl border border-border bg-gradient-card p-5 shadow-card">
              <SectionTitle icon="storefront" title="Canteen Details" />
              <SettingsInput
                label="Canteen Name"
                placeholder="Enter canteen name"
                value={draft.canteenName}
                onChange={(v) => updateDraft("canteenName", v)}
              />
              <SettingsInput
                label="Slogan"
                placeholder="Enter slogan"
                value={draft.slogan}
                onChange={(v) => updateDraft("slogan", v)}
              />
              <SettingsInput
                label="Owner Phone Number"
                placeholder="Enter phone number"
                inputMode="tel"
                value={draft.ownerPhone}
                onChange={(v) => updateDraft("ownerPhone", v)}
              />

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
                  CANTEEN ICON SELECTION
                </p>
                <div className="mt-3 grid grid-cols-7 gap-2 overflow-x-hidden">
                  {canteenIcons.map((icon) => {
                    const active = icon === draft.icon;
                    return (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => updateDraft("icon", icon)}
                        aria-label={`Select canteen icon ${icon}`}
                        className={`grid aspect-square w-full place-items-center rounded-2xl bg-secondary/70 text-xl transition ${
                          active ? "ring-2 ring-primary shadow-glow" : "hover:bg-secondary"
                        }`}
                      >
                        {icon}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-gradient-card p-5 shadow-card">
              <SectionTitle icon="payments" title="Payment Details" />
              <SettingsInput
                label="Account Number"
                placeholder="Enter account number"
                inputMode="numeric"
                value={draft.accountNumber}
                onChange={(v) => updateDraft("accountNumber", v)}
              />
              <SettingsInput
                label="IFSC Code"
                placeholder="Enter IFSC code"
                value={draft.ifsc}
                onChange={(v) => updateDraft("ifsc", v)}
              />
              <SettingsInput
                label="UPI ID"
                placeholder="name@bank"
                value={draft.upiId}
                onChange={(v) => updateDraft("upiId", v)}
              />
            </section>

            <section className="rounded-3xl border border-border bg-gradient-card p-5 shadow-card">
              <SectionTitle icon="qr_code_scanner" title="Flutter Printer Scanner Integration" />
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
                  Use this API key and endpoint to configure your Flutter mobile scanning application (connected to a thermal printer).
                </p>
                <div className="rounded-2xl bg-secondary/40 p-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">API Endpoint URL</span>
                    <p className="text-xs font-mono select-all bg-secondary/80 px-2.5 py-1.5 rounded-lg border border-border mt-1 break-all">
                      {(import.meta.env.VITE_SUPABASE_URL || "https://umayieigsqcbxgaqwssu.supabase.co") + "/functions/v1/scan-order"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">API Key Header (x-api-key)</span>
                    <p className="text-xs font-mono select-all bg-secondary/80 px-2.5 py-1.5 rounded-lg border border-border mt-1">
                      bitez_flutter_scanner_secret_2026
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-gradient-card p-5 shadow-card">
              <SectionTitle icon="lock_reset" title="Change Password" />
              <SettingsInput
                label="Current Password"
                placeholder="Enter current password"
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
              />
              <SettingsInput
                label="New Password"
                placeholder="Enter new password"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
              />
            </section>

            <div className="flex gap-3">
              {isComplete && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 rounded-full bg-secondary py-3.5 text-base font-extrabold text-foreground transition hover:bg-secondary/80"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex flex-1 items-center justify-center gap-3 rounded-full bg-primary py-3.5 text-base font-extrabold text-primary-foreground shadow-glow transition hover:bg-primary/90"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  save
                </span>
                Save Changes
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};

const SectionTitle = ({ icon, title }: { icon: string; title: string }) => (
  <div className="mb-5 flex items-center gap-3">
    <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
      <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
        {icon}
      </span>
    </span>
    <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
  </div>
);

const SettingsInput = ({
  label,
  placeholder,
  type = "text",
  inputMode,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  value: string;
  onChange: (v: string) => void;
}) => (
  <label className="mt-5 block first:mt-0">
    <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
      {label.toUpperCase()}
    </span>
    <input
      type={type}
      inputMode={inputMode}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2 w-full rounded-full bg-secondary/70 px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-primary/60"
    />
  </label>
);

export default SellerSettings;
