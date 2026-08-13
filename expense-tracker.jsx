import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Settings as SettingsIcon,
  LayoutDashboard,
  ListChecks,
  History,
  HelpCircle,
  Camera,
  Loader2,
  ChevronDown,
  Plus,
  CloudOff,
  CloudCheck,
  CloudAlert,
} from "lucide-react";
import { uid } from "./utils/id.js";
import { todayISO, currentMonthKey, nextMonthKey, isFixedPaidThisMonth, monthLabel, fmtDate } from "./utils/date.js";
import { fmtNum } from "./utils/money.js";
import { mergeCategories, PAYMENT_METHODS, makeCustomCategory } from "./utils/categories.js";
import { SMART_SCAN_PREF_KEY } from "./utils/ui.js";
import { toDailyCSV } from "./utils/csv.js";
import DatePickerField from "./components/commitments/DatePickerField.jsx";
import Collapse from "./components/Collapse.jsx";
import { downscaleToCanvas } from "./utils/image.js";
import { recognizeReceipt } from "./utils/ocr.js";
import { parseReceiptText } from "./utils/receiptParse.js";
import { SCAN_PROXY_URL, smartScanReceipt } from "./utils/aiScan.js";
import { loadState, saveState, STORAGE_KEY } from "./state/storage.js";
import {
  fixedGrandTotal,
  fixedUnpaidTotal,
  installmentTotals,
  recentDailySuggestions,
  buildMonthSnapshot,
  computeSafeToSpend,
  computeSpentThisMonth,
} from "./state/derive.js";
import SplashScreen from "./components/SplashScreen.jsx";
import OnboardingSlides, { ONBOARDING_KEY } from "./components/OnboardingSlides.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Commitments from "./components/Commitments.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import HistorySheet from "./components/HistorySheet.jsx";
import AccountSheet from "./components/AccountSheet.jsx";
import ConflictSheet from "./components/ConflictSheet.jsx";
import useFocusTrap from "./hooks/useFocusTrap.js";
import useAppUpdate from "./hooks/useAppUpdate.js";
import useCloudSync from "./hooks/useCloudSync.js";

// Whether the AI proxy is configured for this build. When false, Smart Scan is
// hidden entirely and scanning stays 100% on-device (Tesseract).
const SMART_SCAN_AVAILABLE = Boolean(SCAN_PROXY_URL);

// At-a-glance cloud sync status for the header icon. "signed-out" also
// covers guests (cloud sync available but not signed in) — everything else
// mirrors useCloudSync's status machine.
const CLOUD_STATUS_META = {
  "signed-out": { Icon: CloudOff, color: "var(--fg-3)", label: "Local only — tap to sign in" },
  syncing: { Icon: Loader2, color: "var(--fg-3)", label: "Syncing…", spin: true },
  synced: { Icon: CloudCheck, color: "var(--emerald)", label: "Synced to cloud" },
  offline: { Icon: CloudOff, color: "var(--amber)", label: "Offline — will sync when back online" },
  error: { Icon: CloudAlert, color: "var(--rose)", label: "Sync error — tap for details" },
  conflict: { Icon: CloudAlert, color: "var(--amber)", label: "Sync conflict — tap to resolve" },
};

const readSmartScanPref = () => {
  try {
    return localStorage.getItem(SMART_SCAN_PREF_KEY) === "1";
  } catch {
    return false;
  }
};

