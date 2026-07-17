/**
 * useOrderConfirmation.js
 * ─────────────────────────────────────────────────────────────────
 * React hook that preloads the sound on mount and exposes
 * a single `confirm()` function to call on payment success.
 *
 * HOW TO USE:
 *
 *   import { useOrderConfirmation } from './useOrderConfirmation';
 *
 *   function PaymentPage() {
 *     const { confirm } = useOrderConfirmation();
 *
 *     const handlePayNow = async () => {
 *       // ... your payment logic ...
 *       await processPayment();
 *
 *       // ← call this right here, payment success moment
 *       confirm();
 *
 *       // ... navigate to order confirmation screen ...
 *       navigate('/order-confirmed');
 *     };
 *   }
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useCallback } from 'react';
import { playOrderConfirmation, preloadOrderSound } from './orderConfirmation';

export function useOrderConfirmation() {
  // Preload audio the moment the component mounts
  // so there is ZERO delay when payment succeeds
  useEffect(() => {
    preloadOrderSound();
  }, []);

  // The confirm function — call this on payment success
  const confirm = useCallback(async () => {
    await playOrderConfirmation();
  }, []);

  return { confirm };
}
