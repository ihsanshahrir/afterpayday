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
      // Cloud data exists and either this device has no confirmed matching
      // revision or has unpushed local edits — never auto-merge a
      // whole-state document, let the user choose.
      setConflictBoth({ remote });
      setStatus("conflict");
    } catch (e) {
      setErrorMessage(e?.message || "Sync failed");
      setStatus("error");
    }
  }, []);

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

  // Debounced push whenever the app state changes while signed in.
  useEffect(() => {
    if (!SYNC_AVAILABLE || !session || conflict) return undefined;
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
      const normalized = importState(current.remote.doc);
      revRef.current = current.remote.rev;
      dirtyRef.current = false;
      const meta = { userId: sessionRef.current.user.id, rev: current.remote.rev, lastPushedAt: Date.now() };
      writeSyncMeta(meta);
      setLastSyncedAt(meta.lastPushedAt);
      setConflictBoth(null);
      setStatus("synced");
      if (normalized) onRemoteState(normalized);
    } else {
      // Keep this device: overwrite the cloud with local, using the known
      // remote rev so the CAS write succeeds.
      revRef.current = current.remote.rev;
      setConflictBoth(null);
      flushPush();
    }
  }, [onRemoteState, flushPush]);

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
