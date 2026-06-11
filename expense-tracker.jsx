import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Settings as SettingsIcon,
  LayoutDashboard,
  ListChecks,
  History,
  HelpCircle,
} from "lucide-react";
import { uid } from "./utils/id.js";
import { todayISO, currentMonthKey, isInCurrentMonth, isBeforeCurrentMonth, isFixedPaidThisMonth, monthLabel } from "./utils/date.js";
import { loadState, saveState } from "./state/storage.js";
import SplashScreen from "./components/SplashScreen.jsx";
import OnboardingSlides, { ONBOARDING_KEY } from "./components/OnboardingSlides.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Commitments from "./components/Commitments.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import HistorySheet from "./components/HistorySheet.jsx";

const CHIPS = [
  { id: "food",   label: "☕ Food" },
  { id: "fuel",   label: "⛽ Fuel" },
  { id: "shop",   label: "🛍 Shop" },
  { id: "other",  label: "• Other" },
  { id: "refund", label: "↺ Refund" },
];

function AddSheet({ open, currency, storageFull, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("food");
  const amtRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => amtRef.current && amtRef.current.focus(), 280);
    } else {
      setAmount("");
      setDesc("");
      setCat("food");
    }
  }, [open]);

  const a = parseFloat(amount);
  const valid = Number.isFinite(a) && a > 0;

  const submit = () => {
    if (!valid || storageFull) return;
    onSave(a, desc.trim(), cat);
  };

  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} />
      <div
        className={`sheet${open ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div className="grab" />
        <div className="stitle" id="sheet-title">Add to <b>today</b></div>
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
          placeholder="What did you spend on?"
          aria-label="Expense description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <div className="chips">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              className={cat === c.id ? "on" : ""}
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid || storageFull} onClick={submit}>
            {cat === "refund" ? "Save refund" : "Save expense"}
          </button>
        </div>
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
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY));
  const [storageError, setStorageError] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [undo, setUndo] = useState(null); // { snapshot, label } | null
  const undoTimerRef = useRef(null);

  useEffect(() => {
    navigator.storage?.persist?.();
  }, []);

  useEffect(() => {
    const ok = saveState(state);
    setStorageError(!ok);
  }, [state]);

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
      if (!s.currentMonth || s.currentMonth === nowMonth) return;

      const m = s.currentMonth;
      const salary = s.settings.salary || 0;
      // Snapshot the month as actually spent — only count fixed expenses and
      // installments the user marked paid. Unpaid amounts roll forward as
      // overdue rather than retroactively reducing the closed month's balance.
      const fixedTotal = s.fixedExpenses
        .filter((e) => e.paidMonth === m)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      let installments = 0;
      s.debtGroups.forEach(g => {
        g.installments.forEach(i => {
          if (i.dueDate && i.dueDate.startsWith(m) && i.isPaid) {
            installments += Number(i.amount || 0);
          }
        });
      });

      let dailySpent = 0;
      s.dailyExpenses.forEach(e => {
        if (e.date && e.date.startsWith(m)) {
          dailySpent += e.kind === "refund" ? -Number(e.amount || 0) : Number(e.amount || 0);
        }
      });

      const snapshot = {
        id: uid(),
        month: m,
        salary,
        fixedTotal,
        installments,
        dailySpent,
        balance: salary - fixedTotal - installments - dailySpent,
      };

      setState(prev => ({
        ...prev,
        currentMonth: nowMonth,
        history: [snapshot, ...(prev.history || [])],
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

  // ---------- derived totals ----------
  const fixedTotal = useMemo(
    () => state.fixedExpenses
      .filter((e) => !isFixedPaidThisMonth(e))
      .reduce((s, e) => s + Number(e.amount || 0), 0),
    [state.fixedExpenses]
  );

  const fixedGrandTotal = useMemo(
    () => state.fixedExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [state.fixedExpenses]
  );

  const installmentsTotalThisMonth = useMemo(() => {
    let total = 0;
    state.debtGroups.forEach((g) => {
      g.installments.forEach((i) => {
        if (isInCurrentMonth(i.dueDate)) total += Number(i.amount || 0);
      });
    });
    return total;
  }, [state.debtGroups]);

  const installmentsUnpaidThisMonth = useMemo(() => {
    let total = 0;
    state.debtGroups.forEach((g) => {
      g.installments.forEach((i) => {
        if (isInCurrentMonth(i.dueDate) && !i.isPaid) total += Number(i.amount || 0);
      });
    });
    return total;
  }, [state.debtGroups]);

  // Unpaid installments whose due date is in a month before this one. They're
  // still owed, so they must reduce safe-to-spend and be surfaced — otherwise
  // overdue debt silently vanishes from every headline figure.
  const installmentsOverdueUnpaid = useMemo(() => {
    let total = 0;
    state.debtGroups.forEach((g) => {
      g.installments.forEach((i) => {
        if (isBeforeCurrentMonth(i.dueDate) && !i.isPaid) total += Number(i.amount || 0);
      });
    });
    return total;
  }, [state.debtGroups]);

  // Overdue installments that were caught up *this* month. The cash left the
  // account now, so they must keep reducing this month's safe-to-spend —
  // without this, marking an overdue installment paid would make safe-to-spend
  // jump up by the amount just paid. They age out automatically next month
  // because paidMonth no longer matches. (Mirrors how fixed expenses use
  // paidMonth.) Installments paid before this feature lack paidMonth and are
  // treated as already settled in a prior month.
  const installmentsOverduePaidThisMonth = useMemo(() => {
    const month = currentMonthKey();
    let total = 0;
    state.debtGroups.forEach((g) => {
      g.installments.forEach((i) => {
        if (isBeforeCurrentMonth(i.dueDate) && i.isPaid && i.paidMonth === month) {
          total += Number(i.amount || 0);
        }
      });
    });
    return total;
  }, [state.debtGroups]);

  const fixedPaidThisMonth = useMemo(
    () => state.fixedExpenses
      .filter((e) => isFixedPaidThisMonth(e))
      .reduce((s, e) => s + Number(e.amount || 0), 0),
    [state.fixedExpenses]
  );

  const installmentsPaidThisMonth = useMemo(() => {
    let total = 0;
    state.debtGroups.forEach((g) => {
      g.installments.forEach((i) => {
        if (isInCurrentMonth(i.dueDate) && i.isPaid) total += Number(i.amount || 0);
      });
    });
    return total;
  }, [state.debtGroups]);

  const dailyThisMonth = useMemo(
    () =>
      state.dailyExpenses
        .filter((e) => isInCurrentMonth(e.date))
        .reduce(
          (s, e) => s + (e.kind === "refund" ? -Number(e.amount || 0) : Number(e.amount || 0)),
          0
        ),
    [state.dailyExpenses]
  );

  // Overdue still owed (unpaid) plus overdue caught up this month both leave —
  // or will leave — this month's money, so both reduce safe-to-spend.
  const installmentsOverdueOwed = installmentsOverdueUnpaid + installmentsOverduePaidThisMonth;

  const safeToSpend =
    Number(state.settings.salary || 0) - fixedGrandTotal - installmentsTotalThisMonth - installmentsOverdueOwed - dailyThisMonth;

  // "Spent" reflects money that has actually left the account: paid fixed bills,
  // paid installments, and daily expenses. Unpaid commitments still affect the
  // forward-looking `safeToSpend` but should not inflate the progress bar.
  const spentThisMonth = fixedPaidThisMonth + installmentsPaidThisMonth + dailyThisMonth;

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

  const addDailyExpense = (amount, description, category = "other") => {
    if (storageError) return;
    // Amounts are always stored positive; `kind` records direction. A refund
    // is money coming back in, so it lifts safe-to-spend.
    setState((s) => ({
      ...s,
      dailyExpenses: [
        {
          id: uid(),
          amount: Number(amount),
          description,
          date: todayISO(),
          category,
          kind: category === "refund" ? "refund" : "expense",
        },
        ...s.dailyExpenses,
      ],
    }));
  };

  const removeDailyExpense = (id) => {
    requestUndo("Expense deleted");
    setState((s) => ({ ...s, dailyExpenses: s.dailyExpenses.filter((e) => e.id !== id) }));
  };

  const addDebtGroup = (group) => {
    if (storageError) return;
    setState((s) => ({ ...s, debtGroups: [...s.debtGroups, group] }));
  };

  const removeDebtGroup = (id) => {
    requestUndo("Debt group deleted");
    setState((s) => ({ ...s, debtGroups: s.debtGroups.filter((g) => g.id !== id) }));
  };

  const toggleInstallmentPaid = (groupId, instId) =>
    setState((s) => ({
      ...s,
      debtGroups: s.debtGroups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              installments: g.installments.map((i) =>
                i.id === instId
                  ? { ...i, isPaid: !i.isPaid, paidMonth: i.isPaid ? null : currentMonthKey() }
                  : i
              ),
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
    <>
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
              fixedGrandTotal={fixedGrandTotal}
              installmentsTotalThisMonth={installmentsTotalThisMonth}
              installmentsUnpaidThisMonth={installmentsUnpaidThisMonth}
              installmentsOverdueUnpaid={installmentsOverdueUnpaid}
              spentThisMonth={spentThisMonth}
              safeToSpend={safeToSpend}
              dailyExpenses={state.dailyExpenses}
              onRemoveDaily={removeDailyExpense}
            />
          ) : (
            <Commitments
              currency={currency}
              storageFull={storageError}
              fixedExpenses={state.fixedExpenses}
              fixedTotal={fixedTotal}
              fixedGrandTotal={fixedGrandTotal}
              debtGroups={state.debtGroups}
              onAddFixed={addFixedExpense}
              onEditFixed={editFixedExpense}
              onRemoveFixed={removeFixedExpense}
              onToggleFixed={toggleFixedPaid}
              onAddDebtGroup={addDebtGroup}
              onRemoveDebtGroup={removeDebtGroup}
              onToggleInstallment={toggleInstallmentPaid}
              onAddInstallment={addInstallmentToGroup}
              onEditInstallment={editInstallment}
              onRemoveInstallment={removeInstallment}
            />
          )}
        </div>

        {/* Floating tab bar */}
        <nav
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
          >
            <button
              className={tab === "dashboard" ? "active" : ""}
              onClick={() => setTab("dashboard")}
            >
              <LayoutDashboard size={18} strokeWidth={1.75} />
              <span>Today</span>
            </button>
            <button
              className={tab === "commitments" ? "active" : ""}
              onClick={() => setTab("commitments")}
            >
              <ListChecks size={18} strokeWidth={1.75} />
              <span>Commit</span>
            </button>
            <button
              className="fab"
              onClick={() => setShowAddSheet(true)}
              aria-label="Add expense"
              disabled={storageError}
              aria-disabled={storageError}
            >
              ＋
            </button>
          </div>
        </nav>

        {/* Add Expense Sheet */}
        <AddSheet
          open={showAddSheet}
          currency={currency}
          storageFull={storageError}
          onClose={() => setShowAddSheet(false)}
          onSave={(amount, desc, cat) => {
            addDailyExpense(amount, desc, cat);
            setShowAddSheet(false);
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
            onImport={handleImport}
          />
        )}

        {showHistory && (
          <HistorySheet
            history={state.history}
            currency={currency}
            onClose={() => setShowHistory(false)}
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
      </div>
    </>
  );
}
