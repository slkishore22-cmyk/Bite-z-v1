import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LiquidGlassNav from "@/components/LiquidGlassNav";

const tabs = ["home", "orders", "cart"] as const;
type UserTab = (typeof tabs)[number];

const tabToPath: Record<UserTab, string> = {
  home: "/app/home",
  orders: "/app/orders",
  cart: "/app/cart",
};

const pathToTab = (pathname: string) => {
  const entry = Object.entries(tabToPath).find(([, p]) => pathname.startsWith(p));
  return (entry?.[0] as UserTab | undefined) ?? "home";
};

const UserLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = pathToTab(pathname);
  // Warm the three bottom-nav routes in the background so cross-tab
  // navigation is instant after first paint of any user page.
  useEffect(() => {
    const idle = (cb: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void };
      if (w.requestIdleCallback) w.requestIdleCallback(cb);
      else setTimeout(cb, 200);
    };
    idle(() => {
      void import("@/pages/user/Home");
      void import("@/pages/user/Cart");
      void import("@/pages/user/Orders");
    });
  }, []);
  const isMenuPage = pathname.startsWith("/app/menu/");
  const hideNav =
    isMenuPage ||
    pathname.startsWith("/app/payment") ||
    pathname.startsWith("/app/order-status");

  const navigateToTab = useCallback(
    (tab: UserTab) => {
      const nextPath = tabToPath[tab];
      if (!nextPath || nextPath === pathname) return;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([10]);
      }
      navigate(nextPath);
    },
    [navigate, pathname],
  );

  return (
    <div className={`user-shell${hideNav ? "" : " user-shell-with-nav"}`}>
      <div className="user-route-bg" aria-hidden="true" />
      <div className="user-route-content">{children}</div>
      {!hideNav && (
        <LiquidGlassNav activeId={active} onChange={(id) => navigateToTab(id as UserTab)} />
      )}
    </div>
  );
};

export default UserLayout;
