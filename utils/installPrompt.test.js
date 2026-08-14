import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  subscribe,
  canInstall,
  triggerInstall,
  isStandalone,
  isIOS,
  isMobile,
  isInstallEligible,
} from "./installPrompt.js";
import { INSTALL_PREF_KEY } from "./ui.js";

const setUA = (ua) => Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
const setPlatform = (platform) => Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
const setMaxTouchPoints = (n) => Object.defineProperty(navigator, "maxTouchPoints", { value: n, configurable: true });
const setStandalone = (v) => Object.defineProperty(navigator, "standalone", { value: v, configurable: true });

const stubMatchMedia = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: typeof matches === "function" ? matches(query) : matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

const androidUA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36";
const iphoneUA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const desktopUA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

describe("installPrompt platform detection", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("isIOS is true for an iPhone UA", () => {
    setUA(iphoneUA);
    setPlatform("iPhone");
    setMaxTouchPoints(5);
    expect(isIOS()).toBe(true);
  });

  it("isIOS is true for iPadOS reporting as MacIntel with touch support", () => {
    setUA(desktopUA);
    setPlatform("MacIntel");
    setMaxTouchPoints(5);
    expect(isIOS()).toBe(true);
  });

  it("isIOS is false for a real Mac (MacIntel, no touch)", () => {
    setUA(desktopUA);
    setPlatform("MacIntel");
    setMaxTouchPoints(0);
    expect(isIOS()).toBe(false);
  });

  it("isMobile is true on Android UA", () => {
    setUA(androidUA);
    setPlatform("Linux armv8l");
    setMaxTouchPoints(5);
    stubMatchMedia(false);
    expect(isMobile()).toBe(true);
  });

  it("isMobile is false on desktop with fine pointer", () => {
    setUA(desktopUA);
    setPlatform("MacIntel");
    setMaxTouchPoints(0);
    stubMatchMedia(false);
    expect(isMobile()).toBe(false);
  });

  it("isStandalone reads navigator.standalone and display-mode", () => {
    stubMatchMedia(false);
    setStandalone(true);
    expect(isStandalone()).toBe(true);
    setStandalone(false);
    stubMatchMedia((q) => q.includes("standalone"));
    expect(isStandalone()).toBe(true);
  });
});

describe("installPrompt eligibility + capture", () => {
  beforeEach(() => {
    localStorage.clear();
    setStandalone(false);
    stubMatchMedia(false);
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("is not eligible when standalone", () => {
    setUA(androidUA);
    setPlatform("Linux armv8l");
    setMaxTouchPoints(5);
    setStandalone(true);
    expect(isInstallEligible()).toBe(false);
  });

  it("is not eligible on desktop", () => {
    setUA(desktopUA);
    setPlatform("MacIntel");
    setMaxTouchPoints(0);
    expect(isInstallEligible()).toBe(false);
  });

  it("is eligible on iOS mobile even without a captured event", () => {
    setUA(iphoneUA);
    setPlatform("iPhone");
    setMaxTouchPoints(5);
    expect(isInstallEligible()).toBe(true);
  });

  it("captures beforeinstallprompt, notifies subscribers, and becomes eligible on Android", async () => {
    setUA(androidUA);
    setPlatform("Linux armv8l");
    setMaxTouchPoints(5);
    expect(canInstall()).toBe(false);

    const heard = vi.fn();
    const unsubscribe = subscribe(heard);

    const prompt = vi.fn();
    const userChoice = Promise.resolve({ outcome: "accepted" });
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = prompt;
    event.userChoice = userChoice;
    window.dispatchEvent(event);

    expect(canInstall()).toBe(true);
    expect(isInstallEligible()).toBe(true);
    expect(heard).toHaveBeenCalled();

    const outcome = await triggerInstall();
    expect(prompt).toHaveBeenCalled();
    expect(outcome).toBe("accepted");
    expect(canInstall()).toBe(false); // single-use

    unsubscribe();
  });

  it("triggerInstall resolves 'unavailable' with no captured event", async () => {
    const outcome = await triggerInstall();
    expect(outcome).toBe("unavailable");
  });

  it("appinstalled clears the deferred event and sets the dismissal pref", () => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = vi.fn();
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
    expect(canInstall()).toBe(true);

    window.dispatchEvent(new Event("appinstalled"));
    expect(canInstall()).toBe(false);
    expect(localStorage.getItem(INSTALL_PREF_KEY)).toBe("0");
  });
});
