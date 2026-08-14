// Module-scope capture of the `beforeinstallprompt` event. Chrome can fire
// this before React has mounted, so the listener is attached at import time
// (see the side-effect import in main.jsx) rather than inside a component
// effect, which would miss events that fire during the first paint.
import { INSTALL_PREF_KEY } from "./ui.js";

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setPromptEnabled(false);
  });
}

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const canInstall = () => deferredPrompt !== null;

// Whether the auto-popup should show. Routed through the same subscribe/
// notify channel as canInstall so every useInstallPrompt() instance stays
// in sync — a dismissal from inside InstallPromptModal must be reflected
// immediately in the Settings toggle rendered by a different component.
export function isPromptEnabled() {
  try { return localStorage.getItem(INSTALL_PREF_KEY) !== "0"; }
  catch (_) { return true; }
}

export function setPromptEnabled(enabled) {
  try {
    if (enabled) localStorage.removeItem(INSTALL_PREF_KEY);
    else localStorage.setItem(INSTALL_PREF_KEY, "0");
  } catch (_) { /* ignore */ }
  notify();
}

export async function triggerInstall() {
  if (!deferredPrompt) return "unavailable";
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null; // single-use per the spec
  notify();
  return outcome; // "accepted" | "dismissed"
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator?.standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS reports as "MacIntel" but exposes multi-touch, unlike a real Mac.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isMobile() {
  if (typeof window === "undefined") return false;
  if (isIOS()) return true;
  if (/android/i.test(navigator.userAgent || "")) return true;
  return (
    window.matchMedia?.("(pointer: coarse)").matches &&
    window.matchMedia?.("(max-width: 900px)").matches
  );
}

export function isInstallEligible() {
  if (isStandalone() || !isMobile()) return false;
  return canInstall() || isIOS();
}
