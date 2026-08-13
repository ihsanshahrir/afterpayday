# AfterPayday — Design Document

A mobile-first, offline-capable personal expense tracker built as a Progressive Web App. Tracks monthly salary, fixed expenses, installment debt, and daily spending against a single "safe to spend" figure.

---

## Goals

1. **Single-glance clarity.** The dashboard answers one question: *how much can I spend for the rest of this month?*
2. **Zero friction.** Quick-add expense in two taps; persists locally, no account required.
3. **Offline-first.** Installable PWA; works on a plane.
4. **Resilient.** Survives storage quota errors, render crashes, and month boundaries without user intervention.
5. **Local-first, cloud-optional.** An account only ever adds cloud backup and multi-device sync on top of the local copy — it never becomes the primary store, and signing out leaves the local experience unchanged.

Non-goals: multi-currency conversion, bank integrations, budgeting categories, analytics, telemetry.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 19 | Hooks-driven, simple state model |
| Bundler | Vite 8 | Fast HMR, native ESM, first-class PWA plugin |
| Styling | Tailwind CSS v4 | Utility-first, JIT, no runtime overhead |
| PWA | vite-plugin-pwa (Workbox) | Auto service worker, asset precaching |
| Icons | lucide-react | Tree-shakeable, consistent stroke style |
| Persistence | localStorage | Synchronous, sufficient for single-user data sizes |
| Hosting | Netlify | Branch deploy previews; static-only output |
| Cloud sync *(optional)* | Supabase (Postgres + Auth + RLS) | Free tier covers Postgres, email-OTP auth, and row-level isolation without server code of our own; a hosted backend is required regardless since GitHub Pages is static |

No backend, no database, and no authentication are required — cloud sync is opt-in on top, never a dependency of the core app.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  main.jsx                                   │
│   └─ ErrorBoundary                          │
│       └─ App (expense-tracker.jsx)          │
│           ├─ state (useState + loadState)   │
│           ├─ derived totals (useMemo)       │
│           ├─ Dashboard | Commitments        │
│           └─ Sheets: Settings, History      │
└─────────────────────────────────────────────┘
              │
              ▼ saveState on every change
       localStorage (versioned schema)
