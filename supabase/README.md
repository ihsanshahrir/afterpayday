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

2. **Apply the migrations** in [`supabase/migrations/`](./migrations), oldest
   first: either `supabase db push` with the Supabase CLI, or paste each file
   into the SQL editor in filename order. This creates `app_state` with RLS
   enabled, a policy restricting every row to the signed-in owner, a trigger
   that makes `rev`/`updated_at` server-authoritative, and a 2 MB document
   cap. The database enforces isolation, not any code this app ships.

   Schema changes from now on go in a **new** timestamped file in that folder.
   Never edit one that has already been applied.

3. **Create a Google OAuth client** in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create a project (or reuse one), then **Create Credentials** → **OAuth
     client ID** → Application type **Web application**.
   - Under **Authorized redirect URIs**, add your Supabase callback URL:
     `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (find the exact
     value on the Google provider settings page in Supabase, described next —
     it shows you this URL directly).
   - Save, then copy the generated **Client ID** and **Client secret**.

4. **Enable Google** in Supabase: Authentication → Providers → Google. Paste
   the Client ID and Client secret from step 3, then enable the provider.

5. **Set the Site URL / redirect allowlist** (Authentication → URL
   Configuration) to your deployed origin, e.g.
   `https://yourname.github.io/afterpayday/`. This is where Google sends the
   user back to after they approve sign-in.

Google OAuth (not email) is the sign-in method here specifically because it
avoids the exact problem a magic-link email has: tapping a link from the Mail
app always opens the system browser, not the installed PWA, since a
different app is handling the tap. OAuth is triggered by a button *inside*
the already-open PWA — the whole redirect to Google and back is a same-window
top-level navigation, so it never hands off to a separate app or browser
context.

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

Free Supabase projects pause after 7 consecutive days with zero requests.
[`supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml) pings
the database every 3 days to prevent that. GitHub disables scheduled
workflows after 60 days without a commit, so re-enable it from the Actions
tab if sync ever goes down after a quiet spell. While paused, the sync UI
treats it as an ordinary network error (status `error`, retried with
backoff). Guest use is unaffected.

## Backups

The free tier has no managed backups.
[`supabase-backup.yml`](../.github/workflows/supabase-backup.yml) takes a
weekly data-only dump of `app_state`, `auth.users` and `auth.identities`. It
encrypts the dump with your passphrase and keeps it as a workflow artifact
for 90 days. It is skipped until two repository **secrets** exist:
`SUPABASE_DB_URL` (the Session pooler connection string) and
`BACKUP_PASSPHRASE`.

To restore:

```bash
gh run download <run-id> -n afterpayday-db-<stamp>
gpg -d afterpayday-<stamp>.sql.gz.gpg | gunzip > restore.sql
```

Then, on a project whose schema is already set up from `migrations/`, run
`restore.sql` with `psql "$SUPABASE_DB_URL" -f restore.sql`. Restoring into
the **same** project overwrites nothing silently: clashing rows fail on their
primary keys, so delete the rows you're replacing first.

## Security notes

- The anon key is client-safe by design; Row Level Security is the actual
  boundary (step 2 above) — verify it by querying `app_state` as one user for
  another user's `user_id` and confirming zero rows.
- Every value pulled from the cloud goes through `state/storage.js`'s
  `importState()` before it touches app state — same normalizer/sanitizer the
  Import-backup flow uses, so a malformed or tampered row can't crash the app.
- No telemetry, no analytics. The only network calls this feature makes are
  auth and the two `app_state` reads/writes described above.
