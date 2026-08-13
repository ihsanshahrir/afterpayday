import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SHEET_ANIM_MS } from "../utils/ui.js";
import useFocusTrap from "../hooks/useFocusTrap.js";

const countEntries = (s) => {
  if (!s || typeof s !== "object") return 0;
  const daily = Array.isArray(s.dailyExpenses) ? s.dailyExpenses.length : 0;
  const fixed = Array.isArray(s.fixedExpenses) ? s.fixedExpenses.length : 0;
  const installments = (Array.isArray(s.debtGroups) ? s.debtGroups : [])
    .reduce((sum, g) => sum + (Array.isArray(g?.installments) ? g.installments.length : 0), 0);
  return daily + fixed + installments;
};

const formatWhen = (value) => {
  if (!value) return "unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

// A whole-state document can't be safely auto-merged, so this asks for an
// explicit choice. Opened on demand from Settings → Account (not forced on
// load — see useCloudSync's reconcile, which only surfaces this when the
// device has genuine unpushed edits that diverge from the cloud), so unlike
// other sheets in the app it's fine to let the user back out via
// scrim/Escape/close — the conflict just stays pending until they resolve it.
export default function ConflictSheet({ conflict, localState, lastSyncedAt, onResolve, onClose }) {
  const [busy, setBusy] = useState(null); // "cloud" | "device" | null
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = () => {
    setIsOpen(false);
    setTimeout(onClose, SHEET_ANIM_MS);
  };

  useFocusTrap(sheetRef, { active: isOpen, onEscape: close });

  const remoteDoc = conflict?.remote?.doc;
  const cloudCount = countEntries(remoteDoc);
  const deviceCount = countEntries(localState);

  const choose = (choice) => {
    setBusy(choice);
    onResolve(choice);
  };

  return (
    <>
      <div className={`scrim${isOpen ? " on" : ""}`} onClick={close} />
      <div
        ref={sheetRef}
        className={`sheet${isOpen ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Sync conflict"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grab" />
        <div className="sheet-head">
          <div className="titles">
            <div className="eyebrow-sm">Cloud sync</div>
            <h3>Which data do you want to keep?</h3>
          </div>
          <button className="close-btn" onClick={close} aria-label="Close">
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div style={{ font: "400 13px/1.5 var(--font)", color: "var(--fg-3)", marginBottom: 20 }}>
          This device and your cloud backup have different data. Pick one — the
          other will be replaced. This can&apos;t be undone automatically.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            background: "var(--glass)", border: "1px solid var(--glass-edge)",
            borderRadius: "var(--r-lg)", padding: "14px 16px",
          }}>
            <div style={{ font: "600 14px var(--font)", color: "var(--fg)", marginBottom: 6 }}>Cloud backup</div>
            <div style={{ font: "500 12px var(--font)", color: "var(--fg-3)" }}>
              {cloudCount} {cloudCount === 1 ? "entry" : "entries"} · updated {formatWhen(conflict?.remote?.updated_at)}
            </div>
            <button
              type="button"
              className="glass-btn-primary"
              style={{ width: "100%", marginTop: 12 }}
              onClick={() => choose("cloud")}
              disabled={Boolean(busy)}
            >
              {busy === "cloud" ? "Applying…" : "Use cloud"}
            </button>
          </div>

          <div style={{
            background: "var(--glass)", border: "1px solid var(--glass-edge)",
            borderRadius: "var(--r-lg)", padding: "14px 16px",
          }}>
            <div style={{ font: "600 14px var(--font)", color: "var(--fg)", marginBottom: 6 }}>This device</div>
            <div style={{ font: "500 12px var(--font)", color: "var(--fg-3)" }}>
              {deviceCount} {deviceCount === 1 ? "entry" : "entries"} · last synced {lastSyncedAt ? formatWhen(lastSyncedAt) : "never"}
            </div>
            <button
              type="button"
              className="glass-btn-secondary"
              style={{ width: "100%", marginTop: 12 }}
              onClick={() => choose("device")}
              disabled={Boolean(busy)}
            >
              {busy === "device" ? "Applying…" : "Keep this device"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
