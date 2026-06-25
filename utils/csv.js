// Export daily expenses as CSV for data portability. Pure and on-device — the
// file is built in the browser and downloaded; nothing leaves the device.

const COLUMNS = [
  "date", "time", "kind", "category", "amount",
  "description", "merchant", "paymentMethod", "tags", "note",
];

// RFC-4180 style escaping: wrap in quotes and double any embedded quote when the
// value contains a comma, quote, or newline.
const esc = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toDailyCSV = (dailyExpenses = []) => {
  const rows = (Array.isArray(dailyExpenses) ? dailyExpenses : []).map((e) =>
    [
      e.date || "",
      Number.isFinite(e.createdAt) ? new Date(e.createdAt).toISOString() : "",
      e.kind === "refund" ? "refund" : "expense",
      e.category || "other",
      Number.isFinite(Number(e.amount)) ? Number(e.amount) : 0,
      e.description || "",
      e.merchant || "",
      e.paymentMethod || "",
      Array.isArray(e.tags) ? e.tags.join("|") : "",
      e.note || "",
    ].map(esc).join(",")
  );
  return [COLUMNS.join(","), ...rows].join("\r\n");
};
