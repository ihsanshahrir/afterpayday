import { useState } from "react";

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

// Forces an explicit choice — a whole-state document can't be safely
// auto-merged, so the app blocks (no scrim/Escape dismiss) until the user
// picks a side. Rendered by App whenever useCloudSync reports a conflict.
export default function ConflictSheet({ conflict, localState, lastSyncedAt, onResolve }) {
  const [busy, setBusy] = useState(null); // "cloud" | "device" | null

  const remoteDoc = conflict?.remote?.doc;
  const cloudCount = countEntries(remoteDoc);
  const deviceCount = countEntries(localState);

  const choose = (choice) => {
    setBusy(choice);
    onResolve(choice);
  };

  return (
    <>
      <div className="scrim on" />
      <div
        className="sheet on"
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
