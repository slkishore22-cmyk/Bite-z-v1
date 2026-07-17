# Bitez - System Flow & Developer Skill Guide

This document provides a comprehensive end-to-end walkthrough of the **Bitez** canteen ordering application, detailing its UI/UX structures, backend flows, and the technical patterns ("skills") established in this codebase.

---

## 1. End-to-End Application Flow

The app operates via three main components: the **Customer App** (React), the **Seller Portal** (React), and the **Mobile Scanner / Thermal Printer API** (Supabase Deno Edge Functions).

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (React)
    actor Seller as Seller / Staff (React)
    actor Scanner as Flutter Scanner App
    participant DB as Supabase Database
    participant Edge as Deno Edge Functions

    Customer->>Edge: 1. Checkout (op: "create_upi" / fallback client insert)
    DB-->>Customer: 2. Order created (status: "pending" / "qr_generated")
    Customer->>Customer: 3. Displays QR screen (realtime listen on order status)
    
    rect rgb(30, 30, 40)
        note right of Scanner: Scan order QR code on customer phone
        Scanner->>Edge: 4. API Request: scan-order (API key + qr_code)
        Edge->>DB: 5. Fetch order & verify canteen ID
        Edge->>DB: 6. Update order status to "scanned"
        Edge-->>Scanner: 7. Return print-ready thermal receipt text
    end

    DB-->>Customer: 8. Realtime sync updates status to "scanned"
    Customer->>Customer: 9. "Pay Now" button revealed -> Launch UPI app
    Customer->>DB: 10. Update status to "preparing" (payment confirmed)
    Seller->>DB: 11. Dashboard updates in realtime -> Prep starts
