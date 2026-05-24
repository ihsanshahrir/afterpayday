export const fmtNum = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatMoney = (n, currency = "RM") => `${currency} ${fmtNum(n)}`;

export const fmtCompact = (n) =>
  new Intl.NumberFormat("en-MY", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number.isFinite(n) ? n : 0
  );
