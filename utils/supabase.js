// Whether cloud sync is configured for this build. When false, no sync UI
// renders and the app is byte-for-byte the guest experience — same pattern
// as SMART_SCAN_AVAILABLE in expense-tracker.jsx.
export const SYNC_AVAILABLE = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

let clientPromise = null;

// Lazily creates (and memoizes) the Supabase client. @supabase/supabase-js is
// reached only through this dynamic import, so Vite splits it into its own
// chunk that guests never download — it loads on first sign-in attempt or
// when restoring an existing session.
export function getSupabase() {
  if (!SYNC_AVAILABLE) return Promise.reject(new Error("Cloud sync is not configured"));
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: "afterpayday:auth",
        },
      })
    ).catch((err) => {
      // Don't memoize a failed load (e.g. an offline cold start before the
      // chunk is cached) — a later call must be able to retry the import.
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}