```

---

## 2. UI/UX & Routing Architecture

### A. Customer App Paths
- **Authentication (`/app/login`, `/app/signup`)**: Custom login/signup bypassing standard Supabase Auth (using custom credentials stored in the `public.users` table). Session data is stored in the browser's `localStorage` via the `sessionManager`.
- **Canteen & Menu browsing (`/app/home`, `/app/menu/:id`)**: Displays canteens and allows real-time cart selection.
- **Cart (`/app/cart`)**: Allows adjusting item quantities and clearing cart items.
- **Finalize Checkout (`/app/payment`)**:
  - **Cash (COD)**: Validates canteen time windows server-side and routes order creation through `analytics-orders` Edge Function.
  - **UPI payment**: Generates a local UUID, calls the Edge Function to insert the order, and falls back to direct client-side insert if Edge Functions are offline.
- **Scan Verification Screen (`/order-qr?id=ORDER_ID`)**: Renders custom payment details and listens to DB changes in real-time. Changes status from `pending` -> `scanned` (shows "Pay Now" button) -> `preparing` (redirects to status screen).
- **Status Dashboard (`/app/order-status`)**: Displays active prep status.

### B. Seller Portal Paths
- **Seller Login (`/seller/login`)**: Custom credentials verification using a secure database RPC (`verify_seller_password`).
- **Dashboard & Orders (`/seller/orders`)**: Real-time dashboard showing incoming orders. Includes a simulated scanner button to process scans from the desktop portal.
- **Inventory & Settings (`/seller/inventory`, `/seller/settings`)**: Manage active stock and items. Settings tab displays API keys (`x-api-key`) for connecting physical Flutter scanners.

---

## 3. Flutter Scanner & Thermal Printer API

Physical Android/iOS scanner devices interface with the database via the Deno `scan-order` Edge Function:

1. **Authentication**: Mobile scanners authenticate using the `x-api-key` header matching records in the `canteen_scanners` table.
2. **Scan Processing**: The scanner posts the scanned QR UUID (`qr_code`). The function checks if the order is already processed, updates the database status to `scanned`, and logs the device metadata.
3. **Thermal Printing**: The function returns a plain-text thermal-ready receipt payload formatted with line characters, center padding, and rupees (`Rs.`) alignments. The scanner pipes this directly to the thermal printer via Bluetooth/USB.

---

## 4. Key Developer Patterns ("Skills")

These established patterns are used throughout the project to maintain security, compatibility, and speed:

### Skill 1: RLS Bypass using Serverless Proxies
Since both customers and sellers authenticate via custom database columns rather than standard Supabase Auth, they are anonymous (`auth.uid() = null`) in the context of Supabase client policies. To secure table modifications:
- Avoid direct database writes from the client on restricted tables.
- Route inserts/updates through serverless Deno Edge Functions using the `service_role` client (`adminClient`) which naturally bypasses RLS rules on the server.

### Skill 2: Resilient Client-Side Fallbacks
To protect checkout and scan operations if Edge Functions go offline or fail to deploy:
- Implement a try-catch block wrapping the Edge Function call.
- If it fails, fall back to executing a direct client-side database query/update as a backup:
```typescript
try {
  // 1. Try server-side Edge Function first
  const { data } = await supabase.functions.invoke("scan-order", { body: { qr_code } });
  if (!data?.success) throw new Error();
} catch {
  // 2. Fall back to client-side database query if server is offline
  await supabase.from("orders").update({ status: "confirmed" }).eq("id", orderId);
}
```

### Skill 3: Migration-less Metadata Serialization
To store custom, dynamic data points (such as the cart items snapshot, payment metadata, or scanner telemetry) without triggering schema cache errors:
- Store values as a serialized JSON string in a standard, pre-existing database text column (e.g., `notes`).
- The client and server simply run `JSON.stringify` on write and `JSON.parse` on read. This avoids adding new database columns which might fail to resolve on remote clients due to PostgREST schema cache lags.

### Skill 4: Time-based Stock Checking & Safe Reduction
To prevent ghost orders and race conditions during peak hours:
- Check items stock right before persisting the order using Deno backend queries.
- Execute stock decrement using a database RPC function (`reduce_seller_stock`) to perform atomic decreases on the database server.

---

## 5. UI/UX Flow & UI-Related Design Skills

### Skill 5: Premium Glassmorphism Design System
The checkout interfaces are built with dynamic CSS design tokens that create a premium feel without requiring complex graphic assets:
- **Liquid Glass Overlay**: Uses semi-transparent backgrounds combined with high-blur backdrop filters and inset borders to simulate refractive glass material:
  ```typescript
  const liquidGlass = {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(40px)",
    borderRadius: 26,
    boxShadow: "inset 0 1.5px 0 0 rgba(255,255,255,0.55), 0 8px 32px rgba(0,0,0,0.06)",
    border: "1px solid rgba(0,0,0,0.03)",
  };
  ```
- **Reflection Highlights**: Employs absolute-positioned top gradients (`glassHighlight`) to simulate standard light reflection angles:
  ```typescript
  const glassHighlight = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)",
  };
  ```

### Skill 6: Live Status Sync via Real-time UI State Transitions
To keep the customer UI aligned with backend scanning (avoiding manual screen refreshing):
- **Real-time subscriptions**: The app subscribes to PostgreSQL database changes on `public.orders` using Supabase Realtime:
  ```typescript
  const channel = supabase
    .channel(`order-status-${orderId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, (payload) => {
       const updatedOrder = payload.new;
       setOrderStatus(updatedOrder.status);
    })
    .subscribe();
  ```
- **Dynamic Transition UX**: The customer screen changes layout based on status:
  - `"pending"` / `"qr_generated"` -> Displays a scanning animation and the payment QR code.
  - `"scanned"` -> Automatically plays a success alert and reveals the primary checkout **"Pay Now"** button.
  - `"preparing"` -> Instantly auto-redirects the user to the active kitchen order status page.

### Skill 7: Mobile-first Safe Area & PWA Integration
The app is optimized to run as a standalone Progressive Web App (PWA) with a premium mobile native-app-like feel:
- **PWA Route Sync**: Re-injects PWA headers (`apple-mobile-web-app-capable`, theme colors) dynamically upon React routing using a dedicated listener component (`PwaRouteSync`).
- **iOS Safe Areas**: Layout files enforce `var(--ios-pwa-safe-top)` and `var(--ios-pwa-top-breathing)` styling padding, preventing native status bars or notch overlaps.
- **Stand-alone Navigation**: Implements custom bottom menus (`LiquidGlassNav`) hidden inside desktop environments but revealed in mobile stand-alone viewports.

### Skill 8: Micro-Animations & Haptic Feedback Triggers
Interaction quality is enhanced through subtle motion and physical haptics:
- **Animations**: Renders layout transitions (`framer-motion` and custom CSS slide-ups) to animate item card popups, payment confirmations, and receipt panels smoothly.
- **Physical Haptics**: Triggers device vibration patterns on successful scans, checkout selections, or warnings using the browser's standard navigator haptic bindings (`navigator.vibrate` wrapped inside `src/lib/haptics.ts`) to provide instant user feedback.

