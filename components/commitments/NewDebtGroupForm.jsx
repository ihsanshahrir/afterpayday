import { useState } from "react";
import DatePickerField from "./DatePickerField.jsx";
import { uid } from "../../utils/id.js";
import { daysInMonth, fmtMonthYear } from "../../utils/date.js";
import { formatMoney, splitEvenly } from "../../utils/money.js";

export default function NewDebtGroupForm({ currency, onCancel, onCreate }) {
  const [mode, setMode] = useState("auto");
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [months, setMonths] = useState("");
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const submit = () => {
    setError(null);
    if (!name.trim()) return;
    if (mode === "auto") {
      const t = parseFloat(total);
      const n = parseInt(months, 10);
      if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(n) || n <= 0) return;
      if (n > 600) {
        setError("Maximum allowed duration is 600 months (50 years).");
        return;
      }
      // Split the total so the installments always sum back to it exactly —
      // the last one absorbs any rounding remainder.
      const amounts = splitEvenly(t, n);
      const [yy, mm, dd] = startDate.split("-").map(Number);
      const installments = Array.from({ length: n }, (_, i) => {
        const monthDate = new Date(yy, mm - 1 + i, 1);
        const yyyy = monthDate.getFullYear();
        const mIdx = monthDate.getMonth();
        const mmStr = String(mIdx + 1).padStart(2, "0");
        const maxD = daysInMonth(mIdx + 1, yyyy);
        const day = Math.min(dd, maxD);
        const ddStr = String(day).padStart(2, "0");
        return {
          id: uid(),
          label: `Month ${i + 1}`,
          amount: amounts[i],
          dueDate: `${yyyy}-${mmStr}-${ddStr}`,
          isPaid: false,
        };
      });
      onCreate({ id: uid(), name: name.trim(), installments });
    } else {
      onCreate({ id: uid(), name: name.trim(), installments: [] });
    }
  };

  const previewT = parseFloat(total);
  const previewN = parseInt(months, 10);
  const showPreview =
    mode === "auto" &&
    Number.isFinite(previewT) && previewT > 0 &&
    Number.isFinite(previewN) && previewN > 0 && previewN <= 600;
  let previewText = null;
  if (showPreview) {
    // Show the same rounded per-month figure the installments will actually
    // use (splitEvenly's base), so the preview can't be a cent off the rows.
    const per = splitEvenly(previewT, previewN)[0];
    const [yy, mm] = startDate.split("-").map(Number);
    const end = new Date(yy, mm - 1 + (previewN - 1), 1);
    previewText = `${formatMoney(per, currency)} / month · ${previewN} month${previewN > 1 ? "s" : ""} · ends ${fmtMonthYear(end.getFullYear(), end.getMonth() + 1)}`;
  }

  return (
    <div className="glass" style={{ padding: "14px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="seg">
        <button className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>
          Auto-generate
        </button>
        <button className={mode === "manual" ? "on" : ""} onClick={() => setMode("manual")}>
          Manual
        </button>
      </div>

      <input
        type="text"
        placeholder="Installment (e.g., Car, House, Gadget...)"
        aria-label="Debt group name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="glass-input"
      />

      {mode === "auto" && (
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

      {mode === "manual" && (
        <p style={{ font: "500 12px var(--font)", color: "var(--fg-3)", margin: 0, lineHeight: 1.5 }}>
          Create the group, then add each installment with custom amounts and due dates.
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} className="glass-btn-secondary" style={{ flex: 1 }}>Cancel</button>
        <button onClick={submit} className="glass-btn-primary" style={{ flex: 1 }}>Confirm</button>
      </div>
    </div>
  );
}
