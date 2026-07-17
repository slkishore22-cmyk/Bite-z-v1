// Lightweight haptic helper. No-ops on unsupported devices.
// Use sparingly: only on confirmations / nav changes / destructive taps.

const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export const haptic = {
  light: () => canVibrate() && navigator.vibrate(8),
  medium: () => canVibrate() && navigator.vibrate(15),
  success: () => canVibrate() && navigator.vibrate([10, 40, 10]),
  error: () => canVibrate() && navigator.vibrate([30, 60, 30]),
};

/**
 * Install a passive global listener that fires a tiny haptic on any tap
 * targeting a button/link. Costs ~nothing and gives the whole app a
 * native-app feel without per-component changes.
 */
export function installGlobalTapHaptics() {
  if (typeof window === "undefined" || !canVibrate()) return () => {};
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        "button, a, [role='button'], [role='link'], [data-tappable='true']",
      )
    ) {
      navigator.vibrate?.(6);
    }
  };
  window.addEventListener("pointerdown", onPointer, { passive: true });
  return () => window.removeEventListener("pointerdown", onPointer);
}