import { useState, useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";
import WheelColumn from "./WheelColumn";
import Collapse from "./Collapse";
import VersionTag from "./VersionTag";
import Switch from "./Switch";
import { importState } from "../state/storage.js";
import { SHEET_ANIM_MS } from "../utils/ui.js";
import { CURRENCIES } from "../utils/currencies.js";
import { DEFAULT_CATEGORIES, CATEGORY_COLORS, makeCustomCategory } from "../utils/categories.js";
import useFocusTrap from "../hooks/useFocusTrap.js";

export default function SettingsSheet({
  settings, onSave, onExport, onExportCSV, onImport, onOpenAccount, cloudEmail,
  installVisible, installPromptEnabled, onInstallPromptEnabledChange, onOpenInstall,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [salary, setSalary] = useState(String(settings.salary || ""));
  const [currency, setCurrency] = useState(settings.currency || "RM");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [cats, setCats] = useState(() => (Array.isArray(settings.categories) ? settings.categories : []));
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatColor, setNewCatColor] = useState(0);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = (callback) => {
    setIsOpen(false);
    setTimeout(callback, SHEET_ANIM_MS);
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
      categories: cats,
    }));
  };

  const addCat = () => {
    const category = makeCustomCategory(newCatLabel, newCatColor);
    if (!category) return;
    setCats((cs) => [...cs, category]);
    setNewCatLabel("");
  };

  const removeCat = (id) => setCats((cs) => cs.filter((c) => c.id !== id));

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
    reader.onerror = () => {
      setImportError("Could not read the file. Please try again.");
    };
    reader.readAsText(file);
  };

  // Escape mirrors the scrim: settings auto-persist on close.
  useFocusTrap(sheetRef, { active: isOpen, onEscape: save });

  const curr = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  return (
    <>
      <div className={`scrim${isOpen ? " on" : ""}`} onClick={save} />
      <div
        ref={sheetRef}
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
                ariaLabel="Currency"
                items={CURRENCIES.map((c) => `${c.flag}  ${c.code}`)}
                selectedIndex={CURRENCIES.findIndex((c) => c.code === currency)}
                onChange={(idx) => setCurrency(CURRENCIES[idx].code)}
              />
            </div>
          </Collapse>
        </div>

        <div className="field-block" style={{ marginTop: 24 }}>
          <button
            type="button"
            className={`label-toggle${catsOpen ? " open" : ""}`}
            onClick={() => setCatsOpen((o) => !o)}
            aria-expanded={catsOpen}
          >
            Categories
            <ChevronDown className="label-chev" size={14} strokeWidth={2} />
          </button>
          <Collapse open={catsOpen}>
            <div className="cat-manager">
              {DEFAULT_CATEGORIES.map((c) => (
                <span key={c.id} className="cat-pill" style={{ background: c.bg, color: c.color }}>
                  <span aria-hidden="true">{c.icon}</span> {c.label}
                </span>
              ))}
              {cats.map((c) => (
                <span key={c.id} className="cat-pill custom" style={{ background: c.bg, color: c.color }}>
                  <span aria-hidden="true">{c.icon}</span> {c.label}
                  <button type="button" onClick={() => removeCat(c.id)} aria-label={`Remove ${c.label}`}>
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
            <div className="cat-add">
              <div className="cat-colors" role="group" aria-label="Category colour">
                {CATEGORY_COLORS.map((p, i) => (
                  <button
                    key={p.color}
                    type="button"
                    className={`cat-swatch${newCatColor === i ? " on" : ""}`}
                    style={{ background: p.color }}
                    aria-label={`Colour ${i + 1}`}
                    aria-pressed={newCatColor === i}
                    onClick={() => setNewCatColor(i)}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  className="glass-input"
                  style={{ flex: 1 }}
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCat()}
                  placeholder="New category (e.g. 🛒 Groceries)"
                  aria-label="New category name"
                />
                <button type="button" className="glass-btn-secondary" onClick={addCat} disabled={!newCatLabel.trim()}>
                  Add
                </button>
              </div>
            </div>
          </Collapse>
        </div>

        <div className="field-block" style={{ marginTop: 24 }}>
          <button
            type="button"
            className={`label-toggle${backupOpen ? " open" : ""}`}
            onClick={() => setBackupOpen((o) => !o)}
            aria-expanded={backupOpen}
          >
            Backup
            <ChevronDown className="label-chev" size={14} strokeWidth={2} />
          </button>
          <Collapse open={backupOpen}>
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
            {onExportCSV && (
              <button
                type="button"
                className="glass-btn-secondary"
                style={{ width: "100%", marginTop: 8 }}
                onClick={onExportCSV}
              >
                Export spending (CSV)
              </button>
            )}
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
          </Collapse>
        </div>

        {installVisible && (
          <div className="field-block" style={{ marginTop: 24 }}>
            <button
              type="button"
              className={`label-toggle${installOpen ? " open" : ""}`}
              onClick={() => setInstallOpen((o) => !o)}
              aria-expanded={installOpen}
            >
              Home Screen
              <ChevronDown className="label-chev" size={14} strokeWidth={2} />
            </button>
            <Collapse open={installOpen}>
              <div className="install-setting-row">
                <div>
                  <div className="label" style={{ marginBottom: 2 }}>Prompt after guide</div>
                  <div className="hint">Show the install popup when onboarding finishes.</div>
                </div>
                <Switch
                  checked={installPromptEnabled}
                  onChange={onInstallPromptEnabledChange}
                  label="Prompt to add to Home Screen after the guide"
                />
              </div>
              <button
                type="button"
                className="glass-btn-secondary"
                style={{ width: "100%", marginTop: 12 }}
                onClick={onOpenInstall}
              >
                Add to Home Screen
              </button>
            </Collapse>
          </div>
        )}

        {onOpenAccount && (
          <div className="field-block" style={{ marginTop: 24 }}>
            <div className="label">Cloud sync</div>
            <button
              type="button"
              className="glass-btn-secondary"
              style={{ width: "100%" }}
              onClick={onOpenAccount}
            >
              {cloudEmail ? `Account · ${cloudEmail}` : "Sign in to sync"}
            </button>
          </div>
        )}

        <div className="sheet-actions" style={{ marginTop: 20 }}>
          <button className="btn-primary" onClick={save}>Save</button>
        </div>

        <VersionTag />
      </div>
    </>
  );
}
