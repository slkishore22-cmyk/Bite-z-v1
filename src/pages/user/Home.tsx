import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "@/components/user/UserLayout";
import { CanteenListSkeleton } from "@/components/user/Skeletons";
import OfflineFallback from "@/components/OfflineFallback";
import { getOrders, loadOrdersFromBackend, subscribeOrders } from "@/lib/sellerOrders";
import { addToCart, getCart, pruneCartByCanteens, setCartQty, subscribeCart } from "@/lib/userCart";
import { getActiveOffers, loadOffersFromBackend, subscribeOffers, type SellerOffer } from "@/lib/sellerOffers";
import { getRegisteredCanteens, getRegisteredCanteensFromBackend, subscribeCanteens, type SellerProfile } from "@/lib/sellerProfile";
import { getUserName } from "@/utils/sessionManager";
import { logoutUser } from "@/lib/userAuth";

type Offer = { canteen: string; title: string; discount: string; active: boolean; sellerId: string | null };
type Repeat = {
  itemId: string;
  emoji: string;
  name: string;
  price: number;
  category: "Food" | "Snacks" | "Drinks";
  tag: string | null;
  canteenId?: string;
  canteenName?: string;
  orderCount: number;
  quantityCount: number;
  latestAt: number;
};
type Spot = { id: string; icon: string; name: string; sub: string };

