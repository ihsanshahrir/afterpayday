// Duration of the bottom-sheet / modal slide animation, in ms. Kept in sync
// with the `.sheet`/`.scrim` transitions in glass.css so the JS that delays
// unmount until the exit animation finishes can't drift from the CSS timing.
export const SHEET_ANIM_MS = 400;