```

### Receipt scanning (`utils/ocr.js`, `utils/receiptParse.js`)

The Add sheet can pre-fill an expense from a photo of a receipt. The pipeline is
fully on-device: `downscaleToCanvas` (`utils/image.js`) shrinks and grayscales
the photo, `recognizeReceipt` runs OCR, and `parseReceiptText` turns the raw
text into `{ amount, description, category, date }` which seeds the form fields.
Every field stays editable, and anything the parser can't recover is just left
for manual entry — scanning never blocks the normal flow. The image is never
stored; only the values the user confirms are saved via `addDailyExpense`.

OCR uses **Tesseract.js**, dynamically imported on first scan so it stays out of
the initial bundle. Its engine (worker + wasm core + `eng.traineddata.gz`) is
self-hosted under `public/tesseract/` rather than fetched from a CDN, so nothing
leaves the device. `scripts/copy-tesseract.mjs` (run via `predev`/`prebuild`)
copies the worker/core out of `node_modules`; the language model is committed.

### State shape

```js
{
  _version: 2,
  currentMonth: "2026-05",
  settings: { salary: Number, currency: String },
  fixedExpenses: [{ id, name, amount, paidMonth }],
  debtGroups: [{ id, name, installments: [{ id, label, amount, dueDate, isPaid, paidMonth }] }],
  dailyExpenses: [{ id, amount, description, date, category, kind }], // amount always > 0
  history: [{ id, month, salary, fixedTotal, installments, dailySpent, balance }],
}
```

`currentMonth` and `history` aren't in the on-disk default — `loadState` /
`importState` inject them (and validate every field) so an old or partial
save is upgraded to this shape on load. `category` is one of
`food | fuel | shop | other | refund` and is presentational; `kind`
(`expense | refund`) is the source of truth for direction. Amounts are always
stored positive — a refund lifts safe-to-spend and renders as an inbound row
because of its `kind`, not its sign. (v1 stored refunds as negative amounts;
the v1→v2 migration converts them and backfills `paidMonth: null` on
installments that predate the field.)

Single root state object held in `App`. All mutations flow through small named helpers (`addFixedExpense`, `toggleInstallmentPaid`, etc.) — no reducer, no context. The app is small enough that prop drilling stays readable.

### Persistence layer (`state/storage.js`)

- `loadState()`: reads localStorage, runs forward migration, returns merged state built from **fresh** defaults (no shared array/object references, so loaded state is safe to mutate).
- `importState(parsed)`: validates a parsed backup object (rejects non-objects / arrays), then runs it through the same normaliser. Returns `null` for unrecognised input.
- `saveState(state)`: writes JSON, returns `true` on success / `false` on `QuotaExceededError`. The boolean lets the UI surface a banner when storage is full.
- **Shape guards + sanitizers**: every array field (`fixedExpenses`, `debtGroups`, `dailyExpenses`, `history`) is coerced to `[]` if it isn't an array, and every item is validated — non-finite amounts and malformed dates drop the entry, `paidMonth`/`dueDate` are coerced to valid values or `null`, and unknown currencies fall back to the default — so a truncated write or hand-edited backup can't crash the app or skew the safe-to-spend math.
- Schema versioning via `_version` field. New versions add a migration step in `migrate()`; old saves are upgraded on load.

### Durability & backup

localStorage on iOS Safari can be evicted after ~7 days of non-use for
non–home-screen PWAs. Two mitigations:

- On mount the app calls `navigator.storage.persist()` to request durable storage where supported.
- **Settings → Backup** offers one-tap **Export** (downloads a timestamped JSON of the full state) and **Import** (reads a backup, validates via `importState`, confirms, then replaces state). This is the user's recovery path on any device.

### Undo

Deletes (daily expense, fixed expense, installment, debt group) snapshot the
**entire** previous state and surface a 5-second "Undo" toast. Whole-state undo
keeps restoration trivially correct — no per-entity re-insertion or ordering
logic — and covers every delete uniformly.

### Cloud sync (optional, `state/cloud.js`, `hooks/useCloudSync.js`)

Signing in (email OTP, not a magic link — see `supabase/README.md`) mirrors
the whole state doc to a single Supabase row per user, guarded by Row Level
Security. A push is a compare-and-swap on a `rev` counter
(`.eq('rev', expectedRev)`); zero rows updated means another device wrote
first, and the app opens `ConflictSheet` rather than guessing which side
wins. Every value pulled from the cloud is run through the same
`importState()` normalizer the Import-backup flow uses, and a doc whose
`_version` is newer than this build's `CURRENT_VERSION` is refused rather
than imported, so an old build can't silently downgrade a newer account's
data after a staggered deploy. `saveState(state)` (local) always runs before
the sync hook sees a change — cloud is strictly downstream of local, never in
front of it.

### Time handling (`utils/date.js`)

All date comparisons use **ISO-string prefix matching**, never `new Date(isoString)`. A bare `YYYY-MM-DD` string parsed via `new Date()` is interpreted as UTC midnight, which puts the date one day earlier in any western timezone — corrupting "is this expense in the current month?" checks at month boundaries.

- `todayISO()` → `YYYY-MM-DD` in **local** time.
- `currentMonthKey()` → `YYYY-MM` in **local** time.
- `isInCurrentMonth(iso)` → `iso.startsWith(currentMonthKey())`.

### Month rollover

When the month changes, the previous month is frozen as a snapshot in `history`. The check runs on mount and on every `visibilitychange` to `visible`, so a user who leaves the PWA open across midnight still gets a correct snapshot on next focus.

The effect reads state via a `useRef` to avoid re-binding on every mutation:

```js
const stateRef = useRef(state);
useEffect(() => { stateRef.current = state; });
useEffect(() => {
  const checkRollover = () => { /* reads stateRef.current */ };
  checkRollover();
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}, []); // empty deps — runs once
```

### Crash recovery (`components/ErrorBoundary.jsx`)

Wraps the entire app. On any render error:
- Shows a calm, branded error screen (not the React red box).
- **Try again** — resets the boundary's `hasError` flag without reloading.
- **Reset app data** — confirms, clears localStorage + sessionStorage, reloads.

Class component (required: hooks can't catch render errors). Lives outside `StrictMode` so it isn't double-invoked in dev.

---

## File Structure

```
.
├── main.jsx                      Entry; mounts ErrorBoundary → App
├── expense-tracker.jsx           App root: state, routing, layout, AddSheet, undo
├── index.html                    Viewport, theme color, favicon links
├── index.css                     Tailwind import + global resets only
├── glass.css                     Main stylesheet: design tokens + component styles
│
├── components/
│   ├── Dashboard.jsx             Safe-to-spend hero, daily/refund list
│   ├── Commitments.jsx           Fixed expenses + installment debt groups + pickers
│   ├── SettingsSheet.jsx         Salary, currency, and backup export/import
│   ├── HistorySheet.jsx          Past-month snapshots
│   ├── SplashScreen.jsx          One-shot launch animation
│   ├── OnboardingSlides.jsx      First-run carousel
│   ├── WheelColumn.jsx           iOS-style picker (shared, keyboard-accessible)
│   ├── RingProgress.jsx          SVG donut progress (shared)
│   ├── StatPager.jsx             Swipeable stat carousel (shared)
│   ├── Collapse.jsx              Height-animated expand/collapse (shared)
│   ├── SwapFade.jsx              Cross-fade between swapped content (shared)
│   └── ErrorBoundary.jsx         Crash recovery shell
│
├── state/
│   └── storage.js                load/save/import + schema versioning + shape guards
│
├── utils/
│   ├── date.js                   Timezone-safe date helpers
│   ├── money.js                  Currency formatting + even installment split
│   ├── locale.js                 Browser-locale resolution (grouping, month names)
│   └── id.js                     Short unique IDs
│
├── eslint.config.js              ESLint flat config (React hooks rules)
├── vitest.config.js              Vitest (jsdom) config
├── *.test.js                     Unit tests co-located with utils/ and state/
│
├── public/
│   ├── favicon.ico               Multi-size (16/32/48)
│   ├── favicon-32x32.png
│   ├── icon-192.png              PWA & apple-touch-icon
│   ├── icon-512.png              PWA install
│   └── icon-maskable-512.png     Android adaptive icon
│
├── vite.config.js                PWA manifest, asset glob
└── tailwind.config.js
```

---

## UI / UX

### Layout

- Single-column, `max-w-md` (28rem) centered. Mobile-first; on desktop the app sits as a phone-shaped column.
- Two tabs: **Dashboard** (default) and **Commitments**. No deep navigation, no router.
- Sheets (Settings, History, Pickers) animate in from the bottom with backdrop blur, dismissible by tap or button. Animations are CSS keyframes (no animation library).

### Color tokens

| Role | Value | Usage |
|---|---|---|
| Background | `neutral-950` (`#0a0a0a`) | App canvas |
| Surface | `neutral-900` / `neutral-800` | Cards, inputs |
| Border | `neutral-800` / `neutral-700/50` | Hairlines |
| Primary | `emerald-500` (`#10b981`) | CTAs, active tab, brand |
| Danger | `rose-500` / `red-500` | Over-budget, destructive |
| Text | `neutral-100` / `neutral-300` / `neutral-500` | Primary / body / muted |

