import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import UserLayout from "@/components/user/UserLayout";
import { MenuItemsSkeleton } from "@/components/user/Skeletons";
import {
  getInventory,
  loadInventoryFromBackend,
  subscribeInventory,
  isItemAvailable,
  maxPurchasableQty,
  type SellerInventoryItem,
} from "@/lib/sellerInventory";
import { getRegisteredCanteens, getRegisteredCanteensFromBackend, subscribeCanteens, type SellerProfile } from "@/lib/sellerProfile";
import { addToCart, getCart, setCartQty, subscribeCart } from "@/lib/userCart";
import {
  getFavorites,
  getPinned,
  pinItem,
  subscribePins,
  toggleFavorite,
} from "@/lib/userPins";

type CategoryKey = "Food" | "Snacks" | "Drinks";

const TABS: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: "Food", label: "Food", emoji: "🍛" },
  { key: "Snacks", label: "Snacks", emoji: "🍟" },
  { key: "Drinks", label: "Drinks", emoji: "🥤" },
];

const liquidGlass: React.CSSProperties = {
  background: "rgba(255,255,255,0.4)",
  backdropFilter: "blur(40px)",
  WebkitBackdropFilter: "blur(40px)",
  boxShadow:
    "0 4px 24px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 24px 24px -12px rgba(255,255,255,0.5)",
  borderRadius: 22,
};

const textGlass: React.CSSProperties = {
  textShadow: "0 1px 2px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.05)",
};

