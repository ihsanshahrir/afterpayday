import { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";

const CURRENCIES = [
  { code: "RM",  flag: "🇲🇾", name: "Malaysian Ringgit" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore Dollar" },
  { code: "USD", flag: "🇺🇸", name: "US Dollar" },
  { code: "GBP", flag: "🇬🇧", name: "British Pound" },
  { code: "EUR", flag: "🇪🇺", name: "Euro" },
];

export default function SettingsSheet({ settings, onClose, onSave }) {
  const [isOpen, setIsOpen] = useState(false);
  const [salary, setSalary] = useState(String(settings.salary || ""));
  const [currency, setCurrency] = useState(settings.currency || "RM");
  const [currencyOpen, setCurrencyOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = (callback) => {
    setIsOpen(false);
    setTimeout(callback, 400);
  };

  const save = () => {
    const s = parseFloat(salary);
    close(() => onSave({
      salary: Number.isFinite(s) && s >= 0 ? s : 0,
      currency: currency.trim() || "RM",
    }));
  };

  const curr = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  return (
    <>
      <div className={`scrim${isOpen ? " on" : ""}`} onClick={() => close(onClose)} />
      <div
        className={`sheet${isOpen ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grab" />
        <div className="sheet-head">
          <div className="titles">
            <div className="eyebrow-sm">Settings</div>
            <h3>Income &amp; currency</h3>
          </div>
          <button className="close-btn" onClick={() => close(onClose)} aria-label="Close">
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="field-block">
          <div className="label">Monthly Salary</div>
          <div className="input">
            <span className="sym">{currency}</span>
            <input
              className="bare"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              aria-label={`Monthly salary in ${currency}`}
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>
        </div>

        <div className="field-block">
          <div className="label">Currency</div>
          <div
            className={`input select${currencyOpen ? " focus" : ""}`}
            onClick={() => setCurrencyOpen((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setCurrencyOpen((v) => !v)}
            aria-label={`Currency: ${curr.code}`}
            aria-expanded={currencyOpen}
          >
            <span className="flag">{curr.flag}</span>
            <span>{curr.code}</span>
            <span className="em-dash">—</span>
            <span className="currency-name">{curr.name}</span>
            <div className="chev"><ChevronDown size={14} strokeWidth={1.75} /></div>
          </div>
          {currencyOpen && (
            <div className="currency-list">
              {CURRENCIES.map((c) => (
                <div
                  key={c.code}
                  className={`opt${c.code === currency ? " on" : ""}`}
                  onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                  role="option"
                  aria-selected={c.code === currency}
                >
                  <span className="flag">{c.flag}</span>
                  <span>{c.code}</span>
                  <span className="nm">— {c.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sheet-actions" style={{ marginTop: 28 }}>
          <button className="btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </>
  );
}
