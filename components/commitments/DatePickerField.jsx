import { useState } from "react";
import { Calendar } from "lucide-react";
import DatePickerModal from "./DatePickerModal.jsx";
import { fmtDate } from "../../utils/date.js";

export default function DatePickerField({ value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const [yy, mm, dd] = value.split("-").map(Number);
  const displayText = fmtDate(value);

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        aria-label={`Selected date: ${displayText}. Tap to change.`}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 14px", borderRadius: 12,
          background: "var(--glass)", border: "1px solid rgba(52,211,153,0.35)",
          color: "var(--fg)", font: "500 14px var(--font)",
          transition: "border-color 150ms", cursor: "pointer",
        }}
      >
        <span>{displayText}</span>
        <Calendar size={14} style={{ color: "var(--fg-3)" }} strokeWidth={1.75} />
      </button>
      {showPicker && (
        <DatePickerModal
          mode="date"
          initialDay={dd}
          initialMonth={mm}
          initialYear={yy}
          onConfirm={(day, month, year) => {
            onChange(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
            setShowPicker(false);
          }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
