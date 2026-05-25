import { useState, useEffect } from "react";
import { X } from "lucide-react";
import WheelColumn from "./WheelColumn";

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
            <h3>Wallet</h3>
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
          <div className="currency-wheel">
            <WheelColumn
              items={CURRENCIES.map((c) => `${c.flag}  ${c.code}`)}
              selectedIndex={CURRENCIES.findIndex((c) => c.code === currency)}
              onChange={(idx) => setCurrency(CURRENCIES[idx].code)}
            />
          </div>
          <div className="currency-wheel-label">{curr.name}</div>
        </div>

        <div className="sheet-actions" style={{ marginTop: 28 }}>
          <button className="btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </>
  );
}
