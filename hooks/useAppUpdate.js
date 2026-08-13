import { useRegisterSW } from "virtual:pwa-register/react";

export default function useAppUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return {
    updateReady: needRefresh,
    applyUpdate: () => updateServiceWorker(true),
  };
}
