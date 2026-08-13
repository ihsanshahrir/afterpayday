# Cloud sync (Supabase)

Optional account + cloud backup, entirely additive. With no Supabase project
configured, the app is byte-for-byte the guest experience — no sign-in UI, no
network calls beyond what already exists. This is the same on/off pattern as
the Smart Scan proxy (`worker/README.md`): a build-time env var gates the
feature, and the client dynamic-`import()`s `@supabase/supabase-js` only when
sync is actually used, so guests never download it.

```
Device A ──push {doc,rev}──▶ app_state row ◀──pull {doc,rev}── Device B
                (row-level security: each user sees only their own row)
```

Sync is a **whole-state document**: one JSON blob per user (the same object
Settings → Backup → Export writes), swapped as a unit via compare-and-swap on
a `rev` counter. There's no per-field merge — if two devices both change data
while offline, the app asks you to pick one side (`ConflictSheet`), it never
guesses.

## One-time setup

1. **Create a project** at <https://supabase.com> (free tier). Note the
   **Project URL** and **anon public key** from Settings → API — the anon key
   is designed to ship in a client bundle; it is not a secret, Row Level
   Security is what actually protects the data (see step 2).

2. **Run the schema** in the Supabase SQL editor: paste and run
   [`supabase/schema.sql`](./schema.sql). This creates `app_state` with RLS
   enabled and a policy restricting every row to `auth.uid() = user_id` — the
   database enforces isolation, not any code this app ships.

3. **Enable email OTP** (should be on by default): Authentication → Providers
   → Email. This app signs in with a 6-digit code, not a magic link — a magic
   link opens the system browser instead of the installed PWA, which breaks
   the standalone-window flow.

4. **Set the Site URL / redirect allowlist** (Authentication → URL
   Configuration) to your deployed origin, e.g.
   `https://yourname.github.io/afterpayday/`.

## Wire it into the app

Create a **gitignored** `.env.local` at the repo root:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Then add your project's origin (`https://YOUR-PROJECT-REF.supabase.co`) to the
`connect-src` of the CSP in `index.html`, replacing the placeholder already
there. When the env vars are unset, cloud sync simply doesn't appear.

For the deployed build, set the same two values as **repository variables**
(not secrets — both are public values) in GitHub → Settings → Secrets and
variables → Actions → Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
`.github/workflows/deploy.yml` already reads them into the build step.

## Caveat

Free Supabase projects pause after 7 consecutive days with zero requests (one
click in the dashboard to resume). For an app opened weekly this rarely
triggers; the sync UI treats a paused project as an ordinary network error
(status `error`, no crash, guest use is unaffected).

## Security notes

- The anon key is client-safe by design; Row Level Security is the actual
  boundary (step 2 above) — verify it by querying `app_state` as one user for
  another user's `user_id` and confirming zero rows.
- Every value pulled from the cloud goes through `state/storage.js`'s
  `importState()` before it touches app state — same normalizer/sanitizer the
  Import-backup flow uses, so a malformed or tampered row can't crash the app.
- No telemetry, no analytics. The only network calls this feature makes are
  auth and the two `app_state` reads/writes described above.
