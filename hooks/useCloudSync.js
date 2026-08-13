import { useCallback, useEffect, useRef, useState } from "react";
import { SYNC_AVAILABLE } from "../utils/supabase.js";
import * as cloud from "../state/cloud.js";
import { importState, CURRENT_VERSION } from "../state/storage.js";
import { uid } from "../utils/id.js";

const SYNC_META_KEY = "afterpayday:sync";
const DEVICE_ID_KEY = "afterpayday:device";
const PUSH_DEBOUNCE_MS = 3000;

const readSyncMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(SYNC_META_KEY)) || {};
  } catch {
    return {};
  }
};

const writeSyncMeta = (meta) => {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    /* best-effort — a missed write only costs an extra conflict prompt later */
  }
};

const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = uid();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
};

// Cloud sync status machine: signed-out | syncing | synced | offline |
// conflict | error. `state` is the app's whole state doc (exactly what
// handleExport writes); `onRemoteState` is called with a normalized state to
// apply after a pull or a conflict resolved in favor of the cloud.
export default function useCloudSync({ state, onRemoteState }) {
  const [status, setStatus] = useState("signed-out");
  const [session, setSession] = useState(null);
  const [conflict, setConflict] = useState(null); // { remote: { doc, rev, updated_at } } | null
  const [errorMessage, setErrorMessage] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => readSyncMeta().lastPushedAt || null);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const sessionRef = useRef(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Mirrors `conflict` synchronously (a plain effect lags one render behind,
  // which matters because resolveConflict clears the conflict and immediately
  // triggers a push in the same tick).
  const conflictRef = useRef(null);
  const setConflictBoth = (value) => {
    conflictRef.current = value;
    setConflict(value);
  };

  const revRef = useRef(readSyncMeta().rev ?? null);
  const dirtyRef = useRef(false);
  const pushTimerRef = useRef(null);
  const pushingRef = useRef(false);
  // Tracks the `state` identity the debounced-push effect last saw, so it
  // can tell "state actually changed" apart from "this effect re-ran because
  // session/conflict changed identity" (e.g. sign-in resolving) — the latter
  // used to be misread as a local edit and made every reload look dirty.
  const prevStateRef = useRef(state);
  // Set right before a pull-driven state replacement (adoptCloud) so the
  // resulting re-render isn't itself mistaken for a local edit that needs
  // pushing back.
  const skipNextDirtyRef = useRef(false);

  // Read via ref rather than closed over directly, so adoptCloud (and
  // reconcile, which depends on it) stay referentially stable even if the
  // caller passes a non-memoized onRemoteState — reconcile's identity feeds
  // the auth-bootstrap effect's deps, and reconcile firing an extra time on
  // every unrelated re-render raced against the debounced push below.
  const onRemoteStateRef = useRef(onRemoteState);
  useEffect(() => { onRemoteStateRef.current = onRemoteState; }, [onRemoteState]);

  const adoptCloud = useCallback((userId, remote) => {
    const normalized = importState(remote.doc);
    revRef.current = remote.rev;
    dirtyRef.current = false;
    const meta = { userId, rev: remote.rev, lastPushedAt: Date.now() };
    writeSyncMeta(meta);
    setLastSyncedAt(meta.lastPushedAt);
    setConflictBoth(null);
    setStatus("synced");
    if (normalized) {
      skipNextDirtyRef.current = true;
      onRemoteStateRef.current(normalized);
    }
  }, []);

  const reconcile = useCallback(async (userId) => {
    setStatus("syncing");
    setErrorMessage(null);
    try {
      const remote = await cloud.pullState(userId);
      if (!remote) {
        const result = await cloud.pushState({
          userId, doc: stateRef.current, expectedRev: null, deviceId: getDeviceId(),
        });
        if (result.conflict) return reconcile(userId); // row appeared between pull and push
        revRef.current = result.rev;
        dirtyRef.current = false;
        const meta = { userId, rev: result.rev, lastPushedAt: Date.now() };
        writeSyncMeta(meta);
        setLastSyncedAt(meta.lastPushedAt);
        setStatus("synced");
        return;
      }
      if (Number(remote.doc?._version) > CURRENT_VERSION) {
        setErrorMessage("This account has data from a newer version of AfterPayday. Update the app to sync.");
        setStatus("error");
        return;
      }
      const localMeta = readSyncMeta();
      if (localMeta.userId === userId && localMeta.rev === remote.rev && !dirtyRef.current) {
        revRef.current = remote.rev;
        setStatus("synced");
        return;
      }
      if (!dirtyRef.current) {
        // This device has no unpushed edits, so there's nothing local to
        // lose — cloud is authoritative the moment the user is signed in.
        adoptCloud(userId, remote);
        return;
      }
      // This device has genuine unpushed edits that diverge from the cloud —
      // never auto-merge a whole-state document. Surface it via `status` /
      // `conflict` only; the user resolves it explicitly from Settings.
      setConflictBoth({ remote });
      setStatus("conflict");
    } catch (e) {
      setErrorMessage(e?.message || "Sync failed");
      setStatus("error");
    }
  }, [adoptCloud]);

  // Auth bootstrap + subscription.
  useEffect(() => {
    if (!SYNC_AVAILABLE) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const s = await cloud.getSession();
        if (cancelled) return;
        setSession(s);
        if (s) reconcile(s.user.id);
      } catch {
        /* treated as signed-out */
      }
    })();
    const unsub = cloud.onAuthChange((next) => {
      setSession(next);
      if (next) {
        reconcile(next.user.id);
      } else {
        revRef.current = null;
        dirtyRef.current = false;
        writeSyncMeta({});
        setConflictBoth(null);
        setErrorMessage(null);
        setStatus("signed-out");
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [reconcile]);

  const flushPush = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession || pushingRef.current || conflictRef.current) return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    pushingRef.current = true;
    setStatus("syncing");
    try {
      const result = await cloud.pushState({
        userId: activeSession.user.id,
        doc: stateRef.current,
        expectedRev: revRef.current,
        deviceId: getDeviceId(),
      });
      if (result.conflict) {
        const remote = await cloud.pullState(activeSession.user.id);
        setConflictBoth({ remote });
        setStatus("conflict");
        return;
      }
      revRef.current = result.rev;
      dirtyRef.current = false;
      const meta = { userId: activeSession.user.id, rev: result.rev, lastPushedAt: Date.now() };
      writeSyncMeta(meta);
      setLastSyncedAt(meta.lastPushedAt);
      setStatus("synced");
    } catch (e) {
      setErrorMessage(e?.message || "Sync failed");
      setStatus("error");
    } finally {
      pushingRef.current = false;
    }
  }, []);

  // Debounced push whenever the app state changes while signed in. Keyed on
  // [state, session, conflict] so it re-evaluates when any of them change,
  // but only a real `state` change should count as a local edit — session
  // resolving from null to a real session (on every app boot) or a conflict
  // clearing must not themselves be read as "the user edited something".
  useEffect(() => {
    const stateChanged = prevStateRef.current !== state;
    prevStateRef.current = state;
    if (!SYNC_AVAILABLE || !session || conflict || !stateChanged) return undefined;
    if (skipNextDirtyRef.current) {
      skipNextDirtyRef.current = false;
      return undefined;
    }
    dirtyRef.current = true;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(flushPush, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(pushTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, session, conflict]);

  // Mobile browsers can kill a backgrounded tab before the debounce timer
  // fires, so pagehide/visibilitychange are the last chance to flush.
  useEffect(() => {
    if (!SYNC_AVAILABLE) return undefined;
    const flushNow = () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        flushPush();
      }
    };
    const onOnline = () => {
      if (dirtyRef.current) flushPush();
      else if (sessionRef.current) reconcile(sessionRef.current.user.id);
    };
    const onFocus = () => {
      if (sessionRef.current) reconcile(sessionRef.current.user.id);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushNow);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushNow);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [flushPush, reconcile]);

  const resolveConflict = useCallback((choice) => {
    const current = conflictRef.current;
    if (!current || !sessionRef.current) return;
    if (choice === "cloud") {
      adoptCloud(sessionRef.current.user.id, current.remote);
    } else {
      // Keep this device: overwrite the cloud with local, using the known
      // remote rev so the CAS write succeeds.
      revRef.current = current.remote.rev;
      setConflictBoth(null);
      flushPush();
    }
  }, [adoptCloud, flushPush]);

  const signOut = useCallback(async () => {
    await cloud.signOut();
  }, []);

  return {
    available: SYNC_AVAILABLE,
    status,
    email: session?.user?.email || null,
    lastSyncedAt,
    conflict,
    errorMessage,
    signInWithGoogle: cloud.signInWithGoogle,
    signOut,
    syncNow: flushPush,
    resolveConflict,
  };
}
