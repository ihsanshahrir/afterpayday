import { useState, useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";
import WheelColumn from "./WheelColumn";
import Collapse from "./Collapse";
import { importState } from "../state/storage.js";

const CURRENCIES = [
  { code: "RM",  flag: "🇲🇾", name: "Malaysian Ringgit" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore Dollar" },
  { code: "USD", flag: "🇺🇸", name: "US Dollar" },
  { code: "GBP", flag: "🇬🇧", name: "British Pound" },
  { code: "EUR", flag: "🇪🇺", name: "Euro" },
];

export default function SettingsSheet({ settings, onClose, onSave, onExport, onImport }) {
  const [isOpen, setIsOpen] = useState(false);
  const [salary, setSalary] = useState(String(settings.salary || ""));
  const [currency, setCurrency] = useState(settings.currency || "RM");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = (callback) => {
    setIsOpen(false);
    setTimeout(callback, 400);
  };

  // Auto-persist on close (X / scrim) to match the rest of the app, which
  // never asks the user to confirm an edit. The Save button uses the same
  // path so behavior is consistent. An empty / invalid salary input is
  // treated as "no change" — accidentally clearing the field and tapping
  // outside should not zero out a previously-saved salary. To reset, the
  // user explicitly types 0.
  const save = () => {
    const trimmed = salary.trim();
    const parsed = trimmed === "" ? NaN : parseFloat(trimmed);
    const nextSalary = Number.isFinite(parsed) && parsed >= 0 ? parsed : settings.salary;
    close(() => onSave({
      salary: nextSalary,
      currency: currency.trim() || settings.currency || "RM",
    }));
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const normalized = importState(parsed);
        if (!normalized) {
          setImportError("Invalid backup file — not a recognisable AfterPayday backup.");
          return;
        }
        if (window.confirm("Replace all current data with this backup? This cannot be undone.")) {
          close(() => onImport(normalized));
        }
      } catch {
        setImportError("Could not read file. Make sure it is a valid JSON backup.");
      }
    };
    reader.readAsText(file);
  };

  const curr = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  return (
    <>
      <div className={`scrim${isOpen ? " on" : ""}`} onClick={save} />
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
          <button className="close-btn" onClick={save} aria-label="Close">
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
          <button
            type="button"
            className={`currency-trigger${currencyOpen ? " open" : ""}`}
            onClick={() => setCurrencyOpen((o) => !o)}
            aria-expanded={currencyOpen}
            aria-label={`Currency: ${curr.name}`}
          >
            <span className="cur-flag">{curr.flag}</span>
            <span className="cur-code">{curr.code}</span>
            <span className="cur-name">{curr.name}</span>
            <ChevronDown className="cur-chev" size={18} strokeWidth={2} />
          </button>
          <Collapse open={currencyOpen}>
            <div className="currency-dropdown">
              <WheelColumn
                items={CURRENCIES.map((c) => `${c.flag}  ${c.code}`)}
                selectedIndex={CURRENCIES.findIndex((c) => c.code === currency)}
                onChange={(idx) => setCurrency(CURRENCIES[idx].code)}
              />
            </div>
          </Collapse>
        </div>

        <div className="field-block" style={{ marginTop: 24 }}>
          <div className="label">Backup</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="glass-btn-secondary"
              style={{ flex: 1 }}
              onClick={onExport}
            >
              Export
            </button>
            <button
              type="button"
              className="glass-btn-secondary"
              style={{ flex: 1 }}
              onClick={() => fileInputRef.current?.click()}
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </div>
          {importError && (
            <div
              role="alert"
              style={{
                marginTop: 8,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(244,63,94,0.10)",
                border: "1px solid rgba(244,63,94,0.30)",
                font: "500 12px var(--font)",
                color: "var(--rose)",
              }}
            >
              {importError}
            </div>
          )}
        </div>

        <div className="sheet-actions" style={{ marginTop: 20 }}>
          <button className="btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </>
  );
}
