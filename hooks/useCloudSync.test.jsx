import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

// Normally set by @testing-library/react's setup; this repo has no such
// dependency (see the renderHook comment below), so React's `act` needs the
// flag set directly or it warns on every call without failing anything.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../utils/supabase.js", () => ({ SYNC_AVAILABLE: true }));
vi.mock("../state/cloud.js", () => ({
  getSession: vi.fn(),
  onAuthChange: vi.fn(() => () => {}),
  pullState: vi.fn(),
  pushState: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
}));

import * as cloud from "../state/cloud.js";
import useCloudSync from "./useCloudSync.js";

// Minimal renderHook — this repo has no @testing-library/react and its
// existing UI tests stay visual (see DESIGN.md); this uses only
// react-dom/client + react's own `act`, already dependencies. Every mounted
// root is tracked and torn down in afterEach so a hook instance from one
// test can't leave stray window/document listeners for the next.
let mountedRoots = [];

function renderHook(callback, initialProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const result = { current: undefined };

  function TestComponent({ props }) {
    result.current = callback(props);
    return null;
  }

  act(() => {
    root.render(<TestComponent props={initialProps} />);
  });

  mountedRoots.push({ root, container });

  return {
    result,
    rerender: (props) => act(() => { root.render(<TestComponent props={props} />); }),
    unmount: () => act(() => root.unmount()),
  };
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const session = { user: { id: "u1", email: "a@b.com" } };
const baseState = { _version: 3, dailyExpenses: [], fixedExpenses: [], debtGroups: [], history: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  cloud.getSession.mockResolvedValue(session);
  cloud.onAuthChange.mockReturnValue(() => {});
});

afterEach(() => {
  mountedRoots.forEach(({ root, container }) => {
    act(() => root.unmount());
    container.remove();
  });
  mountedRoots = [];
  vi.useRealTimers();
});

describe("useCloudSync — reconcile", () => {
  it("pushes local state as the first version when no cloud row exists", async () => {
    cloud.pullState.mockResolvedValue(null);
    cloud.pushState.mockResolvedValue({ ok: true, rev: 1 });

    renderHook((props) => useCloudSync(props), { state: baseState, onRemoteState: vi.fn() });
    await flush();

    expect(cloud.pushState).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", expectedRev: null })
    );
  });

  it("surfaces a conflict instead of silently adopting cloud when this device has unsynced local data from a first-time sign-in", async () => {
    const onRemoteState = vi.fn();
    cloud.pullState.mockResolvedValue({ doc: baseState, rev: 5, updated_at: "now" });
    const localState = { ...baseState, dailyExpenses: [{ id: "guest-entry" }] };

    const { result } = renderHook((props) => useCloudSync(props), { state: localState, onRemoteState });
    await flush();

    expect(onRemoteState).not.toHaveBeenCalled();
    expect(result.current.status).toBe("conflict");
    expect(result.current.conflict).toEqual({ remote: { doc: baseState, rev: 5, updated_at: "now" } });
  });

  it("silently adopts cloud on a first-time sign-in when this device has no local data", async () => {
    const onRemoteState = vi.fn();
    cloud.pullState.mockResolvedValue({ doc: baseState, rev: 5, updated_at: "now" });

    const { result } = renderHook((props) => useCloudSync(props), { state: baseState, onRemoteState });
    await flush();

    expect(onRemoteState).toHaveBeenCalled();
    expect(result.current.status).toBe("synced");
    expect(result.current.conflict).toBeNull();
  });

  it("refuses a remote doc newer than CURRENT_VERSION without importing it", async () => {
    const onRemoteState = vi.fn();
    cloud.pullState.mockResolvedValue({ doc: { _version: 99 }, rev: 1, updated_at: "now" });

    const { result } = renderHook((props) => useCloudSync(props), { state: baseState, onRemoteState });
    await flush();

    expect(onRemoteState).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/newer version/i);
  });
});

describe("useCloudSync — push scheduling", () => {
  const seedSyncedMeta = () => {
    localStorage.setItem("afterpayday:sync", JSON.stringify({ userId: "u1", rev: 1 }));
    cloud.pullState.mockResolvedValue({ doc: baseState, rev: 1, updated_at: "now" });
  };

  it("coalesces rapid state changes into a single debounced push", async () => {
    seedSyncedMeta();
    cloud.pushState.mockResolvedValue({ ok: true, rev: 2 });

    const { rerender } = renderHook((props) => useCloudSync(props), {
      state: baseState, onRemoteState: vi.fn(),
    });
    await flush();
    expect(cloud.pushState).not.toHaveBeenCalled();

    rerender({ state: { ...baseState, dailyExpenses: [{ id: "1" }] }, onRemoteState: vi.fn() });
    act(() => { vi.advanceTimersByTime(1500); });
    rerender({ state: { ...baseState, dailyExpenses: [{ id: "1" }, { id: "2" }] }, onRemoteState: vi.fn() });
    act(() => { vi.advanceTimersByTime(1500); });
    expect(cloud.pushState).not.toHaveBeenCalled(); // still within the debounce window

    act(() => { vi.advanceTimersByTime(1500); });
    await flush();

    expect(cloud.pushState).toHaveBeenCalledTimes(1);
    expect(cloud.pushState).toHaveBeenCalledWith(
      expect.objectContaining({ doc: expect.objectContaining({ dailyExpenses: [{ id: "1" }, { id: "2" }] }) })
    );
  });

  it("flushes a pending push immediately on pagehide", async () => {
    seedSyncedMeta();
    cloud.pushState.mockResolvedValue({ ok: true, rev: 2 });

    const { rerender } = renderHook((props) => useCloudSync(props), {
      state: baseState, onRemoteState: vi.fn(),
    });
    await flush();

    rerender({ state: { ...baseState, dailyExpenses: [{ id: "1" }] }, onRemoteState: vi.fn() });
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    await flush();

    expect(cloud.pushState).toHaveBeenCalledTimes(1);
  });

  it("does not push while offline", async () => {
    seedSyncedMeta();
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    try {
      const { result, rerender } = renderHook((props) => useCloudSync(props), {
        state: baseState, onRemoteState: vi.fn(),
      });
      await flush();

      rerender({ state: { ...baseState, dailyExpenses: [{ id: "1" }] }, onRemoteState: vi.fn() });
      act(() => { vi.advanceTimersByTime(3000); });
      await flush();

      expect(cloud.pushState).not.toHaveBeenCalled();
      expect(result.current.status).toBe("offline");
    } finally {
      delete navigator.onLine; // restores jsdom's prototype getter (true)
    }
  });
});
