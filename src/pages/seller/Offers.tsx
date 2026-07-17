import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getInventory, subscribeInventory, type SellerInventoryItem } from "@/lib/sellerInventory";
import {
  addOffer,
  getOffers,
  loadOffersFromBackend,
  migrateCachedOffersToBackend,
  removeOffer,
  subscribeOffers,
  updateOffer,
  type SellerOffer,
} from "@/lib/sellerOffers";
import { getSellerSession } from "@/lib/sellerAuth";

type OfferType = "general" | "inventory";

type InventoryItem = {
  id: string;
  icon: string;
  name: string;
  group: string;
};

const toInventoryItem = (it: SellerInventoryItem): InventoryItem => ({
  id: it.id,
  icon: it.icon,
  name: it.name,
  group: it.category,
});

const SellerOffers = () => {
  const [step, setStep] = useState<"select" | "details">("select");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offerType, setOfferType] = useState<OfferType>("general");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [inventory, setInventory] = useState<SellerInventoryItem[]>(() => getInventory());
  const [offers, setOffers] = useState<SellerOffer[]>(() => getOffers());
  // Form fields (lifted to parent so submit can persist)
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [discount, setDiscount] = useState("");
  const [condition, setCondition] = useState("");

  useEffect(() => subscribeInventory(() => setInventory(getInventory())), []);
  useEffect(() => subscribeOffers(() => setOffers(getOffers())), []);

  const sellerId = getSellerSession()?.id ?? null;
  useEffect(() => {
    migrateCachedOffersToBackend(sellerId)
      .catch(() => null)
      .finally(() => loadOffersFromBackend(sellerId).then(() => setOffers(getOffers())).catch(() => null));
  }, [sellerId]);
  const myOffers = useMemo(
    () => offers.filter((o) => o.sellerId === sellerId),
    [offers, sellerId],
  );

  const filteredItems = useMemo(() => {
    const all = inventory.map(toInventoryItem);
    const normalized = query.trim().toLowerCase();
    if (!normalized) return all;
    return all.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.group.toLowerCase().includes(normalized)
    );
  }, [query, inventory]);

  const createOffer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const pct = Number(discount);
    if (!sellerId) {
      toast.error("Seller session expired. Please login again.");
      return;
    }
    if (!trimmedName) {
      toast.error("Add an offer name");
      return;
    }
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      toast.error("Enter a valid discount %");
      return;
    }
    if (offerType === "inventory" && selectedItems.length === 0) {
      toast.error("Pick at least one item");
      return;
    }
    try {
      if (editingId) {
        await updateOffer(editingId, {
          sellerId,
          kind: offerType,
          name: trimmedName,
          discountPct: pct,
          startDate,
          endDate,
          condition: offerType === "general" ? "" : condition.trim(),
          itemIds: offerType === "inventory" ? selectedItems : [],
        });
      } else {
        await addOffer({
          sellerId,
          kind: offerType,
          name: trimmedName,
          discountPct: pct,
          startDate,
          endDate,
          condition: offerType === "general" ? "" : condition.trim(),
          itemIds: offerType === "inventory" ? selectedItems : [],
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save offer");
      return;
    }
    // Reset form & return to step 1
    setName("");
    setStartDate("");
    setEndDate("");
    setDiscount("");
    setCondition("");
    setSelectedItems([]);
    const wasEditing = Boolean(editingId);
    setEditingId(null);
    setStep("select");
    toast.success(wasEditing ? "Offer updated" : offerType === "general" ? "General offer created" : "Inventory offer created");
  };

  const goBack = () => {
    if (step === "details") {
      setEditingId(null);
      setName("");
      setStartDate("");
      setEndDate("");
      setDiscount("");
      setCondition("");
      setSelectedItems([]);
      setStep("select");
      return;
    }
  };

  const startEdit = (o: SellerOffer) => {
    setEditingId(o.id);
    setOfferType(o.kind);
    setName(o.name);
    setStartDate(o.startDate);
    setEndDate(o.endDate);
    setDiscount(String(o.discountPct));
    setCondition(o.condition ?? "");
    setSelectedItems(o.itemIds ?? []);
    setStep("details");
  };

  const deleteOffer = async (id: string) => {
    try {
      await removeOffer(id);
      toast.success("Offer deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete offer");
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  if (step === "details" && offerType === "general") {
    return (
      <GeneralOfferForm
        onBack={goBack}
        onSubmit={createOffer}
        editing={Boolean(editingId)}
        name={name}
        setName={setName}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        discount={discount}
        setDiscount={setDiscount}
      />
    );
  }

  if (step === "details" && offerType === "inventory") {
    return (
      <InventoryOfferForm
        onBack={goBack}
        onSubmit={createOffer}
        editing={Boolean(editingId)}
        query={query}
        setQuery={setQuery}
        items={filteredItems}
        selectedItems={selectedItems}
        toggleItem={toggleItem}
        name={name}
        setName={setName}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        discount={discount}
        setDiscount={setDiscount}
        condition={condition}
        setCondition={setCondition}
      />
    );
  }

  return (
    <div className="seller-admin-shell">
      <main className="seller-admin-content">
        <header className="flex items-center gap-3">
          <Link
            to="/seller/dashboard"
            aria-label="Back to dashboard"
            className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-foreground transition hover:bg-secondary/80"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              arrow_back
            </span>
          </Link>
          <h1 className="text-lg font-extrabold tracking-tight">Create Offer</h1>
        </header>

        <div className="mt-7 grid grid-cols-3 gap-3" aria-label="Step progress">
          <span className="h-1.5 rounded-full bg-primary shadow-glow" />
          <span className="h-1.5 rounded-full bg-secondary" />
          <span className="h-1.5 rounded-full bg-secondary" />
        </div>

        <section className="mt-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Step 1 of 3</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Choose offer type</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
            Define the scope of your discount. General offers target your entire menu, while inventory offers focus on specific culinary categories.
          </p>
        </section>

        <section className="mt-7 space-y-4">
          <OfferTypeCard
            active={offerType === "general"}
            icon="restaurant_menu"
            title="General Offer"
            subtitle="Applies to all items"
            onClick={() => setOfferType("general")}
          />
          <OfferTypeCard
            active={offerType === "inventory"}
            icon="inventory_2"
            title="Inventory Offer"
            subtitle="Applies to specific items"
            onClick={() => setOfferType("inventory")}
          />
        </section>

        <button
          type="button"
          onClick={() => setStep("details")}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-primary py-3.5 text-base font-extrabold text-primary-foreground shadow-glow transition hover:bg-primary/90"
        >
          Continue to Details
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
            arrow_forward
          </span>
        </button>
        <p className="mt-4 text-center text-sm font-medium text-muted-foreground">Step 1 of 3: Selection</p>

        {/* Live / Saved Offers */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold tracking-tight">Your Offers</h3>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              {myOffers.length}
            </span>
          </div>
          {myOffers.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
              No offers yet. Create one above to start.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {myOffers.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-gradient-card p-4 shadow-card"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
                      {o.kind === "general" ? "restaurant_menu" : "inventory_2"}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-extrabold">{o.name}</p>
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-primary-foreground">
                        {o.discountPct}% OFF
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {o.kind === "general" ? "All items" : `${o.itemIds.length} item${o.itemIds.length === 1 ? "" : "s"}`}
                      {o.startDate || o.endDate ? ` • ${o.startDate || "—"} → ${o.endDate || "—"}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(o)}
                    aria-label="Edit offer"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground transition hover:bg-secondary/80"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOffer(o.id)}
                    aria-label="Delete offer"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive transition hover:bg-destructive/25"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const OfferTypeCard = ({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-5 text-left transition ${
      active
        ? "border-primary bg-card shadow-glow"
        : "border-transparent bg-card/70 hover:bg-card"
    }`}
  >
    <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
      <span className="material-symbols-outlined" style={{ fontSize: 30 }}>
        {icon}
      </span>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-xl font-extrabold tracking-tight">{title}</span>
      <span className="mt-1 block text-sm font-medium text-muted-foreground">{subtitle}</span>
      {active && (
        <span className="mt-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
          Selected
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            check_circle
          </span>
        </span>
      )}
    </span>
  </button>
);

const PageHeader = ({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) => (
  <header className="flex items-center gap-3 pt-6">
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to offer selection"
      className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-foreground transition hover:bg-secondary/80"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
        arrow_back
      </span>
    </button>
    <div className="min-w-0">
      <h1 className="truncate text-lg font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-0.5 text-xs font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{subtitle}</p>}
    </div>
  </header>
);

type FormFieldProps = {
  name: string;
  setName: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  discount: string;
  setDiscount: (v: string) => void;
  condition: string;
  setCondition: (v: string) => void;
};

const GeneralOfferForm = ({
  onBack,
  onSubmit,
  editing,
  name,
  setName,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  discount,
  setDiscount,
}: { onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; editing?: boolean } & Omit<FormFieldProps, "condition" | "setCondition">) => (
  <div className="seller-admin-shell">
    <main className="seller-admin-content">
      <PageHeader title={editing ? "Edit Offer" : "General Offer"} subtitle="Apply discounts across all items" onBack={onBack} />

      <form onSubmit={onSubmit} className="mt-8 rounded-3xl border border-border bg-gradient-card p-5 shadow-card">
        <FieldLabel>Offer Name</FieldLabel>
        <IconInput placeholder="Fest Offer" icon="label" value={name} onChange={setName} />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <DateInput value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <DateInput value={endDate} onChange={setEndDate} />
          </div>
        </div>

        <FieldLabel className="mt-5">Discount Percentage</FieldLabel>
        <IconInput placeholder="Enter discount %" icon="percent" value={discount} onChange={setDiscount} type="number" />

        <button type="submit" className="mt-7 flex w-full items-center justify-center gap-3 rounded-full bg-primary py-3.5 text-base font-extrabold text-primary-foreground shadow-glow transition hover:bg-primary/90">
          {editing ? "Save Changes" : "Create Offer"}
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
            bolt
          </span>
        </button>
      </form>

      <aside className="mt-6 flex items-start gap-4 rounded-3xl bg-card/55 px-5 py-5 text-muted-foreground">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">i</span>
        <p className="text-sm font-medium leading-relaxed">General offers are applied globally to all active menu items. This action will override any conflicting individual dish discounts.</p>
      </aside>
    </main>
  </div>
);

const InventoryOfferForm = ({
  onBack,
  onSubmit,
  editing,
  query,
  setQuery,
  items,
  selectedItems,
  toggleItem,
  name,
  setName,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  discount,
  setDiscount,
  condition,
  setCondition,
}: {
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  editing?: boolean;
  query: string;
  setQuery: (value: string) => void;
  items: InventoryItem[];
  selectedItems: string[];
  toggleItem: (id: string) => void;
} & FormFieldProps) => (
  <div className="seller-admin-shell">
    <main className="seller-admin-content">
      <PageHeader title={editing ? "Edit Offer" : "Create Offer"} subtitle="Fill in the details" onBack={onBack} />

      <form onSubmit={onSubmit} className="mt-8">
        <FieldLabel>Offer Name</FieldLabel>
        <PlainInput placeholder="e.g. Midnight Feast" value={name} onChange={setName} />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <CompactDateInput value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <CompactDateInput value={endDate} onChange={setEndDate} />
          </div>
        </div>

        <FieldLabel className="mt-5">Discount Percentage</FieldLabel>
        <IconInput placeholder="20" icon="percent" compact value={discount} onChange={setDiscount} type="number" />

        <FieldLabel className="mt-5">Condition</FieldLabel>
        <PlainInput placeholder="Buy more than ₹200 and get 20% off" value={condition} onChange={setCondition} />

        <div className="mt-6 flex items-center justify-between gap-4">
          <FieldLabel>Inventory Selection</FieldLabel>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-extrabold uppercase text-accent-foreground">Multi-select</span>
        </div>

        <div className="relative mt-3">
          <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" style={{ fontSize: 20 }}>
            search
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search menu items..."
            className="w-full rounded-full border-0 bg-secondary/70 py-3.5 pl-12 pr-5 text-sm font-medium text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-primary/60"
          />
        </div>

        <div className="mt-4 space-y-3">
          {items.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
              No inventory items yet. Add items first.
            </p>
          )}
          {items.map((item) => {
            const selected = selectedItems.includes(item.id);
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className="flex min-h-20 w-full items-center gap-4 rounded-2xl border border-border bg-gradient-card px-4 py-4 text-left shadow-card transition hover:bg-card/80"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-2xl">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-extrabold">{item.name}</span>
                  <span className="mt-1 block truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.group}</span>
                </span>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 text-transparent"}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                    check
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button type="submit" className="mt-7 flex w-full items-center justify-center gap-3 rounded-full bg-primary py-3.5 text-base font-extrabold text-primary-foreground shadow-glow transition hover:bg-primary/90">
          {editing ? "Save Changes" : "Create Offer"}
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
            arrow_forward
          </span>
        </button>
      </form>
    </main>
  </div>
);

const FieldLabel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <label className={`block text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground ${className}`}>{children}</label>
);

const PlainInput = ({ placeholder, value, onChange }: { placeholder: string; value?: string; onChange?: (v: string) => void }) => (
  <input
    value={value ?? ""}
    onChange={(e) => onChange?.(e.target.value)}
    placeholder={placeholder}
    className="mt-2 w-full rounded-full border-0 bg-secondary/70 px-5 py-3.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-primary/60"
  />
);

const IconInput = ({ placeholder, icon, compact = false, value, onChange, type = "text" }: { placeholder: string; icon: string; compact?: boolean; value?: string; onChange?: (v: string) => void; type?: string }) => (
  <div className={`mt-2 flex items-center border border-border bg-secondary/70 px-5 focus-within:ring-2 focus-within:ring-primary/60 ${compact ? "rounded-full py-3.5" : "rounded-full py-3.5"}`}>
    <input
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      type={type}
      placeholder={placeholder}
      className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/70 outline-none"
    />
    <span className="material-symbols-outlined shrink-0 text-primary" style={{ fontSize: 20 }}>
      {icon}
    </span>
  </div>
);

const DateInput = ({ value, onChange }: { value?: string; onChange?: (v: string) => void }) => (
  <div className="mt-2 flex rounded-full border border-border bg-secondary/70 px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary/60">
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      className="min-w-0 flex-1 border-0 bg-transparent text-xs font-medium text-foreground outline-none [color-scheme:dark]"
    />
  </div>
);

const CompactDateInput = ({ value, onChange }: { value?: string; onChange?: (v: string) => void }) => (
  <div className="mt-2 flex items-center rounded-full bg-secondary/70 px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary/60">
    <span className="material-symbols-outlined mr-3 shrink-0 text-primary" style={{ fontSize: 20 }}>
      calendar_today
    </span>
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      className="min-w-0 flex-1 border-0 bg-transparent text-xs font-medium text-foreground outline-none [color-scheme:dark]"
    />
  </div>
);

export default SellerOffers;