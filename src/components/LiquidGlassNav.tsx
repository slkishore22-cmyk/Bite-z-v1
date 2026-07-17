import { useEffect, useState } from "react";
import { Home, ReceiptText, ShoppingCart, type LucideIcon } from "lucide-react";
import { getCart, subscribeCart } from "@/lib/userCart";
import { getOrders, subscribeOrders } from "@/lib/sellerOrders";

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "orders", label: "Orders", icon: ReceiptText },
  { id: "cart", label: "Cart", icon: ShoppingCart },
];

export const LiquidGlassNav = ({
  activeId = "home",
  onChange,
}: {
  activeId?: string;
  onChange?: (id: string) => void;
}) => {
  const [hasActiveCart, setHasActiveCart] = useState(() => getCart().length > 0);
  const [hasActiveOrder, setHasActiveOrder] = useState(() =>
    getOrders().some((o) => o.status === "Pending"),
  );
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => {
      setIsKeyboardOpen(vv.height < window.innerHeight * 0.82);
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const refreshCart = () => setHasActiveCart(getCart().length > 0);
    const refreshOrders = () =>
      setHasActiveOrder(getOrders().some((o) => o.status === "Pending"));
    const unsubCart = subscribeCart(refreshCart);
    const unsubOrders = subscribeOrders(refreshOrders);
    refreshCart();
    refreshOrders();
    return () => {
      unsubCart();
      unsubOrders();
    };
  }, []);

  const handleSelect = (id: string) => {
    if (id === activeId) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([10]);
    }
    onChange?.(id);
  };

  if (isKeyboardOpen) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex w-full items-stretch"
      style={{
        height: "calc(var(--user-bottom-nav-height) + var(--user-bottom-nav-safe, 0px))",
        paddingBottom: "var(--user-bottom-nav-safe, 0px)",
        background:
          "linear-gradient(135deg, hsl(var(--user-surface) / 0.92), hsl(var(--user-app-bg-soft) / 0.86))",
        borderTop: "1px solid hsl(var(--user-border) / 0.78)",
        backdropFilter: "blur(22px) saturate(135%)",
        WebkitBackdropFilter: "blur(22px) saturate(135%)",
        boxShadow:
          "0 -8px 30px hsl(220 25% 40% / 0.08)",
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        const showBadge =
          (item.id === "cart" && hasActiveCart) ||
          (item.id === "orders" && hasActiveOrder);
        return (
          <button
            type="button"
            key={item.id}
            onPointerDown={(e) => {
              // Fire on pointerdown for native-app feel (saves ~100-300ms vs click)
              if (e.pointerType !== "mouse" || e.button === 0) handleSelect(item.id);
            }}
            onClick={(e) => {
              // Fallback for environments without pointer events; prevent double-fire.
              e.preventDefault();
            }}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 outline-none transition-colors"
            style={{
              color: "hsl(var(--user-text))",
              opacity: isActive ? 1 : 0.62,
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span className="relative">
              <Icon size={24} strokeWidth={isActive ? 2.4 : 2} />
              {showBadge && (
                <span
                  className="absolute -top-1 -right-1 h-2 w-2 rounded-full"
                  style={{
                    background: "#FF3B30",
                    boxShadow: "0 0 0 2px hsl(var(--user-surface) / 0.95)",
                  }}
                />
              )}
            </span>
            <span className="text-[11px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default LiquidGlassNav;
