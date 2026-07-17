// Lightweight device / launch-mode detection helpers.

export const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

export const isStandalonePWA = () => {
  if (typeof window === "undefined") return false;
  const nav = window.navigator;
  const iosStandalone = nav && nav.standalone === true;
  const displayStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  return Boolean(iosStandalone || displayStandalone);
};

export const isIOSPWA = () => {
  if (typeof window === "undefined") return false;
  return isIOS() && isStandalonePWA();
};

export const isSafariBrowser = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|crios|fxios|android/i.test(ua);
};