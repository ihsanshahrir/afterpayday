import { useState, useEffect } from "react";
import { formatMoney } from "../utils/money.js";
import { LOCALE } from "../utils/locale.js";

export default function HistorySheet({ history, currency, onClose }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = () => {
    setIsOpen(false);
    setTimeout(onClose, 400);
  };

  return (
    <>
      <div className={`scrim${isOpen ? " on" : ""}`} onClick={close} />
      <div
        className={`sheet${isOpen ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Monthly history"
        style={{ maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grab" />
        <div className="sheet-head">
          <div className="titles">
            <h3>Monthly history</h3>
          </div>
          <button className="done" onClick={close}>Done</button>
        </div>

        {(!history || history.length === 0) ? (
          <div className="empty-card">
            <h4>No earlier history</h4>
            <p>Snapshots are taken automatically at the start of each new month.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((h) => {
              const totalSpent = h.fixedTotal + h.installments + h.dailySpent;
              const progress = h.salary > 0 ? Math.min(1, totalSpent / h.salary) : 0;
              const isPositive = h.balance >= 0;
              const [yy, mm] = h.month.split("-").map(Number);
              const monthStr = new Date(yy, mm - 1, 1).toLocaleDateString(LOCALE, {
                month: "long", year: "numeric",
              });

              return (
                <div
                  key={h.id}
                  style={{
                    background: "var(--glass)",
                    border: "1px solid var(--glass-edge)",
                    borderRadius: "var(--r-lg)",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ font: "600 14px var(--font)", color: "var(--fg)" }}>{monthStr}</span>
                    <span style={{
                      font: "600 14px var(--font)",
                      fontVariantNumeric: "tabular-nums",
                      color: isPositive ? "var(--emerald)" : "var(--rose)",
                    }}>
                      {isPositive ? "+" : "−"} {formatMoney(Math.abs(h.balance), currency)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", font: "500 11px var(--font)", color: "var(--fg-3)" }}>
                    <span>Salary <span style={{ color: "var(--fg-2)" }}>{formatMoney(h.salary, currency)}</span></span>
                    <span>Spent <span style={{ color: "var(--fg-2)" }}>{formatMoney(totalSpent, currency)}</span></span>
                  </div>
                  <div style={{ height: 4, borderRadius: 9999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      borderRadius: 9999,
                      width: `${progress * 100}%`,
                      background: progress >= 1
                        ? "linear-gradient(90deg, var(--rose), #e11d48)"
                        : "linear-gradient(90deg, var(--emerald), var(--violet))",
                      transition: "width 500ms cubic-bezier(0.16,1,0.3,1)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
