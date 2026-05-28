// Locale used for digit grouping, decimal separator, and month names.
// Picks up the user's browser preference so EUR users see "1.234,56" instead
// of being forced into the hardcoded en-MY style. Currency symbols stay
// manually prefixed so the design's split-cents layout still works.
export const LOCALE =
  (typeof navigator !== "undefined" && navigator.language) || "en";
