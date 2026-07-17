import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  getInventory,
  loadInventoryFromBackend,
  removeInventoryItem,
  setInventoryLimit,
  setInventoryStatus,
  subscribeInventory,
  updateInventoryItem,
  enforceTimeLimits,
  type SellerCategory,
  type SellerInventoryItem,
} from "@/lib/sellerInventory";
import { getSellerSession } from "@/utils/sessionManager";

const CATEGORIES: { key: SellerCategory; label: string; emoji: string }[] = [
  { key: "Food", label: "Food", emoji: "🍛" },
  { key: "Snacks", label: "Snacks", emoji: "🍟" },
  { key: "Drinks", label: "Drinks", emoji: "🥤" },
];

// Items added within the last 24h get a "New" badge.
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

const SellerMenu = () => {
  const [items, setItems] = useState<SellerInventoryItem[]>(() => getInventory(getSellerSession()?.id));
  const [activeCat, setActiveCat] = useState<SellerCategory>("Food");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SellerInventoryItem | null>(null);
  const [eName, setEName] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eCategory, setECategory] = useState<SellerCategory>("Food");
  const [eStatus, setEStatus] = useState<"Active" | "Inactive">("Active");
  const [eIcon, setEIcon] = useState("");

  // Set Limit dialog state
  const [limiting, setLimiting] = useState<SellerInventoryItem | null>(null);
  const [lMode, setLMode] = useState<"qty" | "time">("qty");
  const [lQty, setLQty] = useState("");
  const [lUntil, setLUntil] = useState("");

  const openLimit = (item: SellerInventoryItem) => {
    setLimiting(item);
    setLMode(item.availableUntil ? "time" : "qty");
    setLQty(item.stockLimit != null ? String(item.stockLimit) : "");
    setLUntil(item.availableUntil ? toLocalInput(item.availableUntil) : "");
  };
  const closeLimit = () => setLimiting(null);

  const saveLimit = () => {
    if (!limiting) return;
    if (lMode === "qty") {
      const n = Number(lQty);
      if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a valid quantity");
      setInventoryLimit(limiting.id, { stockLimit: Math.floor(n), availableUntil: null })
        .then(() => { toast.success(`Limit set: ${Math.floor(n)} units`); closeLimit(); })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not set limit"));
    } else {
      if (!lUntil) return toast.error("Pick an available-until time");
      const iso = new Date(lUntil).toISOString();
      if (new Date(iso).getTime() <= Date.now()) return toast.error("Time must be in the future");
      setInventoryLimit(limiting.id, { availableUntil: iso, stockLimit: null })
        .then(() => { toast.success("Available-until set"); closeLimit(); })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not set limit"));
    }
  };

  const clearLimit = () => {
    if (!limiting) return;
    setInventoryLimit(limiting.id, { stockLimit: null, availableUntil: null })
      .then(() => { toast.success("Limit cleared"); closeLimit(); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not clear limit"));
  };

  const openEdit = (item: SellerInventoryItem) => {
    setEditing(item);
    setEName(item.name);
    setEPrice(String(item.price));
    setECategory(item.category);
    setEStatus(item.status);
    setEIcon(item.icon);
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = () => {
    if (!editing) return;
    const trimmed = eName.trim();
    const priceNum = Number(ePrice);
    if (!trimmed) return toast.error("Name is required");
    if (!priceNum || priceNum <= 0) return toast.error("Enter a valid price");
    if (!eIcon.trim()) return toast.error("Icon is required");
    updateInventoryItem(editing.id, {
      name: trimmed,
      price: priceNum,
      category: eCategory,
      status: eStatus,
      icon: eIcon.trim(),
    }).then(() => {
      toast.success("Item updated");
      closeEdit();
    }).catch((e) => toast.error(e instanceof Error ? e.message : "Could not update item"));
  };

  useEffect(() => {
    const sellerId = getSellerSession()?.id;
    const unsub = subscribeInventory(() => setItems(getInventory(sellerId)));
    loadInventoryFromBackend(sellerId).then(setItems).catch((e) => toast.error(e instanceof Error ? e.message : "Could not load menu"));
    // Auto-enforce time limits — run now and every 30s.
    enforceTimeLimits();
    const timer = window.setInterval(() => { enforceTimeLimits(); }, 30000);
    return () => { unsub(); window.clearInterval(timer); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q !== "") {
      // Universal search — ignore active category, search across all items.
      return items.filter((i) => i.name.toLowerCase().includes(q));
    }
    return items.filter((i) => i.category === activeCat);
  }, [items, activeCat, query]);

  // When searching, group results by their actual category so users see
  // matches from every section. Otherwise keep the single active-category group.
  const groups = useMemo<[string, SellerInventoryItem[]][]>(() => {
    if (filtered.length === 0) return [];
    if (query.trim() === "") return [[`${activeCat} Items`, filtered]];
    const order: SellerCategory[] = ["Food", "Snacks", "Drinks"];
    return order
      .map((cat) => [`${cat} Items`, filtered.filter((i) => i.category === cat)] as [string, SellerInventoryItem[]])
      .filter(([, list]) => list.length > 0);
  }, [filtered, activeCat, query]);

  const setActive = (id: string, active: boolean) => {
    setInventoryStatus(id, active ? "Active" : "Inactive").catch((e) =>
      toast.error(e instanceof Error ? e.message : "Could not update status"),
    );
  };

  const handleRemove = (item: SellerInventoryItem) => {
    removeInventoryItem(item.id)
      .then(() => toast.success(`${item.name} removed`))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not remove item"));
  };

  return (
    <div className="seller-admin-shell">
      <div className="seller-admin-content">
        {/* Header — same style as Inventory */}
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
          <h1 className="text-lg font-extrabold tracking-tight">Menu Manager</h1>
        </header>

        {/* Search */}
        <div className="relative mt-6">
          <span
            className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            style={{ fontSize: 20 }}
          >
            search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full rounded-full bg-secondary/70 py-3.5 pl-12 pr-5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-primary/60"
          />
        </div>

        {/* Category chips */}
        <div className="mt-5 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => {
            const active = c.key === activeCat;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setActiveCat(c.key)}
                className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "bg-secondary text-foreground/80 hover:bg-secondary/80"
                }`}
              >
                {c.label} {c.emoji}
              </button>
            );
          })}
        </div>

        {/* Groups */}
        {groups.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? "No items yet. Add items from the Add Inventory page."
              : "No menu items found."}
          </p>
        )}

        {groups.map(([group, list]) => (
          <section key={group} className="mt-6">
            <h2 className="mb-3 text-xs font-extrabold tracking-[0.18em] text-primary">
              {group.toUpperCase()}
            </h2>
            <div className="space-y-4">
              {list.map((item) => {
                const isNew = Date.now() - item.createdAt < NEW_WINDOW_MS;
                const isActive = item.status === "Active";
                return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-border bg-gradient-card p-4 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold leading-tight">
                        {item.name}
                        {isNew && (
                          <span className="ml-2 rounded-md bg-destructive/20 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-destructive">
                            New
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        ₹{item.price}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                        isActive
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {isActive ? "Available" : "Unavailable"}
                    </span>
                  </div>

                  {/* Active / Inactive toggle */}
                  <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-secondary/60 p-1">
                    <button
                      type="button"
                      onClick={() => setActive(item.id, true)}
                      className={`rounded-full py-2 text-xs font-bold uppercase tracking-wider transition ${
                        isActive
                          ? "bg-success/20 text-success"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setActive(item.id, false)}
                      className={`rounded-full py-2 text-xs font-bold uppercase tracking-wider transition ${
                        !isActive
                          ? "bg-destructive/20 text-destructive"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Inactive
                    </button>
                  </div>

                  {/* Footer: category label + delete */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label={`Edit ${item.name}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary transition hover:bg-primary/15"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          edit
                        </span>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openLimit(item)}
                        aria-label={`Set limit for ${item.name}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary transition hover:bg-primary/15"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          tune
                        </span>
                        Set Limit
                        {(item.stockLimit != null || item.availableUntil) && (
                          <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px]">
                            {item.stockLimit != null ? `${item.stockLimit}` : "⏱"}
                          </span>
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(item)}
                      aria-label={`Delete ${item.name}`}
                      className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-destructive transition hover:bg-destructive/15"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        delete
                      </span>
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        ))}

        {/* Edit dialog */}
        {editing && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 pt-10 sm:items-center"
            onClick={closeEdit}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-border bg-gradient-card p-5 shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-extrabold tracking-tight">Edit Item</h3>
                <button
                  type="button"
                  onClick={closeEdit}
                  aria-label="Close"
                  className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground hover:bg-secondary/80"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                </button>
              </div>

              <label className="block">
                <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">NAME</span>
                <input
                  type="text"
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                  className="mt-2 w-full rounded-full bg-secondary/70 px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/60"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">PRICE (₹)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={ePrice}
                  onChange={(e) => setEPrice(e.target.value)}
                  className="mt-2 w-full rounded-full bg-secondary/70 px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/60"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">ICON (EMOJI)</span>
                <input
                  type="text"
                  value={eIcon}
                  onChange={(e) => setEIcon(e.target.value)}
                  maxLength={4}
                  className="mt-2 w-full rounded-full bg-secondary/70 px-5 py-3 text-center text-2xl outline-none focus:ring-2 focus:ring-primary/60"
                />
              </label>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">CATEGORY</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(CATEGORIES.map((c) => c.key) as SellerCategory[]).map((c) => {
                    const active = eCategory === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setECategory(c)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          active
                            ? "bg-primary text-primary-foreground shadow-glow"
                            : "bg-secondary text-foreground/80 hover:bg-secondary/80"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">STATUS</p>
                <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-secondary/60 p-1">
                  <button
                    type="button"
                    onClick={() => setEStatus("Active")}
                    className={`rounded-full py-2 text-xs font-bold uppercase tracking-wider transition ${
                      eStatus === "Active" ? "bg-success/20 text-success" : "text-muted-foreground"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setEStatus("Inactive")}
                    className={`rounded-full py-2 text-xs font-bold uppercase tracking-wider transition ${
                      eStatus === "Inactive" ? "bg-destructive/20 text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 rounded-full bg-secondary py-3 text-sm font-semibold text-foreground hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="flex-1 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-95"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Set Limit dialog */}
        {limiting && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 pt-10 sm:items-center"
            onClick={closeLimit}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-border bg-gradient-card p-5 shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-extrabold tracking-tight">Set Limit · {limiting.name}</h3>
                <button
                  type="button"
                  onClick={closeLimit}
                  aria-label="Close"
                  className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground hover:bg-secondary/80"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary/60 p-1">
                <button
                  type="button"
                  onClick={() => setLMode("qty")}
                  className={`rounded-full py-2 text-xs font-bold uppercase tracking-wider transition ${
                    lMode === "qty" ? "bg-primary/20 text-primary" : "text-muted-foreground"
                  }`}
                >
                  Quantity
                </button>
                <button
                  type="button"
                  onClick={() => setLMode("time")}
                  className={`rounded-full py-2 text-xs font-bold uppercase tracking-wider transition ${
                    lMode === "time" ? "bg-primary/20 text-primary" : "text-muted-foreground"
                  }`}
                >
                  Available Time
                </button>
              </div>

              {lMode === "qty" ? (
                <label className="mt-5 block">
                  <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">LIMIT QUANTITY</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={lQty}
                    onChange={(e) => setLQty(e.target.value)}
                    placeholder="e.g. 25"
                    className="mt-2 w-full rounded-full bg-secondary/70 px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <p className="mt-2 px-2 text-[11px] text-muted-foreground">
                    Item auto-hides once this quantity is sold.
                  </p>
                </label>
              ) : (
                <label className="mt-5 block">
                  <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">AVAILABLE UNTIL</span>
                  <input
                    type="datetime-local"
                    value={lUntil}
                    onChange={(e) => setLUntil(e.target.value)}
                    className="mt-2 w-full rounded-2xl bg-secondary/70 px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <p className="mt-2 px-2 text-[11px] text-muted-foreground">
                    Item auto-hides after this time passes.
                  </p>
                </label>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={clearLimit}
                  className="flex-1 rounded-full bg-secondary py-3 text-sm font-semibold text-foreground hover:bg-secondary/80"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={saveLimit}
                  className="flex-1 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-95"
                >
                  Save Limit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerMenu;

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
