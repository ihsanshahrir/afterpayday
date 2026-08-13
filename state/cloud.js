// Pure transport layer for cloud sync — no React. Talks to Supabase via the
// lazily-created client from utils/supabase.js. Every function assumes
// SYNC_AVAILABLE is true; callers gate on that before importing/calling this.
import { getSupabase } from "../utils/supabase.js";

const TABLE = "app_state";

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

export async function sendCode(email) {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function verifyCode(email, token) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  return data.session;
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
      throw error;
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
  if (error) throw error;
  if (!data) return { conflict: true };
  return { ok: true, rev: data.rev };
}
