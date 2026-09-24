// Pure transport layer for cloud sync — no React. Talks to Supabase via the
// lazily-created client from utils/supabase.js. Every function assumes
// SYNC_AVAILABLE is true; callers gate on that before importing/calling this.
import { getSupabase } from "../utils/supabase.js";

const TABLE = "app_state";

// SQLSTATE for a CHECK violation — the app_state_doc_shape constraint
// (supabase/migrations/*_harden_app_state.sql) caps the doc at 2 MB.
const CHECK_VIOLATION = "23514";

// Marks errors that retrying can't fix, so the sync hook doesn't back off
// and hammer the database with the same rejected write.
const permanentError = (message) => Object.assign(new Error(message), { permanent: true });

const toPushError = (error) =>
  error.code === CHECK_VIOLATION
    ? permanentError("Your data is too large to sync. Export a backup, then clear out old entries.")
    : error;

export async function getSession() {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session;
}

// Subscribes to auth state changes. Returns an unsubscribe function.
export function onAuthChange(callback) {
  let subscription = null;
  let cancelled = false;
  getSupabase().then((sb) => {
    if (cancelled) return;
    const { data } = sb.auth.onAuthStateChange((_event, session) => callback(session));
    subscription = data.subscription;
  });
  return () => {
    cancelled = true;
    subscription?.unsubscribe();
  };
}

// Redirects the current window to Google's consent screen and back — this is
// a same-window top-level navigation triggered by a tap inside the already-
// open PWA, not a link opened from another app, so it doesn't have the
// magic-link problem of breaking out to a separate browser context.
export async function signInWithGoogle() {
  const sb = await getSupabase();
  const redirectTo = window.location.origin + import.meta.env.BASE_URL;
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getSupabase();
  await sb.auth.signOut();
}

// Returns { doc, rev, updated_at } or null if the user has no cloud row yet.
export async function pullState(userId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select("doc, rev, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Cheap freshness probe: just the rev, not the (unbounded) doc. Lets the
// focus/online reconcile skip downloading the whole document when nothing
// changed. Returns { rev } or null if the user has no cloud row yet.
export async function pullRev(userId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select("rev")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Compare-and-swap push. expectedRev is the last rev this device knows about;
// pass null for a first-ever push (row doesn't exist yet, uses insert instead
// of update). Returns { ok: true, rev } on success or { conflict: true } if
// another device wrote first (or, for a first push, a row already exists).
export async function pushState({ userId, doc, expectedRev, deviceId }) {
  const sb = await getSupabase();

  if (expectedRev == null) {
    const { data, error } = await sb
      .from(TABLE)
      .insert({ user_id: userId, doc, rev: 1, device_id: deviceId })
      .select("rev")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") return { conflict: true };
      throw toPushError(error);
    }
    return { ok: true, rev: data.rev };
  }

  const { data, error } = await sb
    .from(TABLE)
    .update({ doc, rev: expectedRev + 1, updated_at: new Date().toISOString(), device_id: deviceId })
    .eq("user_id", userId)
    .eq("rev", expectedRev)
    .select("rev")
    .maybeSingle();
  if (error) throw toPushError(error);
  if (!data) return { conflict: true };
  return { ok: true, rev: data.rev };
}