// Split a comma-separated tag string into a clean, de-duped array.
const parseTags = (str) => {
  const out = [];
  for (const t of String(str).split(",")) {
    const s = t.trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
};

function AddSheet({
  open,
  editing,
  currency,
  storageFull,
  categories,
  suggestions = [],
  onAddCategory,
  onClose,
  onSave,
}) {
  const isEdit = Boolean(editing);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("food");
  const [kind, setKind] = useState("expense");
  const [date, setDate] = useState(todayISO);
  const [merchant, setMerchant] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanError, setScanError] = useState(null);
  // Opt-in: use the AI proxy ("Smart Scan") instead of on-device OCR. Persisted
  // so the choice sticks across sessions. Only meaningful when configured.
  const [smartScan, setSmartScan] = useState(readSmartScanPref);
  const amtRef = useRef(null);
  const fileRef = useRef(null);
  const sheetRef = useRef(null);
  // Incremented whenever the sheet closes or the user saves manually.
  // onPickFile captures the value at scan start and bails out if it changes
  // before the async work finishes, preventing stale OCR results from writing
  // into the form after a close/save.
  const scanTokenRef = useRef(0);
  // Identifies the most recent scan attempt. The busy indicator is cleared by
  // the scan's own completion rather than the save/close token: the on-device
  // engine is single-flight, so the Scan button must stay disabled until the
  // previous run actually settles — even after its result has been discarded.
  const scanSeqRef = useRef(0);

  const allCats = useMemo(() => mergeCategories(categories), [categories]);

  // The sheet already focuses the amount input on its own schedule (timed to
  // the slide-in), so the trap only contains Tab and handles Escape.
  useFocusTrap(sheetRef, { active: open, onEscape: onClose, initialFocus: false });

  // Seed the form when the sheet opens: from the row being edited, or fresh
  // defaults for a new add. Fields are intentionally NOT cleared on close so
  // they don't visibly empty during the slide-out animation — the next open
  // re-seeds. Closing only invalidates any in-flight scan callback.
  useEffect(() => {
    if (!open) {
      scanTokenRef.current += 1;
      return undefined;
    }
    if (editing) {
      setAmount(String(editing.amount ?? ""));
      setDesc(editing.description || "");
      setCat(editing.category || "food");
      setKind(editing.kind === "refund" ? "refund" : "expense");
      setDate(editing.date || todayISO());
      setMerchant(editing.merchant || "");
      setPaymentMethod(editing.paymentMethod || "");
      setTags(Array.isArray(editing.tags) ? editing.tags.join(", ") : "");
      setNote(editing.note || "");
      setDetailsOpen(
        Boolean(
          editing.merchant ||
            editing.paymentMethod ||
            (editing.tags && editing.tags.length) ||
            editing.note ||
            (editing.date && editing.date !== todayISO())
        )
      );
    } else {
      setAmount("");
      setDesc("");
      setCat("food");
      setKind("expense");
      setDate(todayISO());
      setMerchant("");
      setPaymentMethod("");
      setTags("");
      setNote("");
      setDetailsOpen(false);
    }
    setAddingCat(false);
    setNewCat("");
    setScanning(false);
    setScanProgress(0);
    setScanError(null);
    const t = setTimeout(() => amtRef.current && amtRef.current.focus(), 280);
    return () => clearTimeout(t);
  }, [open, editing]);

  const a = parseFloat(amount);
  const valid = Number.isFinite(a) && a > 0;

  const submit = (addAnother = false) => {
    if (!valid || storageFull) return;
    scanTokenRef.current += 1; // invalidate any in-flight scan callback
    onSave(
      {
        amount: a,
        description: desc.trim(),
        category: cat,
        date,
        kind,
        merchant: merchant.trim() || undefined,
        paymentMethod: paymentMethod || undefined,
        tags: parseTags(tags),
        note: note.trim() || undefined,
      },
      editing?.id,
      addAnother
    );
    if (addAnother && !isEdit) {
      // Rapid logging: keep date/category/direction/payment, clear the rest.
      // A scan still in flight keeps the busy indicator up until the engine
      // settles (its finally block clears it — see scanSeqRef); its result is
      // discarded by the token bump above.
      setAmount("");
      setDesc("");
      setMerchant("");
      setTags("");
      setNote("");
      setScanError(null);
      setTimeout(() => amtRef.current && amtRef.current.focus(), 0);
    }
  };

  const applySuggestion = (s) => {
    setDesc(s.description);
    setCat(s.category);
    amtRef.current && amtRef.current.focus();
  };

  const confirmAddCat = () => {
    const category = makeCustomCategory(newCat, allCats.length);
    if (!category) return;
    onAddCategory?.(category);
    setCat(category.id);
    setNewCat("");
    setAddingCat(false);
  };

  const toggleSmartScan = useCallback(() => {
    setSmartScan((v) => {
      const next = !v;
      try {
        localStorage.setItem(SMART_SCAN_PREF_KEY, next ? "1" : "0");
      } catch { /* private mode / quota — pref just won't persist */ }
      return next;
    });
  }, []);

  // Scan a photo/upload of a receipt and pre-fill whatever we can read. By
  // default OCR runs entirely on-device (see utils/ocr.js) and the image never
  // leaves the device. With Smart Scan opted in (and online), the image is sent
  // to our proxy for an AI read instead (see utils/aiScan.js); the AI result is
  // validated/clamped before it touches the form, and any AI failure falls back
  // to the on-device engine. Fields the parser can't recover are left for the
  // user to type — scanning never blocks manual entry.
  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    setScanError(null);
    setScanProgress(0);
    setScanning(true);
    const token = scanTokenRef.current;
    const seq = ++scanSeqRef.current;
    const useAI = smartScan && SMART_SCAN_AVAILABLE && navigator.onLine;
    try {
      const canvas = await downscaleToCanvas(file);
      let parsed;
      if (useAI) {
        try {
          parsed = await smartScanReceipt(canvas);
        } catch (aiErr) {
          // Proxy down, offline mid-scan, or rate-limited — fall back to the
          // on-device engine so the user still gets a result.
          console.warn("Smart Scan failed; falling back to on-device OCR", aiErr);
          const text = await recognizeReceipt(canvas, setScanProgress);
          parsed = parseReceiptText(text);
        }
      } else {
        const text = await recognizeReceipt(canvas, setScanProgress);
        parsed = parseReceiptText(text);
      }
      if (scanTokenRef.current !== token) return; // sheet closed or saved while scanning
      const got = parsed.amount != null || parsed.description || parsed.date;
      if (parsed.amount != null) setAmount(String(parsed.amount));
      if (parsed.description) setDesc(parsed.description);
      if (parsed.date) setDate(parsed.date);
      if (got) setCat(parsed.category);
      if (!got) setScanError("Couldn't read it — enter the details manually.");
    } catch (err) {
      if (scanTokenRef.current !== token) return; // ignore errors from cancelled scans
      console.error("Receipt scan failed", err);
      setScanError("Scan failed. The first scan needs a connection; after that it works offline.");
    } finally {
      // Clear the busy state only if no newer scan attempt has started. Keyed
      // to the scan sequence, not the close/save token: a save can discard
      // this scan's RESULT while the engine is still busy, and re-enabling the
      // Scan button before the run settles would let the next pick hit the
      // engine's single-flight lock and surface a false failure.
      if (scanSeqRef.current === seq) {
        setScanning(false);
        setScanProgress(0);
      }
    }
  };

  const titleDate = date === todayISO() ? "today" : fmtDate(date);
  const amountSuffix = valid ? ` · ${currency} ${fmtNum(a)}` : "";
  const primaryLabel = isEdit
    ? `Save changes${amountSuffix}`
    : `${kind === "refund" ? "Save refund" : "Save expense"}${amountSuffix}`;

  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} />
      <div
        ref={sheetRef}
        className={`sheet${open ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div className="grab" />
        <div className="scan-row">
          <div className="stitle" id="sheet-title" style={{ marginBottom: 0 }}>
            {isEdit ? "Edit entry" : <>Add to <b>{titleDate}</b></>}
          </div>
          <button
            type="button"
            className="scan-btn"
            onClick={() => fileRef.current && fileRef.current.click()}
            disabled={scanning || storageFull}
            aria-label="Scan a receipt with your camera"
          >
            {scanning
              ? <Loader2 size={15} strokeWidth={2} className="spin" />
              : <Camera size={15} strokeWidth={1.75} />}
            <span>{scanning ? "Scanning" : "Scan"}</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPickFile}
          style={{ display: "none" }}
        />
        {SMART_SCAN_AVAILABLE && (
          <label className="smart-scan-toggle">
            <input
              type="checkbox"
              checked={smartScan}
              onChange={toggleSmartScan}
              disabled={scanning}
            />
            <span>Smart Scan (AI)</span>
          </label>
        )}
        {SMART_SCAN_AVAILABLE && smartScan && (
          <div className="smart-scan-note">
            Sends the photo to our AI service to read it — more accurate, needs a connection.
          </div>
        )}
        {(scanning || scanError) && (
          <div className={`scan-status${scanError ? " err" : ""}`} role="status">
            {scanning
              ? `Reading receipt${scanProgress > 0 ? ` · ${Math.round(scanProgress * 100)}%` : "…"}`
              : scanError}
          </div>
        )}

        {/* Direction: expense vs refund (source of truth for `kind`) */}
        <div className="seg" role="group" aria-label="Direction">
          <button
            type="button"
            className={kind === "expense" ? "on" : ""}
            aria-pressed={kind === "expense"}
            onClick={() => setKind("expense")}
          >
            Expense
          </button>
          <button
            type="button"
            className={kind === "refund" ? "on" : ""}
            aria-pressed={kind === "refund"}
            onClick={() => setKind("refund")}
          >
            Refund
          </button>
        </div>

        <div className="amount-input">
          <span className="sym" aria-hidden="true">{currency}</span>
          <input
            ref={amtRef}
            inputMode="decimal"
            placeholder="0.00"
            aria-label={`Amount in ${currency}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <input
          className="desc-input"
          placeholder={kind === "refund" ? "What was refunded?" : "What did you spend on?"}
          aria-label="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {!isEdit && suggestions.length > 0 && (
          <div className="suggestions" aria-label="Recent">
            {suggestions.map((s) => (
              <button
                key={s.description}
                type="button"
                className="sugg"
                onClick={() => applySuggestion(s)}
              >
                {s.description}
              </button>
            ))}
          </div>
        )}
        <div className="chips">
          {allCats.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cat === c.id ? "on" : ""}
              onClick={() => setCat(c.id)}
            >
              <span aria-hidden="true">{c.icon}</span> {c.label}
            </button>
          ))}
          <button
            type="button"
            className="chip-add"
            aria-label="Add category"
            aria-expanded={addingCat}
            onClick={() => setAddingCat((v) => !v)}
          >
            <Plus size={13} strokeWidth={2.25} />
          </button>
        </div>
        {addingCat && (
          <div className="cat-add-row">
            <input
              autoFocus
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmAddCat()}
              placeholder="New category (e.g. 🛒 Groceries)"
              aria-label="New category name"
            />
            <button type="button" className="btn-mini" onClick={confirmAddCat} disabled={!newCat.trim()}>
              Add
            </button>
          </div>
        )}

        <button
          type="button"
          className="more-toggle"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((v) => !v)}
        >
          <ChevronDown size={15} strokeWidth={2} className={detailsOpen ? "rot" : ""} />
          {detailsOpen ? "Fewer details" : "More details"}
        </button>
        <Collapse open={detailsOpen}>
          <div className="more-details">
            <div className="field-label">Date</div>
            <DatePickerField value={date} onChange={setDate} />

            <div className="field-label">Payment method</div>
            <div className="seg seg-wrap">
              <button
                type="button"
                className={!paymentMethod ? "on" : ""}
                onClick={() => setPaymentMethod("")}
              >
                —
              </button>
              {PAYMENT_METHODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={paymentMethod === p.id ? "on" : ""}
                  onClick={() => setPaymentMethod(p.id)}
                >
                  <span aria-hidden="true">{p.icon}</span> {p.label}
                </button>
              ))}
            </div>

            <div className="field-label">Merchant</div>
            <input
              className="desc-input"
              placeholder="Where? (optional)"
              aria-label="Merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />

            <div className="field-label">Tags</div>
            <input
              className="desc-input"
              placeholder="comma, separated (optional)"
              aria-label="Tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />

            <div className="field-label">Note</div>
            <input
              className="desc-input"
              placeholder="Add a note (optional)"
              aria-label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </Collapse>

        <div className="sheet-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid || storageFull} onClick={() => submit(false)}>
            {primaryLabel}
          </button>
        </div>
        {!isEdit && (
          <button
            type="button"
            className="add-another"
            disabled={!valid || storageFull}
            onClick={() => submit(true)}
          >
            Save &amp; add another
          </button>
        )}
      </div>
    </>
  );
}

