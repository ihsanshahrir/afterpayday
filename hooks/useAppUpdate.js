import { useRegisterSW } from "virtual:pwa-register/react";

// An installed PWA can stay open for days without a navigation, so the
// browser's own update check (which runs on navigation) never fires. Poll
// hourly and whenever the app comes back to the foreground instead.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export default function useAppUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine && !registration.installing) {
          registration.update().catch(() => { /* retried on the next check */ });
        }
      };
      setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  return {
    updateReady: needRefresh,
    applyUpdate: () => updateServiceWorker(true),
  };
}
