import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SHEET_ANIM_MS } from "../utils/ui.js";
import useFocusTrap from "../hooks/useFocusTrap.js";

const STATUS_LABEL = {
  syncing: "Syncing…",
  synced: "Synced",
  offline: "Offline — will sync when back online",
  error: "Sync error",
  conflict: "Conflict — resolve to continue syncing",
};

const formatSyncedAt = (ts) => {
  if (!ts) return "never";
  const diffMs = Date.now() - ts;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export default function AccountSheet({ cloud, onClose, onWipeLocal, onReviewConflict }) {
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
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

  const handleSignIn = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await cloud.signInWithGoogle();
      // On success the browser navigates away to Google's consent screen —
      // this component unmounts. Only a pre-redirect failure reaches here.
    } catch (e) {
      setFormError(e?.message || "Could not start sign-in. Try again.");
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await cloud.signOut();
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutAndWipe = async () => {
    if (!window.confirm("Sign out and delete all local data on this device? Your cloud backup is unaffected.")) return;
    setBusy(true);
    try {
      await cloud.signOut();
      onWipeLocal();
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={`scrim${isOpen ? " on" : ""}`} onClick={close} />
      <div
        ref={sheetRef}
        className={`sheet${isOpen ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grab" />
        <div className="sheet-head">
          <div className="titles">
            <div className="eyebrow-sm">Cloud sync</div>
            <h3>Account</h3>
          </div>
          <button className="close-btn" onClick={close} aria-label="Close">
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {cloud.email ? (
          <>
            <div className="field-block">
              <div className="label">Signed in as</div>
              <div style={{ font: "500 15px var(--font)", color: "var(--fg)" }}>{cloud.email}</div>
              <div style={{ marginTop: 6, font: "500 12px var(--font)", color: "var(--fg-3)" }}>
                {STATUS_LABEL[cloud.status] || "Idle"}
                {cloud.status !== "syncing" && ` · Last synced ${formatSyncedAt(cloud.lastSyncedAt)}`}
              </div>
              {cloud.errorMessage && (
                <div role="alert" style={{ marginTop: 8, font: "500 12px var(--font)", color: "var(--rose)" }}>
                  {cloud.errorMessage}
                </div>
              )}
            </div>

            {cloud.status === "conflict" && (
              <div
                className="field-block"
                style={{
                  marginTop: 24, padding: "14px 16px", borderRadius: "var(--r-lg)",
                  background: "rgba(252,211,77,0.10)", border: "1px solid rgba(252,211,77,0.30)",
                }}
              >
                <div style={{ font: "600 13px var(--font)", color: "var(--fg)", marginBottom: 4 }}>
                  This device and your cloud backup have diverged
                </div>
                <div style={{ font: "500 12px/1.5 var(--font)", color: "var(--fg-3)" }}>
                  You have edits here that haven&apos;t synced. Pick which data to keep.
                </div>
                <button
                  type="button"
                  className="glass-btn-primary"
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={onReviewConflict}
                >
                  Review conflict
                </button>
              </div>
            )}

            <div className="field-block" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="glass-btn-secondary"
                style={{ width: "100%" }}
                onClick={() => cloud.syncNow()}
                disabled={cloud.status === "syncing"}
              >
                Sync now
              </button>
              <button
                type="button"
                className="glass-btn-secondary"
                style={{ width: "100%", marginTop: 8 }}
                onClick={handleSignOut}
                disabled={busy}
              >
                Sign out
              </button>
              <button
                type="button"
                className="glass-btn-secondary"
                style={{ width: "100%", marginTop: 8, color: "var(--rose)" }}
                onClick={handleSignOutAndWipe}
                disabled={busy}
              >
                Sign out &amp; wipe local data
              </button>
            </div>
          </>
        ) : (
          <div className="field-block">
            <div className="label">Sign in</div>
            {formError && (
              <div role="alert" style={{ marginBottom: 8, font: "500 12px var(--font)", color: "var(--rose)" }}>
                {formError}
              </div>
            )}
            <button
              type="button"
              className="glass-btn-primary"
              style={{ width: "100%" }}
              onClick={handleSignIn}
              disabled={busy}
            >
              {busy ? "Redirecting…" : "Sign in with Google"}
            </button>
          </div>
        )}

        <div className="field-block" style={{ marginTop: 24 }}>
          <div style={{ font: "400 12px/1.5 var(--font)", color: "var(--fg-3)" }}>
            No telemetry or analytics. Your data is only sent to your own private,
            row-level-secured cloud row — visible to no one else — and only while
            you&apos;re signed in. Guests never touch the network.
          </div>
        </div>
      </div>
    </>
  );
}