`theme-color` meta tag is `#10b981` so iOS PWA status bar tints emerald.

### Typography

System font stack only — no web font request. Tracking is tightened (`-0.01em` / `-0.02em`) on large numbers for the "money" feel.

### Safe areas

iOS standalone PWA mode reserves space for the notch (top) and home indicator (bottom). Both ends are explicitly handled:

```jsx
// Header
style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
// Bottom nav
style={{
  paddingBottom: 'env(safe-area-inset-bottom)',
  minHeight: 'calc(5.5rem + env(safe-area-inset-bottom))',
}}
```

The nav's explicit `minHeight` prevents layout shift when iOS recalculates the viewport on interaction.

---

## PWA

### Manifest highlights

```js
{
  name: 'AfterPayday',
  short_name: 'AfterPayday',
  display: 'standalone',
  orientation: 'portrait-primary',
  theme_color: '#10b981',
  background_color: '#0a0a0a',
  start_url: '/',
}
```

### Service worker

- `registerType: 'prompt'` — Workbox checks for new SW on every navigation, but the client waits and surfaces a "new version ready" toast (`hooks/useAppUpdate.js`) rather than reloading silently; the user controls when the reload happens.
- Precaches all built JS/CSS/HTML/PNG/SVG/WOFF2.
- The OCR engine under `public/tesseract/` is excluded from precache (`globIgnores`) and instead served `CacheFirst` at runtime, so the ~13 MB of wasm/model is fetched lazily on the first scan and then available offline — without bloating the initial install.
- No runtime caching of API calls (there are none).

