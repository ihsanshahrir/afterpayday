export const fmtNum = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatMoney = (n, currency = "RM") => `${currency} ${fmtNum(n)}`;
