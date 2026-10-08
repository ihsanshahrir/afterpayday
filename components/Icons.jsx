// Duotone icon set from the Liquid Glass v2 design system: a 24-grid outline
// at a 1.7 stroke with a soft 24% fill underneath. Used for the app's
// signature surfaces (header, tab bar, category glyphs); Lucide still covers
// the long tail of utility icons.

const Duo = ({ d, duo, size = 18, strokeWidth = 1.7, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className ? `ico ${className}` : "ico"}
    style={style}
    aria-hidden="true"
    focusable="false"
  >
    {duo && <g fill="currentColor" stroke="none" opacity="0.24">{duo}</g>}
    {d}
  </svg>
);

const icon = (d, duo) => {
  const C = (p) => <Duo {...p} d={d} duo={duo} />;
  return C;
};

export const IcoSettings = icon(
  <><path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20" /><circle cx="15" cy="7" r="2.5" /><circle cx="9" cy="17" r="2.5" /></>,
  <><circle cx="15" cy="7" r="2.5" /><circle cx="9" cy="17" r="2.5" /></>
);
export const IcoHistory = icon(
  <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 4v4h4" /><path d="M12 8v4l3 2" /></>,
  <circle cx="12" cy="12" r="8.5" />
);
export const IcoHelp = icon(
  <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.3" /><path d="M12 17h.01" /></>,
  <circle cx="12" cy="12" r="9" />
);
export const IcoWallet = icon(
  <><rect x="3" y="6" width="18" height="14" rx="3.5" /><path d="M7 6V5.5A2.5 2.5 0 0 1 9.5 3H17" /><path d="M15.5 13h2" /></>,
  <rect x="3" y="6" width="18" height="14" rx="3.5" />
);
export const IcoTrend = icon(
  <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  <path d="M3 17l6-6 4 4 8-8v14H3Z" />
);
export const IcoList = icon(
  <><rect x="3" y="4" width="7" height="7" rx="2.2" /><rect x="3" y="14" width="7" height="7" rx="2.2" /><path d="M14 7.5h7M14 17.5h7" /></>,
  <rect x="3" y="4" width="7" height="7" rx="2.2" />
);
export const IcoPlusCircle = icon(
  <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  <circle cx="12" cy="12" r="9" />
);
export const IcoCheckCircle = icon(
  <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  <circle cx="12" cy="12" r="9" />
);
export const IcoTrash = icon(
  <><path d="M4 7h16" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></>,
  <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12Z" />
);
export const IcoDash = icon(
  <><rect x="3" y="3" width="8" height="10" rx="2.5" /><rect x="13" y="3" width="8" height="6" rx="2.5" /><rect x="13" y="11" width="8" height="10" rx="2.5" /><rect x="3" y="15" width="8" height="6" rx="2.5" /></>,
  <><rect x="3" y="3" width="8" height="10" rx="2.5" /><rect x="13" y="11" width="8" height="10" rx="2.5" /></>
);
export const IcoReceipt = icon(
  <><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21Z" />
);
export const IcoCard = icon(
  <><rect x="2.5" y="5" width="19" height="14" rx="3.5" /><path d="M2.5 10h19M6.5 15h3" /></>,
  <rect x="2.5" y="5" width="19" height="14" rx="3.5" />
);
export const IcoPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IcoCoffee = icon(
  <><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" /><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" /><path d="M8 3.5v2M12 3.5v2" /></>,
  <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" />
);
export const IcoFuel = icon(
  <><path d="M4 21V5.5A2.5 2.5 0 0 1 6.5 3h5A2.5 2.5 0 0 1 14 5.5V21" /><path d="M3 21h12" /><path d="M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3" /><path d="M7 7.5h4" /></>,
  <path d="M4 21V5.5A2.5 2.5 0 0 1 6.5 3h5A2.5 2.5 0 0 1 14 5.5V21Z" />
);
export const IcoBag = icon(
  <><path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
);
export const IcoRefund = icon(
  <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 10v5h5" /></>,
  <circle cx="12" cy="12" r="9" />
);
export const IcoSpark = icon(
  <path d="M12 4l1.8 4.9 5.2 1.6-5.2 1.7L12 17l-1.8-4.8L5 10.5l5.2-1.6Z" />,
  <path d="M12 4l1.8 4.9 5.2 1.6-5.2 1.7L12 17l-1.8-4.8L5 10.5l5.2-1.6Z" />
);
// Not in the v2 kit — drawn in the same style for the payment-method picker.
export const IcoCash = icon(
  <><rect x="2.5" y="6" width="19" height="12" rx="3" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v.01M18 14.5v.01" /></>,
  <rect x="2.5" y="6" width="19" height="12" rx="3" />
);
export const IcoPhone = icon(
  <><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 18h3" /></>,
  <rect x="6" y="2.5" width="12" height="19" rx="3" />
);

// Built-in categories and payment methods name a `glyph`; anything else
// (user-made categories) falls back to its stored emoji/text `icon`.
const GLYPHS = {
  coffee: IcoCoffee,
  fuel: IcoFuel,
  bag: IcoBag,
  refund: IcoRefund,
  spark: IcoSpark,
  cash: IcoCash,
  card: IcoCard,
  phone: IcoPhone,
};

export function GlyphIcon({ meta, size = 16 }) {
  const C = meta?.glyph && GLYPHS[meta.glyph];
  if (C) return <C size={size} />;
  return <span aria-hidden="true">{meta?.icon}</span>;
}
