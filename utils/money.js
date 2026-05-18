export const formatMoney = (n, currency = "RM") => {
  const v = Number.isFinite(n) ? n : 0;
  return `${currency} ${v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
