import { useCallback, useSyncExternalStore } from "react";
import {
  subscribe,
  canInstall,
  triggerInstall,
  isIOS,
  isInstallEligible,
  isMobile,
  isStandalone,
  isPromptEnabled,
  setPromptEnabled as setPromptEnabledPref,
} from "../utils/installPrompt.js";

const getSettingsVisible = () => isMobile() && !isStandalone();

export default function useInstallPrompt() {
  // All derived from module-level state in utils/installPrompt.js, so every
  // component using this hook re-renders together on the same pub/sub —
  // a dismissal in one instance (e.g. InstallPromptModal) is immediately
  // visible in another (e.g. the Settings toggle).
  const canInstallNow = useSyncExternalStore(subscribe, canInstall, () => false);
  const eligible = useSyncExternalStore(subscribe, isInstallEligible, () => false);
  const settingsVisible = useSyncExternalStore(subscribe, getSettingsVisible, () => false);
  const promptEnabled = useSyncExternalStore(subscribe, isPromptEnabled, () => true);

  const setPromptEnabled = useCallback((enabled) => setPromptEnabledPref(enabled), []);

  const install = useCallback(async () => {
    const outcome = await triggerInstall();
    if (outcome !== "unavailable") setPromptEnabledPref(false);
    return outcome;
  }, []);

  return {
    eligible,
    settingsVisible,
    isIOS: isIOS(),
    canInstallNow,
    promptEnabled,
    setPromptEnabled,
    install,
  };
}
