// Duration of the bottom-sheet / modal slide animation, in ms. Kept in sync
// with the `.sheet`/`.scrim` transitions in glass.css so the JS that delays
// unmount until the exit animation finishes can't drift from the CSS timing.
export const SHEET_ANIM_MS = 400;

// localStorage key for the Smart Scan opt-in preference. Shared with
// ErrorBoundary's "clear data" path so a full reset doesn't leave it behind.
export const SMART_SCAN_PREF_KEY = "afterpayday:smartScan";
