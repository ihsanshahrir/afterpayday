import { useCallback, useEffect, useRef, useState } from "react";
import { SYNC_AVAILABLE } from "../utils/supabase.js";
import * as cloud from "../state/cloud.js";
import { importState, CURRENT_VERSION } from "../state/storage.js";
import { stateEntryCount } from "../state/derive.js";
import { uid } from "../utils/id.js";

const SYNC_META_KEY = "afterpayday:sync";
const DEVICE_ID_KEY = "afterpayday:device";
const PUSH_DEBOUNCE_MS = 3000;
// Backoff for retrying a failed push (network blip, Supabase waking from a
// pause, 5xx): 5s, 10s, 20s … capped at 5 minutes.
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 5 * 60 * 1000;

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
  const retryAttemptRef = useRef(0);
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

  const flushPush = useCallback(async () => {
    // Whatever scheduled this call (debounce, retry, pagehide) has now fired.
    // Clearing the ref lets the post-push check below tell whether another
    // push is already queued.
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = null;
    const activeSession = sessionRef.current;
    if (!activeSession || pushingRef.current || conflictRef.current) return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    pushingRef.current = true;
    setStatus("syncing");
    const doc = stateRef.current;
    try {
      const result = await cloud.pushState({
        userId: activeSession.user.id,
        doc,
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
      retryAttemptRef.current = 0;
      // An edit made while this push was in flight isn't in `doc`. Its own
      // debounced push may have fired mid-flight and bailed on pushingRef, so
      // keep it dirty and queue another push rather than marking it synced.
      dirtyRef.current = stateRef.current !== doc;
      const meta = { userId: activeSession.user.id, rev: result.rev, lastPushedAt: Date.now() };
      writeSyncMeta(meta);
      setLastSyncedAt(meta.lastPushedAt);
      if (dirtyRef.current) {
        if (!pushTimerRef.current) pushTimerRef.current = setTimeout(flushPush, PUSH_DEBOUNCE_MS);
      } else {
        setStatus("synced");
      }
    } catch (e) {
      setErrorMessage(e?.message || "Sync failed");
      setStatus("error");
      // Don't leave edits stranded until the next change — retry with
      // backoff. A new edit reschedules on its own debounce anyway.
      if (dirtyRef.current && !pushTimerRef.current && !e?.permanent) {
        const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttemptRef.current, RETRY_MAX_MS);
        retryAttemptRef.current += 1;
        pushTimerRef.current = setTimeout(flushPush, delay);
      }
    } finally {
      pushingRef.current = false;
    }
  }, []);

  const reconcile = useCallback(async (userId) => {
    // A pull racing an in-flight push can see either rev and misread this
    // device's own write as a conflict; the push settles the state anyway.
    if (pushingRef.current) return;
    setStatus("syncing");
    setErrorMessage(null);
    try {
      const localMeta = readSyncMeta();
      const knownRev = localMeta.userId === userId ? localMeta.rev : null;
      // Common case on every focus/online: probe the rev alone and only
      // download the whole doc if the cloud actually moved.
      if (knownRev != null) {
        const head = await cloud.pullRev(userId);
        if (head?.rev === knownRev) {
          revRef.current = knownRev;
          // Any local edits are simply unpushed (e.g. focus returned inside
          // the debounce window) — push them instead of flagging a conflict.
          if (dirtyRef.current) flushPush();
          else setStatus("synced");
          return;
        }
      }
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
      // A device this account has never synced before can't be trusted as
      // "nothing to lose" just because dirtyRef is unset — dirtyRef only
      // tracks edits made *while signed in*, so guest-mode edits made before
      // this sign-in wouldn't have set it. Treat those as a real conflict
      // instead of silently discarding them in favor of the cloud.
      const neverSyncedOnThisDevice = localMeta.userId !== userId;
      const hasUnsyncedLocalData = neverSyncedOnThisDevice && stateEntryCount(stateRef.current) > 0;
      if (!dirtyRef.current && !hasUnsyncedLocalData) {
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
  }, [adoptCloud, flushPush]);

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
        retryAttemptRef.current = 0;
        if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
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
    return () => {
      clearTimeout(pushTimerRef.current);
      // Null it too: flushPush reads a non-null ref as "a push is queued".
      pushTimerRef.current = null;
    };
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