const Home = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await logoutUser();
      navigate("/app/login", { replace: true });
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const [orders, setOrders] = useState(() => getOrders());
  const [cart, setCart] = useState(() => getCart());
  const [liveOffers, setLiveOffers] = useState<SellerOffer[]>(() => getActiveOffers());
  const [canteens, setCanteens] = useState<SellerProfile[]>(() => getRegisteredCanteens());
  // Show skeleton ONLY on a true first-time visit (cache empty + fetch in flight).
  const [canteensLoading, setCanteensLoading] = useState(() => getRegisteredCanteens().length === 0);
  useEffect(() => {
    const unsub = subscribeOrders(() => setOrders(getOrders()));
    loadOrdersFromBackend().then(setOrders).catch(() => null);
    return unsub;
  }, []);
  useEffect(() => subscribeCart(() => setCart(getCart())), []);
  useEffect(() => {
    const unsub = subscribeOffers(() => setLiveOffers(getActiveOffers()));
    loadOffersFromBackend().then(() => setLiveOffers(getActiveOffers())).catch(() => null);
    return unsub;
  }, []);
  useEffect(() => {
    const refresh = () =>
      getRegisteredCanteensFromBackend()
        .then((rows) => {
          setCanteens(rows);
          setCanteensLoading(false);
          pruneCartByCanteens(rows.map((r) => r.id));
        })
        .catch(() => { setCanteens(getRegisteredCanteens()); setCanteensLoading(false); });
    refresh();
    return subscribeCanteens(refresh);
  }, []);
  const offers: Offer[] = useMemo(
    () =>
      liveOffers
        .filter((o) => o.kind === "general" && (!o.sellerId || canteens.some((c) => c.id === o.sellerId)))
        .map((o) => {
          const canteen = canteens.find((c) => c.id === o.sellerId);
          return {
            canteen: (canteen?.canteenName ?? (o.kind === "general" ? "ALL ITEMS" : "SELECTED ITEMS")).toUpperCase(),
            title: o.name,
            discount: `${o.discountPct}% OFF`,
            active: true,
            sellerId: o.sellerId,
          };
        }),
    [liveOffers, canteens],
  );
  const spots: Spot[] = useMemo(
    () => canteens.map((c) => ({ id: c.id, icon: c.icon, name: c.canteenName, sub: c.slogan })),
    [canteens],
  );

  // Derive "On Repeat" only from real orders: first order appears immediately,
  // then the list naturally becomes the user's most frequently ordered items.
  const repeats: Repeat[] = useMemo(() => {
    const counts = new Map<string, Repeat>();
    for (const o of orders) {
      for (const i of o.items) {
        if (i.canteenId && !canteens.some((c) => c.id === i.canteenId)) {
          continue;
        }
        const key = `${i.canteenId ?? "unknown"}:${i.itemId}`;
        const canteenIcon = i.canteenIcon ?? canteens.find((c) => c.id === i.canteenId)?.icon ?? null;
        const cur = counts.get(key);
        if (cur) {
          cur.orderCount += 1;
          cur.quantityCount += i.qty;
          cur.latestAt = Math.max(cur.latestAt, o.createdAt);
        } else {
          counts.set(key, {
            itemId: i.itemId,
            emoji: i.icon,
            name: i.name,
            price: i.price,
            category: i.category,
            tag: canteenIcon,
            canteenId: i.canteenId,
            canteenName: o.sellerName ?? undefined,
            orderCount: 1,
            quantityCount: i.qty,
            latestAt: o.createdAt,
          });
        }
      }
    }
    return Array.from(counts.values())
      // Frequency-first ranking across ALL historical orders for this user.
      // Tie-breakers: total quantity ever ordered, then most recently ordered.
      // This never "resets" — it always reflects lifetime ordering behavior.
      // First-time orders naturally appear (count = 1); over time the most
      // frequently ordered items rise to the top. Capped at 10.
      .sort((a, b) => b.orderCount - a.orderCount || b.quantityCount - a.quantityCount || b.latestAt - a.latestAt)
      .slice(0, 10);
  }, [orders, canteens]);

  const cartCanteenKey = (canteenId?: string) => canteenId ?? "__unknown__";
  const qtyOf = (itemId: string, canteenId?: string) =>
    cart.find((c) => c.itemId === itemId && cartCanteenKey(c.canteenId) === cartCanteenKey(canteenId))?.qty ?? 0;
  const canteenForRepeat = (r: Repeat) => {
    return { canteenId: r.canteenId, canteenIcon: r.tag ?? undefined, canteenName: r.canteenName };
  };
  const setCount = (r: Repeat, n: number) => {
    const cur = qtyOf(r.itemId, r.canteenId);
    if (cur === 0 && n > 0) {
      const c = canteenForRepeat(r);
      addToCart(
        { itemId: r.itemId, name: r.name, price: r.price, icon: r.emoji, category: r.category, ...c },
        n,
      );
    } else {
      setCartQty(r.itemId, Math.max(0, n), r.canteenId);
    }
  };
  const orderRepeatNow = (r: Repeat) => {
    if (qtyOf(r.itemId, r.canteenId) === 0) {
      const c = canteenForRepeat(r);
      addToCart(
        { itemId: r.itemId, name: r.name, price: r.price, icon: r.emoji, category: r.category, ...c },
        1,
      );
    }
    navigate(`/app/payment?canteenId=${encodeURIComponent(cartCanteenKey(r.canteenId))}`);
  };

  return (
    <UserLayout>
      {/* Friendly offline overlay shown only when we have nothing cached
          to render — prevents the blank-screen state on cold offline launch. */}
      <OfflineFallback show={canteens.length === 0 && !canteensLoading} />
      <div
        className="user-home-screen user-page antialiased"
        style={{
          color: "hsl(var(--user-text))",
          paddingBottom: "calc(var(--user-bottom-nav-height) + var(--ios-pwa-safe-bottom) + 40px)",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            paddingTop: "var(--home-greeting-top, calc(env(safe-area-inset-top, 0px) + clamp(20px, 5svh, 44px)))",
            paddingLeft: "var(--user-page-pad)",
            paddingRight: "var(--user-page-pad)",
            marginBottom: "var(--home-greeting-gap, clamp(24px, 5.5svh, 52px))",
          }}
        >
          <h1
            className="user-home-greeting"
            style={{
              marginTop: 0,
              marginBottom: 0,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 0,
              color: "#1D1D1F",
            }}
          >
            Hey, {getUserName()} 👋
          </h1>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 shrink-0"
            style={{
              padding: "8px 14px",
              borderRadius: "9999px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.16)",
              color: "#EF4444",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              logout
            </span>
            Sign Out
          </button>
        </div>

        {/* Today's Offers — horizontal scroll */}
        {offers.length > 0 && (
          <div
            className="no-scrollbar flex gap-4 overflow-x-auto"
              style={{
                paddingLeft: "var(--user-page-pad)",
                paddingRight: "var(--user-page-pad)",
                paddingBottom: 8,
                marginBottom: "var(--home-section-gap, 48px)",
              }}
          >
            {offers.map((o, i) => (
              <OfferCard
                key={i}
                offer={o}
                onClick={() => {
                  if (o.sellerId) navigate(`/app/menu/${o.sellerId}?fromOffer=1`);
                }}
              />
            ))}
          </div>
        )}

        {repeats.length > 0 && (
          <>
            <h2
              style={{
                paddingLeft: "var(--user-page-pad)",
                paddingRight: "var(--user-page-pad)",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#1D1D1F",
                marginBottom: 16,
              }}
            >
              On Repeat!
            </h2>
            <div
              style={{
                paddingLeft: "var(--user-page-pad)",
                paddingRight: "var(--user-page-pad)",
                marginBottom: "var(--home-section-gap, 48px)",
                overflow: "hidden",
              }}
            >
              <div
                data-swipe-lock="true"
                className="no-scrollbar flex overflow-x-auto"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  gap: 12,
                  paddingBottom: 2,
                  WebkitOverflowScrolling: "touch",
                  scrollSnapType: "x mandatory",
                  scrollPaddingLeft: 0,
                  overscrollBehaviorX: "contain",
                  touchAction: "pan-x",
                }}
              >
                {repeats.map((r) => (
                  <RepeatCard
                    key={`${cartCanteenKey(r.canteenId)}:${r.itemId}`}
                    item={r}
                    qty={qtyOf(r.itemId, r.canteenId) || 1}
                    onChange={(n) => setCount(r, n)}
                    onOrder={() => orderRepeatNow(r)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Pick a Spot? */}
        <h2
          style={{
            paddingLeft: "var(--user-page-pad)",
            paddingRight: "var(--user-page-pad)",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#1D1D1F",
            marginBottom: 16,
          }}
        >
          Pick a Spot?
        </h2>
        {spots.length > 0 ? (
          <div
            className="flex flex-col gap-3"
            style={{ paddingLeft: "var(--user-page-pad)", paddingRight: "var(--user-page-pad)" }}
          >
            {spots.map((s, i) => (
              <CanteenCard key={i} spot={s} onClick={() => navigate(`/app/menu/${s.id}`)} />
            ))}
          </div>
        ) : canteensLoading ? (
          <CanteenListSkeleton rows={3} />
        ) : (
          <div style={{ paddingLeft: "var(--user-page-pad)", paddingRight: "var(--user-page-pad)" }}>
            <div
              className="cb-glass flex flex-col items-center text-center"
              style={{ padding: "28px 24px", borderRadius: 28 }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.7)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  marginBottom: 14,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 28, color: "#2563EB" }}
                >
                  storefront
                </span>
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "#1D1D1F",
                  marginBottom: 6,
                }}
              >
                No canteens yet
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#6E6E73",
                  lineHeight: 1.5,
                  maxWidth: 280,
                }}
              >
                Canteens created in Master Admin will show up here for students to order from.
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
};

/* ---------------- Offer Card ---------------- */
const OfferCard = ({ offer, onClick }: { offer: Offer; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="cb-glass shrink-0 flex flex-col justify-between text-left"
    style={{ width: 260, height: 150, padding: "16px 20px" }}
  >
    <div className="relative z-10 flex items-center justify-between">
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "#6E6E73",
          textTransform: "uppercase",
        }}
      >
        {offer.canteen}
      </span>
      {offer.active && (
        <span
          className="flex items-center gap-1.5"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 999,
            padding: "3px 10px",
          }}
        >
          <span
            className="rounded-full animate-pulse"
            style={{ width: 6, height: 6, background: "#2563EB" }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#1D1D1F",
            }}
          >
            ACTIVE
          </span>
        </span>
      )}
    </div>

    <div className="relative z-10">
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "#1D1D1F",
          marginBottom: 4,
        }}
      >
        {offer.title}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#22C55E",
          lineHeight: 1,
        }}
      >
        {offer.discount}
      </div>
    </div>
  </button>
);