// ---------- root ----------
export default function App() {
  const [showSplash] = useState(() => {
    if (sessionStorage.getItem("afterpayday-splash")) return false;
    sessionStorage.setItem("afterpayday-splash", "1");
    return true;
  });
  const [splashDone, setSplashDone] = useState(!showSplash);
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("dashboard");
  const [amountsHidden, setAmountsHidden] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showConflictSheet, setShowConflictSheet] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY));
  const [storageError, setStorageError] = useState(false);
  // null when closed; { editing } when open — editing is the row being edited
  // (or null for a fresh add). One piece of state drives both add and edit.
  const [addSheet, setAddSheet] = useState(null);
  const [undo, setUndo] = useState(null); // { snapshot, label } | null
  const undoTimerRef = useRef(null);
  const { updateReady, applyUpdate } = useAppUpdate();

  useEffect(() => {
    navigator.storage?.persist?.();
  }, []);

  useEffect(() => {
    const ok = saveState(state);
    setStorageError(!ok);
  }, [state]);

  // Downstream of the local save above, never in front of it — cloud sync
  // never blocks or replaces the local-first write path.
  const cloud = useCloudSync({ state, onRemoteState: setState });

  const handleWipeLocal = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("afterpayday:sync");
      localStorage.removeItem("afterpayday:device");
    } catch { /* best-effort */ }
    window.location.reload();
  }, []);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `afterpayday-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state]);

  const handleExportCSV = useCallback(() => {
    const blob = new Blob([toDailyCSV(state.dailyExpenses, state.settings.categories)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `afterpayday-expenses-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.dailyExpenses, state.settings.categories]);

  const handleImport = useCallback((importedState) => {
    setState(importedState);
    setShowSettings(false);
  }, []);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  // Snapshot the whole state before a destructive change so a single tap can
  // restore it. Whole-state undo keeps the restore trivially correct (no
  // per-entity re-insertion) and covers every delete uniformly.
  const requestUndo = useCallback((label) => {
    setUndo({ snapshot: stateRef.current, label });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndo(null), 5000);
  }, []);

  const performUndo = () => {
    if (undo) setState(undo.snapshot);
    setUndo(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  useEffect(() => {
    const checkRollover = () => {
      const s = stateRef.current;
      const nowMonth = currentMonthKey();
      if (!s.currentMonth || s.currentMonth >= nowMonth) return;

      // Snapshot every month between the last-seen month and now, not just the
      // most recent one — if the app goes unopened across a gap of 2+ months,
      // each skipped month still has real data (fixed expenses' paidMonth,
      // installments' dueDate/paidMonth, dailyExpenses' date) tagged with that
      // exact month, so it would otherwise be silently dropped from History.
      // Only count fixed expenses and installments the user marked paid —
      // unpaid amounts roll forward as overdue rather than retroactively
      // reducing a closed month's balance. Guarded against a runaway loop from
      // corrupted currentMonth data.
      //
      // Skip months already present in history: this effect re-registers its
      // visibilitychange/timer listeners on every mount, and two of them can
      // fire back-to-back before stateRef catches up (and, with cloud sync,
      // a pulled remote doc can already carry the snapshot another device
      // took) — without this guard either race duplicates a month's entry.
      const existingMonths = new Set((s.history || []).map((h) => h.month));
      const snapshots = [];
      let closing = s.currentMonth;
      let guard = 0;
      while (closing < nowMonth && guard++ < 240) {
        if (!existingMonths.has(closing)) {
          snapshots.push({ id: uid(), ...buildMonthSnapshot(s, closing) });
        }
        closing = nextMonthKey(closing);
      }

      setState(prev => ({
        ...prev,
        currentMonth: nowMonth,
        history: [...snapshots.reverse(), ...(prev.history || [])],
      }));
    };

    let timer = null;
    const scheduleNext = () => {
      if (timer) clearTimeout(timer);
      const now = new Date();
      // First second of the next month, in local time. Capped so very long
      // tabs don't hit the setTimeout 32-bit overflow.
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 1);
      const delay = Math.min(Math.max(next - now, 1000), 2_147_000_000);
      timer = setTimeout(() => {
        checkRollover();
        scheduleNext();
      }, delay);
    };

    checkRollover();
    scheduleNext();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkRollover();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY) && state.settings.salary === 0 && state.fixedExpenses.length === 0 && state.debtGroups.length === 0 && state.dailyExpenses.length === 0) {
      return;
    }
    if (state.settings.salary === 0 && state.fixedExpenses.length === 0 && state.debtGroups.length === 0 && state.dailyExpenses.length === 0) {
      setShowSettings(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currency = state.settings.currency || "RM";

  // ---------- derived totals (pure logic lives in state/derive.js) ----------
  const monthKey = currentMonthKey();

  const fixedTotal = useMemo(
    () => fixedUnpaidTotal(state.fixedExpenses, monthKey),
    [state.fixedExpenses, monthKey]
  );

  const fixedGrand = useMemo(
    () => fixedGrandTotal(state.fixedExpenses),
    [state.fixedExpenses]
  );

  const instTotals = useMemo(
    () => installmentTotals(state.debtGroups, monthKey),
    [state.debtGroups, monthKey]
  );

  // Recent distinct descriptions for one-tap re-add in the Add sheet.
  const recentSuggestions = useMemo(
    () => recentDailySuggestions(state.dailyExpenses, 4),
    [state.dailyExpenses]
  );

  // Single source of truth for both figures — see state/derive.js for the
  // formulas and their unit tests.
  const safeToSpend = useMemo(
    () => computeSafeToSpend(state, monthKey),
    [state, monthKey]
  );

  const spentThisMonth = useMemo(
    () => computeSpentThisMonth(state, monthKey),
    [state, monthKey]
  );

  // ---------- mutations ----------
  const updateSettings = (patch) =>
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const addFixedExpense = (name, amount) => {
    if (storageError) return;
    setState((s) => ({
      ...s,
      fixedExpenses: [...s.fixedExpenses, { id: uid(), name, amount: Number(amount), paidMonth: null }],
    }));
  };

  const toggleFixedPaid = (id) =>
    setState((s) => ({
      ...s,
      fixedExpenses: s.fixedExpenses.map((e) =>
        e.id !== id
          ? e
          : { ...e, paidMonth: isFixedPaidThisMonth(e) ? null : currentMonthKey() }
      ),
    }));

  const editFixedExpense = (id, name, amount) =>
    setState((s) => ({
      ...s,
      fixedExpenses: s.fixedExpenses.map((e) =>
        e.id === id ? { ...e, name, amount: Number(amount) } : e
      ),
    }));

  const removeFixedExpense = (id) => {
    requestUndo("Fixed expense deleted");
    setState((s) => ({ ...s, fixedExpenses: s.fixedExpenses.filter((e) => e.id !== id) }));
  };

  // Build the stored shape from the Add sheet's payload. Amounts are always
  // stored positive; `kind` records direction (a refund lifts safe-to-spend).
  // Optional fields are only included when set, matching storage's sanitizer.
  // `date` defaults to today but can be back-dated; guard a malformed value so
  // the entry survives the sanitizer.
  const dailyFields = (entry) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : todayISO();
    const out = {
      amount: Number(entry.amount),
      description: entry.description || "",
      date,
      category: entry.category || "other",
      kind: entry.kind === "refund" ? "refund" : "expense",
    };
    if (entry.merchant) out.merchant = entry.merchant;
    if (entry.paymentMethod) out.paymentMethod = entry.paymentMethod;
    if (Array.isArray(entry.tags) && entry.tags.length) out.tags = entry.tags;
    if (entry.note) out.note = entry.note;
    return out;
  };

  const addDailyExpense = (entry) => {
    if (storageError) return;
    setState((s) => ({
      ...s,
      dailyExpenses: [
        { id: uid(), createdAt: Date.now(), ...dailyFields(entry) },
        ...s.dailyExpenses,
      ],
    }));
  };

  // Edit an existing entry in place. Preserves the original id and createdAt;
  // re-derives every other field (optional fields cleared when emptied). Snapshot
  // for undo first so an edit is as reversible as a delete.
  const updateDailyExpense = (id, entry) => {
    if (storageError) return;
    requestUndo("Entry updated");
    setState((s) => ({
      ...s,
      dailyExpenses: s.dailyExpenses.map((e) =>
        e.id !== id
          ? e
          : { id: e.id, ...(Number.isFinite(e.createdAt) ? { createdAt: e.createdAt } : {}), ...dailyFields(entry) }
      ),
    }));
  };

  const removeDailyExpense = (id) => {
    requestUndo("Entry deleted");
    setState((s) => ({ ...s, dailyExpenses: s.dailyExpenses.filter((e) => e.id !== id) }));
  };

  // Append a user-defined custom category (from the Add sheet's quick-add).
  // Built-ins live in code; settings.categories holds custom entries only.
  const addCategory = (category) => {
    setState((s) => {
      const list = s.settings.categories || [];
      if (list.some((c) => c.id === category.id)) return s;
      return { ...s, settings: { ...s.settings, categories: [...list, category] } };
    });
  };

  const addDebtGroup = (group) => {
    if (storageError) return;
    setState((s) => ({ ...s, debtGroups: [...s.debtGroups, group] }));
  };

  const removeDebtGroup = (id) => {
    requestUndo("Debt group deleted");
    setState((s) => ({ ...s, debtGroups: s.debtGroups.filter((g) => g.id !== id) }));
  };

  const editDebtGroup = (groupId, patch) =>
    setState((s) => ({
      ...s,
      debtGroups: s.debtGroups.map((g) => (g.id !== groupId ? g : { ...g, ...patch })),
    }));

  const toggleInstallmentPaid = (groupId, instId) =>
    setState((s) => ({
      ...s,
      debtGroups: s.debtGroups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              installments: g.installments.map((i) => {
                if (i.id !== instId) return i;
                if (i.isPaid) return { ...i, isPaid: false, paidMonth: null };
                // Back-dated: stamp with own due month so historical backfill
                // doesn't reduce the current month's safe-to-spend.
                const dueMth = typeof i.dueDate === "string" ? i.dueDate.slice(0, 7) : null;
                const paidMonth = dueMth && dueMth < currentMonthKey() ? dueMth : currentMonthKey();
                return { ...i, isPaid: true, paidMonth };
              }),
            }
      ),
    }));

  const addInstallmentToGroup = (groupId, installment) => {
    if (storageError) return;
    setState((s) => ({
      ...s,
      debtGroups: s.debtGroups.map((g) =>
        g.id !== groupId ? g : { ...g, installments: [...g.installments, installment] }
      ),
    }));
  };

  const editInstallment = (groupId, instId, patch) =>
    setState((s) => ({
      ...s,
      debtGroups: s.debtGroups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              installments: g.installments.map((i) =>
                i.id === instId
                  ? { ...i, ...patch, amount: Number(patch.amount ?? i.amount) }
                  : i
              ),
            }
      ),
    }));

  const removeInstallment = (groupId, instId) => {
    requestUndo("Installment deleted");
    setState((s) => ({
      ...s,
      debtGroups: s.debtGroups.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, installments: g.installments.filter((i) => i.id !== instId) }
      ),
    }));
  };

  const handleOnboardingDone = useCallback(() => {
    setShowOnboarding(false);
    if (state.settings.salary === 0 && state.fixedExpenses.length === 0 && state.debtGroups.length === 0 && state.dailyExpenses.length === 0) {
      setShowSettings(true);
    }
  }, [state.settings.salary, state.fixedExpenses.length, state.debtGroups.length, state.dailyExpenses.length]);

  return (
    // display:contents wrapper carries splash-active above BOTH the onboarding
    // overlay and the main app, so the backdrop-filter suppression reaches the
    // onboarding icon halo on the first-launch path too — without adding a box.
    <div className={`contents${splashDone ? "" : " splash-active"}`}>
      {showOnboarding && <OnboardingSlides onDone={handleOnboardingDone} />}
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      <div
        className="antialiased overflow-x-hidden"
        style={{
          background: "var(--bg-base)",
          height: "100lvh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {/* Mood layer — fixed blurred blobs */}
        <div className="mood">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
          <div className="blob blob-4" />
          <div className="grain" />
        </div>

        <div
          className="max-w-md mx-auto"
          style={{
            position: "relative",
            zIndex: 1,
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "calc(88px + env(safe-area-inset-bottom))",
          }}
        >
          {/* Header */}
          <header className="glass appheader" style={{ margin: "12px 14px 0" }}>
            <div className="av">
              <img src={`${import.meta.env.BASE_URL}app-icon.png`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
            </div>
            <div className="who">
              <div className="h">AfterPayday</div>
              <div className="n">{monthLabel()}</div>
            </div>
            <button className="iconbtn" onClick={() => setShowOnboarding(true)} aria-label="Help">
              <HelpCircle size={16} strokeWidth={1.75} />
            </button>
            <button className="iconbtn" onClick={() => setShowHistory(true)} aria-label="History">
              <History size={16} strokeWidth={1.75} />
            </button>
            {cloud.available && (
              <button
                className="iconbtn"
                onClick={() => setShowAccount(true)}
                aria-label={CLOUD_STATUS_META[cloud.email ? cloud.status : "signed-out"].label}
                style={{ color: CLOUD_STATUS_META[cloud.email ? cloud.status : "signed-out"].color }}
              >
                {(() => {
                  const { Icon, spin } = CLOUD_STATUS_META[cloud.email ? cloud.status : "signed-out"];
                  return <Icon size={16} strokeWidth={1.75} className={spin ? "spin" : undefined} />;
                })()}
              </button>
            )}
            <button className="iconbtn" onClick={() => setShowSettings(true)} aria-label="Settings">
              <SettingsIcon size={16} strokeWidth={1.75} />
            </button>
          </header>

          {/* Content */}
          {tab === "dashboard" ? (
            <Dashboard
              currency={currency}
              salary={state.settings.salary}
              fixedTotal={fixedTotal}
              fixedGrandTotal={fixedGrand}
              installmentsTotalThisMonth={instTotals.dueThisMonth}
              installmentsUnpaidThisMonth={instTotals.unpaidThisMonth}
              installmentsOverdueUnpaid={instTotals.overdueUnpaid}
              spentThisMonth={spentThisMonth}
              safeToSpend={safeToSpend}
              dailyExpenses={state.dailyExpenses}
              categories={state.settings.categories}
              onRemoveDaily={removeDailyExpense}
              onEditDaily={(e) => setAddSheet({ editing: e })}
              amountsHidden={amountsHidden}
              setAmountsHidden={setAmountsHidden}
            />
          ) : (
            <Commitments
              currency={currency}
              storageFull={storageError}
              fixedExpenses={state.fixedExpenses}
              fixedTotal={fixedTotal}
              fixedGrandTotal={fixedGrand}
              debtGroups={state.debtGroups}
              onAddFixed={addFixedExpense}
              onEditFixed={editFixedExpense}
              onRemoveFixed={removeFixedExpense}
              onToggleFixed={toggleFixedPaid}
              onAddDebtGroup={addDebtGroup}
              onRemoveDebtGroup={removeDebtGroup}
              onEditDebtGroup={editDebtGroup}
              onToggleInstallment={toggleInstallmentPaid}
              onAddInstallment={addInstallmentToGroup}
              onEditInstallment={editInstallment}
              onRemoveInstallment={removeInstallment}
              amountsHidden={amountsHidden}
            />
          )}
        </div>

        {/* Floating tab bar */}
        <nav
          aria-label="Primary"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            className="glass tabbar"
            style={{
              width: "calc(100% - 28px)",
              maxWidth: 420,
              marginBottom: "max(8px, env(safe-area-inset-bottom))",
            }}
            onKeyDown={(e) => {
              // Light roving enhancement: arrow keys move selection and focus
              // between the two tabs.
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              const next = tab === "dashboard" ? "commitments" : "dashboard";
              setTab(next);
              e.currentTarget
                .querySelector(next === "dashboard" ? "button:first-of-type" : "button:nth-of-type(2)")
                ?.focus();
            }}
          >
            <button
              className={tab === "dashboard" ? "active" : ""}
              aria-current={tab === "dashboard" ? "page" : undefined}
              onClick={() => setTab("dashboard")}
            >
              <LayoutDashboard size={18} strokeWidth={1.75} />
              <span>Today</span>
            </button>
            <button
              className={tab === "commitments" ? "active" : ""}
              aria-current={tab === "commitments" ? "page" : undefined}
              onClick={() => setTab("commitments")}
            >
              <ListChecks size={18} strokeWidth={1.75} />
              <span>Commit</span>
            </button>
            <button
              className="fab"
              onClick={() => setAddSheet({ editing: null })}
              aria-label="Add expense"
              disabled={storageError}
              aria-disabled={storageError}
            >
              ＋
            </button>
          </div>
        </nav>

        {/* Add / Edit Expense Sheet */}
        <AddSheet
          open={Boolean(addSheet)}
          editing={addSheet?.editing || null}
          currency={currency}
          storageFull={storageError}
          categories={state.settings.categories}
          suggestions={recentSuggestions}
          onAddCategory={addCategory}
          onClose={() => setAddSheet(null)}
          onSave={(payload, id, addAnother) => {
            if (id) updateDailyExpense(id, payload);
            else addDailyExpense(payload);
            if (!addAnother) setAddSheet(null);
          }}
        />

        {showSettings && (
          <SettingsSheet
            settings={state.settings}
            onSave={(patch) => {
              updateSettings(patch);
              setShowSettings(false);
            }}
            onExport={handleExport}
            onExportCSV={handleExportCSV}
            onImport={handleImport}
            onOpenAccount={cloud.available ? () => setShowAccount(true) : undefined}
            cloudEmail={cloud.email}
          />
        )}

        {showHistory && (
          <HistorySheet
            history={state.history}
            currency={currency}
            onClose={() => setShowHistory(false)}
          />
        )}

        {showAccount && (
          <AccountSheet
            cloud={cloud}
            onClose={() => setShowAccount(false)}
            onWipeLocal={handleWipeLocal}
            onReviewConflict={() => setShowConflictSheet(true)}
          />
        )}

        {showConflictSheet && cloud.conflict && (
          <ConflictSheet
            conflict={cloud.conflict}
            localState={state}
            lastSyncedAt={cloud.lastSyncedAt}
            onResolve={(choice) => {
              cloud.resolveConflict(choice);
              setShowConflictSheet(false);
            }}
            onClose={() => setShowConflictSheet(false)}
          />
        )}

        {undo && (
          <div
            className="fixed left-0 right-0 z-40 mx-auto max-w-md px-4"
            style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-700/60 bg-neutral-900/95 px-4 py-3 text-sm text-neutral-200 shadow-lg backdrop-blur">
              <span>{undo.label}</span>
              <button
                onClick={performUndo}
                className="shrink-0 font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Undo
              </button>
            </div>
          </div>
        )}

        {storageError && (
          <div className="fixed bottom-16 left-0 right-0 z-40 mx-auto max-w-md px-4">
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-red-800/60 bg-red-950/90 px-4 py-3 text-sm text-red-300 shadow-lg backdrop-blur"
            >
              <span>Storage full — adding new entries is paused. Export a backup or delete entries to continue.</span>
              <button
                onClick={handleExport}
                className="shrink-0 font-semibold text-red-200 hover:text-white"
              >
                Export backup
              </button>
            </div>
          </div>
        )}

        {updateReady && (
          <div
            className="fixed left-0 right-0 z-40 mx-auto max-w-md px-4"
            style={{ bottom: "calc(152px + env(safe-area-inset-bottom))" }}
          >
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-700/60 bg-neutral-900/95 px-4 py-3 text-sm text-neutral-200 shadow-lg backdrop-blur"
            >
              <span>New version ready</span>
              <button
                onClick={applyUpdate}
                className="shrink-0 font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Reload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
