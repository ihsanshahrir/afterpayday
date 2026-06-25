// Locale used for digit grouping, decimal separator, and month names.
// Picks up the user's browser preference so EUR users see "1.234,56" instead
// of being forced into the hardcoded en-MY style. Currency symbols stay
// manually prefixed so the design's split-cents layout still works.
//
// A malformed tag (e.g. a POSIX-style "en-US@posix" some environments report)
// makes every Intl/toLocale* call throw a RangeError, which would white-screen
// the whole app. Validate once and fall back to "en" so formatting degrades
// gracefully instead of crashing.
const pickLocale = () => {
  const lang = (typeof navigator !== "undefined" && navigator.language) || "en";
  try {
    Intl.DateTimeFormat(lang);
    return lang;
  } catch {
    return "en";
  }
};

export const LOCALE = pickLocale();
