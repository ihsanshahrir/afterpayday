import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import WheelColumn from "../WheelColumn.jsx";
import { daysInMonth } from "../../utils/date.js";
import { SHEET_ANIM_MS } from "../../utils/ui.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function DatePickerModal({ mode, initialDay, initialMonth, initialYear, onConfirm, onCancel }) {
  const [selectedDay, setSelectedDay] = useState(initialDay || 1);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [isOpen, setIsOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 2 + i);

  const maxDay = daysInMonth(selectedMonth, selectedYear);
  useEffect(() => {
    if (selectedDay > maxDay) setSelectedDay(maxDay);
  }, [selectedMonth, selectedYear, maxDay, selectedDay]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const dayItems = Array.from({ length: maxDay }, (_, i) => String(i + 1));

  const confirm = () => {
    setIsOpen(false);
    setTimeout(() => onConfirm(selectedDay, selectedMonth, selectedYear), SHEET_ANIM_MS);
  };

  const cancel = () => {
    setIsOpen(false);
    setTimeout(onCancel, SHEET_ANIM_MS);
  };

  const isDateMode = mode === "date";
  const title = isDateMode ? "Select date" : "Select month";

  return createPortal(
    <>
      <div className={`scrim${isOpen ? " on" : ""}`} onClick={cancel} />
      <div
        className={`sheet${isOpen ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grab" />

        {/* title */}
        <p style={{ margin: "0 0 16px", font: "700 22px/1 var(--font)", letterSpacing: "-0.02em", color: "var(--fg)" }}>{title}</p>

        {/* wheel columns */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isDateMode ? "1fr 1.4fr 1fr" : "1fr",
          gap: 8,
          margin: "0 0 4px",
          position: "relative",
        }}>
          {/* center highlight band */}
          <div style={{
            position: "absolute", left: 0, right: 0,
            top: "50%", height: 44, transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.08)",
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)",
            zIndex: 0, pointerEvents: "none",
          }} />
          {isDateMode && (
            <div style={{ position: "relative", height: 200 }}>
              <WheelColumn ariaLabel="Day" key={`day-${maxDay}`} items={dayItems} selectedIndex={selectedDay - 1} onChange={(i) => setSelectedDay(i + 1)} />
            </div>
          )}
          <div style={{ position: "relative", height: 200 }}>
            <WheelColumn ariaLabel="Month" items={MONTHS} selectedIndex={selectedMonth - 1} onChange={(i) => setSelectedMonth(i + 1)} />
          </div>
          <div style={{ position: "relative", height: 200 }}>
            <WheelColumn ariaLabel="Year" items={years.map(String)} selectedIndex={years.indexOf(selectedYear)} onChange={(i) => setSelectedYear(years[i])} />
          </div>
        </div>

        {/* bottom actions */}
        <div className="sheet-actions">
          <button className="btn-secondary" onClick={cancel}>Cancel</button>
          <button className="btn-primary" onClick={confirm}>Confirm</button>
        </div>
      </div>
    </>,
    document.body
  );
}