/* ---------------- Repeat Card ---------------- */
const RepeatCard = ({
  item,
  qty,
  onChange,
  onOrder,
}: {
  item: Repeat;
  qty: number;
  onChange: (n: number) => void;
  onOrder?: () => void;
}) => (
  <div
    className="cb-glass flex flex-col shrink-0"
    style={{
      width: "min(236px, calc(100% - 44px))",
      flexBasis: "min(236px, calc(100% - 44px))",
      minWidth: 0,
      minHeight: 118,
      boxSizing: "border-box",
      padding: 12,
      justifyContent: "center",
      scrollSnapAlign: "start",
      scrollSnapStop: "always",
    }}
  >
    <div className="relative z-10 flex flex-col" style={{ gap: 10 }}>
      <div className="flex items-center" style={{ gap: 10 }}>
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "rgba(255,255,255,0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.04)",
          fontSize: 24,
          lineHeight: 1,
        }}
      >
        {item.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center min-w-0" style={{ gap: 8 }}>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1D1D1F",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {item.name}
          </h3>
          {item.tag && (
            <span
              className="shrink-0"
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 5px",
                borderRadius: 999,
                background: "rgba(255,149,0,0.1)",
                color: "#BC4800",
                lineHeight: 1.25,
              }}
            >
              {item.tag}
            </span>
          )}
        </div>
      </div>
      </div>

      <div className="flex items-center justify-between" style={{ gap: 8, marginTop: 4 }}>
      <div
        className="flex items-center shrink-0"
        style={{
          background: "rgba(255,255,255,0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 999,
          padding: "1px 5px",
          gap: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <button
          type="button"
          onClick={() => onChange(qty - 1)}
          aria-label="decrease"
          style={{
            width: 24,
            height: 24,
            fontSize: 16,
            fontWeight: 700,
            color: "#6E6E73",
          }}
        >
          −
        </button>
        <span
          style={{
            minWidth: 12,
            textAlign: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "#1D1D1F",
          }}
        >
          {qty}
        </span>
        <button
          type="button"
          onClick={() => onChange(qty + 1)}
          aria-label="increase"
          style={{
            width: 24,
            height: 24,
            fontSize: 16,
            fontWeight: 700,
            color: "#2563EB",
          }}
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={onOrder}
        className="shrink-0"
        style={{
          background: "#2563EB",
          color: "#FFFFFF",
          fontSize: 11,
          fontWeight: 700,
          padding: "7px 10px",
          borderRadius: 999,
          boxShadow: "0 8px 18px -6px rgba(37,99,235,0.45)",
        }}
      >
        Order Now
      </button>
      </div>
    </div>
  </div>
);

/* ---------------- Canteen Card ---------------- */
const CanteenCard = ({ spot, onClick }: { spot: Spot; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="cb-pill flex items-center justify-between text-left w-full"
    style={{
      height: 88,
      padding: "16px 24px",
      borderRadius: 48,
      background: "rgba(255,255,255,0.55)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 6px 18px rgba(0,0,0,0.04)",
    }}
  >
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span style={{ fontSize: 26, lineHeight: 1 }}>{spot.icon}</span>
      </div>
      <div className="min-w-0">
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "#1D1D1F",
          }}
        >
          {spot.name}
        </div>
        <div style={{ fontSize: 13, color: "#6E6E73", marginTop: 2 }}>
          {spot.sub}
        </div>
      </div>
    </div>
    <span
      className="material-symbols-outlined"
      style={{ fontSize: 24, color: "#D2D2D7" }}
    >
      chevron_right
    </span>
  </button>
);

export default Home;
