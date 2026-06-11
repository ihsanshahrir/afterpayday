import { useState } from "react";
import DatePickerField from "./DatePickerField.jsx";
import { todayISO } from "../../utils/date.js";

export default function ManualInstallmentForm({ currency, onCancel, onSubmit, initial = null, submitLabel = "Add" }) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? todayISO());

  const submit = () => {
    const a = parseFloat(amount);
    if (!label.trim() || !Number.isFinite(a) || a <= 0 || !dueDate) return;
    onSubmit({ label: label.trim(), amount: a, dueDate });
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Label"
          aria-label="Installment label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="glass-input"
          style={{ flex: 1 }}
        />
        <div style={{ position: "relative", width: 110 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", font: "500 13px var(--font)", pointerEvents: "none" }}>
            {currency}
          </span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            aria-label={`Amount in ${currency}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="glass-input"
            style={{ paddingLeft: "2.8rem" }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <DatePickerField value={dueDate} onChange={setDueDate} />
        </div>
        <button onClick={onCancel} className="glass-btn-secondary" style={{ padding: "0 14px" }}>Cancel</button>
        <button onClick={submit} className="glass-btn-primary" style={{ padding: "0 16px" }}>{submitLabel}</button>
      </div>
    </div>
  );
}