### Icons

- `icon-192.png` / `icon-512.png` — standard PWA install icons.
- `icon-maskable-512.png` — Android adaptive shape (safe zone aware).
- `apple-touch-icon` → `icon-192.png` for "Add to Home Screen".
- `favicon.ico` (16/32/48) + `favicon-32x32.png` for browser tab and platform dashboards (Netlify, GitHub).

---

## Design Decisions & Trade-offs

### Why localStorage, not IndexedDB?

Synchronous API, simpler error model, sufficient quota for years of expense data (~5MB on most browsers). IndexedDB would force async refactors everywhere for no observed benefit.

### Why no router?

Two tabs and a few sheets. A router would add bundle weight and a back-button contract we don't want (sheets shouldn't push history entries; the back gesture should exit the PWA, not close a modal).

### Why a single root state object?

Total state is small (kilobytes). Splitting into multiple `useState` or contexts adds ceremony without clarity. The trade-off — any change re-renders the whole tree — is mitigated by `useMemo` on derived totals and the fact that the tree is shallow.

### Why ref-driven rollover effect?

If the effect depended on `state`, it would re-run on every mutation, with an internal guard to no-op when the month hadn't changed. That's misleading (looks like it runs often when it almost never should) and brittle. Ref + `visibilitychange` is one-shot per actual event.

### Why whole-state-document sync, not per-row merge?

Per-row/per-field merge needs stable row identity, tombstones for deletes,
and a merge policy for every field type — real complexity for a small
single-user dataset. A whole-document compare-and-swap is one write, one
comparison, and a failure mode (conflict) simple enough to hand to the user
instead of guessing. The cost is coarser conflicts (any concurrent edit on
two devices conflicts, not just edits to the same field) — acceptable because
concurrent edits across devices are rare for a personal expense tracker, and
silently auto-merging a whole document risks losing entries a user would
notice missing.

### Why a class-based ErrorBoundary?

React hooks cannot catch render errors. There is no `useErrorBoundary` in stable React. This is the one place the class API is still required.

### Why on-device OCR (not a cloud vision API)?

The app's promise is "no backend, nothing leaves your device." A cloud vision
API would read receipts more accurately, but it needs a key (which a static
GitHub Pages build can't hold safely) and would send the image to a server.
Tesseract.js keeps scanning local, free, and offline at the cost of lower
accuracy on faded/cluttered receipts — acceptable because every extracted field
is editable before saving. The ~13 MB engine is runtime-cached (not precached,
see below) so it never weighs down the initial install.

### Testing & linting

The pure helpers carry unit coverage under **Vitest** (jsdom): `utils/date.js`,
`utils/money.js` (including the even-split installment logic), and
`state/storage.js` (load/import normalisation, corrupt-data fallback, shape
guards). UI components stay visual — Playwright or manual QA is more useful
there than snapshot tests. **ESLint** (flat config, React-hooks rules) gates the
JS/JSX. Run with `npm test` and `npm run lint`.

---

## Future Work

- ~~Vitest + tests on `utils/date.js`, `utils/money.js`, `state/storage.js`.~~ ✅ Done.
- ~~Export / import JSON backup (one-tap "save my data").~~ ✅ Done (Settings → Backup).
- Prettier configuration (ESLint is in place).
- Backdate daily expenses (the date picker is currently installment-only).
- Optional: end-of-month summary push notification.
- Optional: split fixed expenses by category.
