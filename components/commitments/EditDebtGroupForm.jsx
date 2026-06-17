import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import DatePickerField from "./DatePickerField.jsx";
import { fmtMonthYear, todayISO } from "../../utils/date.js";
import { formatMoney, splitEvenly } from "../../utils/money.js";
import { generateInstallments } from "../../utils/debt.js";

export default function EditDebtGroupForm({ currency, group, onCancel, onSave }) {
  const [mode, setMode] = useState("keep");
  const [name, setName] = useState(group.name ?? "");
  const [error, setError] = useState(null);

  const currentTotal = group.installments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const firstDue = group.installments
    .map((i) => i.dueDate)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))[0];

  const [total, setTotal] = useState(currentTotal > 0 ? String(currentTotal) : "");
  const [months, setMonths] = useState(group.installments.length ? String(group.installments.length) : "");
  const [startDate, setStartDate] = useState(firstDue ?? todayISO());

  const submit = () => {
    setError(null);
    if (!name.trim()) return;
    if (mode === "keep") {
      onSave({ name: name.trim() });
      return;
    }
    const t = parseFloat(total);
    const n = parseInt(months, 10);
    if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(n) || n <= 0 || !startDate) return;
    if (n > 600) {
      setError("Maximum allowed duration is 600 months (50 years).");
      return;
    }
    onSave({ name: name.trim(), installments: generateInstallments(t, n, startDate) });
  };

  const previewT = parseFloat(total);
  const previewN = parseInt(months, 10);
  const showPreview =
    mode === "regenerate" &&
    Number.isFinite(previewT) && previewT > 0 &&
    Number.isFinite(previewN) && previewN > 0 && previewN <= 600;
  let previewText = null;
  if (showPreview) {
    const per = splitEvenly(previewT, previewN)[0];
    const [yy, mm] = startDate.split("-").map(Number);
    const end = new Date(yy, mm - 1 + (previewN - 1), 1);
    previewText = `${formatMoney(per, currency)} / month · ${previewN} month${previewN > 1 ? "s" : ""} · ends ${fmtMonthYear(end.getFullYear(), end.getMonth() + 1)}`;
  }

  return (
    <div className="glass" style={{ padding: "14px", marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        type="text"
        placeholder="Installment (e.g., Car, House, Gadget...)"
        aria-label="Debt group name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="glass-input"
      />

      <div className="seg">
        <button className={mode === "keep" ? "on" : ""} onClick={() => setMode("keep")}>
          Keep installments
        </button>
        <button className={mode === "regenerate" ? "on" : ""} onClick={() => setMode("regenerate")}>
          Regenerate schedule
        </button>
      </div>

      {mode === "regenerate" && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", font: "500 14px var(--font)", pointerEvents: "none" }}>
                {currency}
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Total amount"
                aria-label={`Total amount in ${currency}`}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="glass-input"
                style={{ paddingLeft: "3rem" }}
              />
            </div>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Months"
              aria-label="Number of months"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="glass-input"
              style={{ width: 104 }}
            />
          </div>
          <div>
            <label style={{ font: "500 10px var(--font)", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-3)" }}>
              Starting date
            </label>
            <div style={{ marginTop: 6 }}>
              <DatePickerField value={startDate} onChange={setStartDate} />
            </div>
          </div>
          {previewText && <div className="preview">{previewText}</div>}
          <div
            role="alert"
            style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 12px", borderRadius: 12,
              background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.28)",
              font: "500 12px var(--font)", color: "var(--amber, #fbbf24)", lineHeight: 1.5,
            }}
          >
            <AlertTriangle size={15} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Regenerating replaces all installments and resets their paid status.</span>
          </div>
          {error && (
            <div
              role="alert"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(244,63,94,0.10)",
                border: "1px solid rgba(244,63,94,0.30)",
                font: "500 12px var(--font)",
                color: "var(--rose)",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} className="glass-btn-secondary" style={{ flex: 1 }}>Cancel</button>
        <button onClick={submit} className="glass-btn-primary" style={{ flex: 1 }}>Save</button>
      </div>
    </div>
  );
}