const Menu = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromOffer = searchParams.get("fromOffer") === "1";
  const inventoryRef = useRef<HTMLDivElement | null>(null);
  const [canteen, setCanteen] = useState<SellerProfile | null>(() => getRegisteredCanteens().find((c) => c.id === id) ?? null);
  const [canteenLoading, setCanteenLoading] = useState(true);
  const title = canteen?.canteenName ?? "Canteen";

  const [active, setActive] = useState<CategoryKey>("Food");
  const [query, setQuery] = useState("");
  const [inventory, setInventory] = useState<SellerInventoryItem[]>(() => getInventory(id));
  const [inventoryLoading, setInventoryLoading] = useState(() => getInventory(id).length === 0);
  const [cart, setCart] = useState(() => getCart());
  // Frozen snapshots: order is captured on entry to this canteen and does NOT
  // shuffle while the user browses. It refreshes on next visit (id change).
  const [pinned, setPinned] = useState(() => getPinned());
  const [favorites, setFavorites] = useState(() => getFavorites());
  // Live favorites used only for the heart UI (so the heart appears immediately
  // when the user double-taps), without re-sorting the visible list.
  const [favoritesLive, setFavoritesLive] = useState(() => getFavorites());
  // Show the search/category bars as a floating header only while the user is
  // scrolling down. When scrolling up (or at the top), let them flow naturally
  // with the page so the layout feels calm.
  const [floatingBars, setFloatingBars] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (y <= 40) {
        setFloatingBars(false);
      } else if (delta > 2) {
        setFloatingBars(false);
      } else if (delta < -2) {
        setFloatingBars(true);
      }
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const refreshLocal = () => setInventory(getInventory(id));
    const unsub = subscribeInventory(refreshLocal);
    
    const refreshCanteen = () => {
      setCanteenLoading(true);
      getRegisteredCanteensFromBackend()
        .then((rows) => {
          setCanteen(rows.find((c) => c.id === id) ?? null);
          setCanteenLoading(false);
        })
        .catch(() => {
          setCanteen(getRegisteredCanteens().find((c) => c.id === id) ?? null);
          setCanteenLoading(false);
        });
    };
    
    refreshCanteen();
    const unsubCanteens = subscribeCanteens(refreshCanteen);

    loadInventoryFromBackend(id)
      .then((rows) => { setInventory(rows); setInventoryLoading(false); })
      .catch(() => { setInventory([]); setInventoryLoading(false); });
    
    // Re-snapshot pin/favorite order only when the canteen changes
    setPinned(getPinned());
    setFavorites(getFavorites());
    setFavoritesLive(getFavorites());
    return () => {
      unsub();
      unsubCanteens();
    };
  }, [id]);
  useEffect(() => subscribeCart(() => setCart(getCart())), []);
  // Re-evaluate time-based availability every 15s so items hide the moment
  // their "available until" cutoff passes — no refresh required.
  useEffect(() => {
    const t = window.setInterval(() => setInventory(getInventory(id)), 15000);
    return () => window.clearInterval(t);
  }, [id]);
  // When the user lands here from tapping an offer card, auto-scroll the
  // inventory list into view so they immediately start exploring items for
  // this canteen.
  useEffect(() => {
    if (!fromOffer) return;
    if (inventoryLoading) return;
    const t = window.setTimeout(() => {
      inventoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [fromOffer, inventoryLoading, id]);
  useEffect(
    () =>
      subscribePins(() => {
        // Only update the heart indicator; do not re-sort the menu in place.
        setFavoritesLive(getFavorites());
      }),
    [],
  );

  const currentCanteenId = id ?? "__unknown__";
  const qtyOf = (itemId: string) =>
    cart.find((c) => c.itemId === itemId && (c.canteenId ?? "__unknown__") === currentCanteenId)?.qty ?? 0;

  const handleAdd = (it: SellerInventoryItem, n: number) => {
    const current = qtyOf(it.id);
    const cap = maxPurchasableQty(it);
    const next = Math.min(n, cap);
    if (next === current) return;
    if (current === 0 && n > 0) {
      // Pin silently — do NOT reorder the visible list right now. The new
      // pinned position will only be reflected on the next visit / after
      // checkout when the snapshot is rebuilt.
      pinItem(it.id);
      addToCart(
        { itemId: it.id, name: it.name, price: it.price, icon: it.icon, category: it.category, canteenId: it.sellerId ?? id, canteenIcon: canteen?.icon, canteenName: canteen?.canteenName },
        next,
      );
    } else {
      if (next > current) pinItem(it.id);
      setCartQty(it.id, next, it.sellerId ?? id);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? inventory.filter(
          (it) => isItemAvailable(it) && it.name.toLowerCase().includes(q),
        )
      : inventory.filter(
          (it) => it.category === active && isItemAvailable(it),
        );
    return [...base].sort((a, b) => {
      const fa = favorites[a.id] ?? 0;
      const fb = favorites[b.id] ?? 0;
      if (fa !== fb) return fb - fa;
      const pa = pinned[a.id] ?? 0;
      const pb = pinned[b.id] ?? 0;
      if (pa !== pb) return pb - pa;
      return 0;
    });
  }, [inventory, active, query, pinned, favorites]);

  const { totalItems, totalPrice } = useMemo(() => {
    const currentCanteenItems = cart.filter((i) => (i.canteenId ?? "__unknown__") === currentCanteenId);
    const totalItems = currentCanteenItems.reduce((s, i) => s + i.qty, 0);
    const totalPrice = currentCanteenItems.reduce((s, i) => s + i.qty * i.price, 0);
    return { totalItems, totalPrice };
  }, [cart, currentCanteenId]);

  if (!canteenLoading && !canteen) {
    return (
      <UserLayout>
        <div
          className="flex flex-col items-center justify-center text-center p-8 min-h-[60vh] antialiased"
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            color: "hsl(var(--user-text))",
            paddingTop: "calc(60px + var(--ios-pwa-safe-top))",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 64, color: "#EF4444", marginBottom: 16 }}
          >
            block
          </span>
          <h2 className="text-xl font-bold mb-2">Canteen Unavailable</h2>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            This canteen is currently suspended or not available. Please explore other active canteens.
          </p>
          <button
            onClick={() => navigate("/app/home")}
            className="px-6 py-2 rounded-full font-semibold text-white transition-colors"
            style={{
              background: "linear-gradient(135deg, #2563eb, #3b82f6)",
              boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
              cursor: "pointer",
            }}
          >
            Go Back Home
          </button>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div
        className="user-page antialiased"
        style={{
          color: "#111827",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Header — back only */}
        <div
          className="relative z-10 mx-auto flex items-center"
          style={{
            paddingTop: "calc(12px + var(--ios-pwa-safe-top) + var(--ios-pwa-top-breathing))",
            paddingBottom: 8,
            paddingLeft: 16,
            paddingRight: 16,
            maxWidth: 1120,
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/app/home")}
            aria-label="Back"
            className="flex items-center justify-center"
            style={{ width: 40, height: 40 }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 24, color: "#4B5563" }}
            >
              arrow_back
            </span>
          </button>
        </div>

        {/* Search + tabs (floating, sticky) */}
        <div
          style={{
            position: floatingBars ? "fixed" : "relative",
            top: floatingBars
              ? "calc(8px + env(safe-area-inset-top, 0px) + var(--ios-pwa-safe-top) + var(--ios-pwa-top-breathing))"
              : undefined,
            left: 0,
            right: 0,
            zIndex: 30,
            maxWidth: 1120,
            marginInline: "auto",
            paddingTop: 8,
            paddingBottom: 12,
            paddingLeft: "max(clamp(1rem, 4vw, 2rem), env(safe-area-inset-left, 0px))",
            paddingRight: "max(clamp(1rem, 4vw, 2rem), env(safe-area-inset-right, 0px))",
            background: "transparent",
            pointerEvents: "none",
            transform: floatingBars ? "translateY(0)" : "translateY(0)",
            transition: "transform 280ms ease, opacity 280ms ease",
            animation: floatingBars ? "slideDownBars 280ms ease both" : undefined,
          }}
        >
            {/* Search */}
            <div
              className="flex items-center gap-2"
              style={{
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid #e5e7eb",
                borderRadius: 9999,
                padding: "10px 16px",
                boxShadow: "0 10px 30px -10px rgba(17,24,39,0.25)",
                pointerEvents: "auto",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 22, color: "#2563eb" }}
              >
                search
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for dishes or cravings..."
                className="flex-1 bg-transparent outline-none"
                style={{
                  fontSize: 14,
                  color: "#111827",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Tabs */}
            <div
              className="no-scrollbar flex gap-3 overflow-x-auto"
              style={{
                marginTop: 12,
                marginBottom: 0,
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid #e5e7eb",
                borderRadius: 9999,
                padding: "6px 6px",
                boxShadow: "0 10px 30px -10px rgba(17,24,39,0.25)",
                pointerEvents: "auto",
              }}
            >
              {TABS.map((t) => {
                const isActive = t.key === active;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActive(t.key)}
                    className="flex-1 min-w-0 whitespace-nowrap"
                    style={{
                      borderRadius: 9999,
                      padding: "8px clamp(10px, 3vw, 20px)",
                      fontSize: "clamp(12px, 3.4vw, 14px)",
                      fontWeight: 600,
                      color: isActive ? "#2563eb" : "#4B5563",
                      background: isActive ? "#EFF6FF" : "transparent",
                      transition: "all 400ms ease",
                    }}
                  >
                    {t.label} {t.emoji}
                  </button>
                );
              })}
            </div>
        </div>

        {/* Food list */}
        <div
          ref={inventoryRef}
          className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{
            maxWidth: 1120,
            marginInline: "auto",
            paddingTop: 20,
            paddingBottom: 120,
            paddingLeft: "max(clamp(1rem, 4vw, 2rem), env(safe-area-inset-left, 0px))",
            paddingRight: "max(clamp(1rem, 4vw, 2rem), env(safe-area-inset-right, 0px))",
          }}
        >
            {visible.map((it, idx) => {
              const n = qtyOf(it.id);
              return (
                <FoodCard
                  key={it.id}
                  item={{
                    emoji: it.icon,
                    name: it.name,
                    desc: it.iconLabel,
                    price: it.price,
                  }}
                  qty={n}
                  onChange={(v) => handleAdd(it, v)}
                  isFavorite={Boolean(favoritesLive[it.id])}
                  onToggleFavorite={() => toggleFavorite(it.id)}
                  delay={idx * 60}
                />
              );
            })}
            {visible.length === 0 && (
              inventoryLoading ? (
                <MenuItemsSkeleton rows={5} />
              ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 0",
                  color: "#6B7280",
                  fontSize: 14,
                }}
              >
                {inventory.length === 0
                  ? "Menu coming soon."
                  : "No items match your search."}
              </div>
              )
            )}
        </div>

        {/* Floating order panel */}
        {totalItems > 0 && (
          <div
            className="fixed z-50 flex items-center justify-between"
            style={{
              ...liquidGlass,
              left: 16,
              right: 16,
              bottom: "calc(24px + var(--ios-pwa-safe-bottom))",
              padding: 16,
            }}
          >
            <div className="min-w-0">
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                CURRENT ORDER
              </div>
              <div
                style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 2 }}
              >
                {totalItems} item{totalItems === 1 ? "" : "s"} • ₹{totalPrice}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/app/cart")}
                style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}
              >
                View Cart
              </button>
              <button
                type="button"
                onClick={() => navigate(`/app/payment?canteenId=${encodeURIComponent(currentCanteenId)}`)}
                style={{
                  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                  color: "#FFFFFF",
                  padding: "10px 20px",
                  borderRadius: 9999,
                  boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Pay Now
              </button>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
};

type FoodCardItem = { emoji: string; name: string; desc: string; price: number };

const FoodCard = ({
  item,
  qty,
  onChange,
  isFavorite,
  onToggleFavorite,
  delay,
}: {
  item: FoodCardItem;
  qty: number;
  onChange: (n: number) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  delay: number;
}) => {
  const [hover, setHover] = useState(false);
  const lastTapRef = useRef<number>(0);
  const DOUBLE_TAP_MS = 300;

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      onToggleFavorite();
      if ("vibrate" in navigator) navigator.vibrate?.(20);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerUp={handleTap}
      onContextMenu={(e) => e.preventDefault()}
      className="flex items-center animate-fade-in"
      style={{
        ...liquidGlass,
        background: hover ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.4)",
        padding: 12,
        gap: 12,
        transition: "background 400ms ease",
        position: "relative",
        touchAction: "pan-y",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        animationDelay: `${delay}ms`,
        animationFillMode: "both",
      }}
    >
      {isFavorite && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            fontSize: 14,
          }}
        >
          ❤️
        </span>
      )}
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: 48, height: 48, fontSize: 30 }}
      >
        {item.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div
          style={{
            ...textGlass,
            fontWeight: 600,
            fontSize: 15,
            color: "#111827",
          }}
          className="truncate"
        >
          {item.name}
        </div>
        <div
          className="truncate"
          style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}
        >
          {item.desc}
        </div>
        <div
          style={{
            ...textGlass,
            fontSize: 14,
            fontWeight: 700,
            color: "#2563eb",
            marginTop: 4,
          }}
        >
          ₹{item.price}
        </div>
      </div>
      <div className="shrink-0">
        {qty === 0 ? (
          <button
            type="button"
            onClick={() => onChange(1)}
            style={{
              background: "rgba(255,255,255,0.5)",
              borderRadius: 9999,
              padding: "6px 16px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#374151",
              transition: "all 400ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.85)";
              e.currentTarget.style.color = "#2563eb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.5)";
              e.currentTarget.style.color = "#374151";
            }}
          >
            Add
          </button>
        ) : (
          <div
            className="flex items-center"
            style={{
              gap: 8,
              background: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: 9999,
              padding: 4,
            }}
          >
            <button
              type="button"
              onClick={() => onChange(qty - 1)}
              aria-label="decrease"
              style={{
                width: 24,
                height: 24,
                color: "#4B5563",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              −
            </button>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#111827",
                minWidth: 16,
                textAlign: "center",
              }}
            >
              {qty}
            </span>
            <button
              type="button"
              onClick={() => onChange(qty + 1)}
              aria-label="increase"
              className="flex items-center justify-center"
              style={{
                width: 24,
                height: 24,
                background: "#2563eb",
                color: "#FFFFFF",
                borderRadius: "50%",
                boxShadow: "0 2px 6px rgba(37,99,235,0.35)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                add
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Menu;