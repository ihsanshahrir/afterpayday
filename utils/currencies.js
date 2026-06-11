// Single source of truth for supported currencies, shared by the Settings
// picker and the storage sanitizer so an imported backup can't smuggle in an
// unknown code.
export const CURRENCIES = [
  { code: "RM",  flag: "🇲🇾", name: "Malaysian Ringgit" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore Dollar" },
  { code: "USD", flag: "🇺🇸", name: "US Dollar" },
  { code: "GBP", flag: "🇬🇧", name: "British Pound" },
  { code: "EUR", flag: "🇪🇺", name: "Euro" },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export const DEFAULT_CURRENCY = "RM";
