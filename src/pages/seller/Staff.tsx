import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  addStaff,
  getStaff,
  nextStaffToken,
  removeStaff as removeStaffMember,
  subscribeStaff,
  type StaffMember,
} from "@/lib/sellerStaff";

const SellerStaff = () => {
  const [staff, setStaff] = useState<StaffMember[]>(() => getStaff());
  const [name, setName] = useState("");
  const [staffId, setStaffId] = useState(() => nextStaffToken());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => subscribeStaff(() => setStaff(getStaff())), []);
  useEffect(() => {
    // Keep the suggested token id in sync with the live list when not edited.
    setStaffId((current) => (current.startsWith("token_") ? nextStaffToken() : current));
  }, [staff.length]);

  const activeCount = useMemo(() => staff.length, [staff.length]);

  const createStaff = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedStaffId = staffId.trim();

    if (!trimmedName || !trimmedStaffId || password.length < 4) {
      toast.error("Add name, staff ID and password");
      return;
    }

    if (staff.some((member) => member.staffId.toLowerCase() === trimmedStaffId.toLowerCase())) {
      toast.error("Staff ID already exists");
      return;
    }

    addStaff({ name: trimmedName, staffId: trimmedStaffId, password });
    setName("");
    setPassword("");
    setStaffId(nextStaffToken());
    toast.success("Staff created");
  };

  const removeStaff = (id: string) => {
    removeStaffMember(id);
  };

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
          <p className="text-xl font-extrabold tracking-tight">Staff Management</p>
        </header>

        <section className="mt-10">
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
            Administration
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Create Staff</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
            Add staff for billing and token management
          </p>
        </section>

        <form onSubmit={createStaff} className="mt-6 rounded-3xl border border-border bg-gradient-card p-5 shadow-card">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Staff Name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter staff name"
            className="mt-2 w-full rounded-full border-0 bg-secondary/70 px-5 py-3.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-primary/60"
          />

          <label className="mt-5 block text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Staff ID
          </label>
          <div className="mt-2 flex items-center rounded-full bg-secondary/70 px-5 py-3.5 focus-within:ring-2 focus-within:ring-primary/60">
            <input
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              placeholder="Create staff ID"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/70 outline-none"
            />
            <span className="ml-3 shrink-0 text-xs font-extrabold text-muted-foreground">token_01</span>
          </div>

          <label className="mt-5 block text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Password
          </label>
          <div className="mt-2 flex items-center rounded-full bg-secondary/70 px-5 py-3.5 focus-within:ring-2 focus-within:ring-primary/60">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Create password"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/70 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl bg-secondary/45 px-4 py-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  verified_user
                </span>
              </span>
              <p className="truncate text-base font-extrabold">Billing Staff</p>
            </div>
            <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
              Default
            </span>
          </div>

          <button
            type="submit"
            className="mt-7 w-full rounded-full bg-primary py-3.5 text-base font-extrabold text-primary-foreground shadow-glow transition hover:bg-primary/90"
          >
            Create Staff
          </button>
        </form>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-extrabold tracking-tight">Staff Members</h2>
            <span className="rounded-full bg-muted px-4 py-1.5 text-xs font-extrabold text-muted-foreground">
              {activeCount} Active
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {staff.map((member) => (
              <article
                key={member.id}
                className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-border bg-gradient-card px-4 py-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-extrabold leading-tight">{member.name}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">{member.staffId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeStaff(member.id)}
                  aria-label={`Delete ${member.name}`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-destructive transition hover:bg-destructive/10"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                    delete
                  </span>
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default SellerStaff;