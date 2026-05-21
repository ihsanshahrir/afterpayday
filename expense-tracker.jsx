import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Settings as SettingsIcon,
  X,
  LayoutDashboard,
  ListChecks,
  History,
  HelpCircle,
} from "lucide-react";
import { uid } from "./utils/id.js";
import { todayISO, currentMonthKey, isInCurrentMonth, isFixedPaidThisMonth, monthLabel } from "./utils/date.js";
import { formatMoney } from "./utils/money.js";
import { loadState, saveState } from "./state/storage.js";
import SplashScreen from "./components/SplashScreen.jsx";
import OnboardingSlides, { ONBOARDING_KEY } from "./components/OnboardingSlides.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Commitments from "./components/Commitments.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import HistorySheet from "./components/HistorySheet.jsx";

const CHIPS = [
  { id: "food",  label: "☕ Food" },
  { id: "fuel",  label: "⛽ Fuel" },
  { id: "shop",  label: "🛍 Shop" },
  { id: "other", label: "• Other" },
];

function AddSheet({ open, currency, onClose, onSave }) {
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
  const valid = isFinite(a) && a > 0;

  const submit = () => {
    if (!valid) return;
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
          <button className="btn-primary" disabled={!valid} onClick={submit}>
            Save expense
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

  useEffect(() => {
    const ok = saveState(state);
    if (!ok) setStorageError(true);
  }, [state]);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  useEffect(() => {
    const checkRollover = () => {
      const s = stateRef.current;
      const nowMonth = currentMonthKey();
      if (!s.currentMonth || s.currentMonth === nowMonth) return;

      const m = s.currentMonth;
      const salary = s.settings.salary || 0;
      const fixedTotal = s.fixedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      let installments = 0;
      s.debtGroups.forEach(g => {
        g.installments.forEach(i => {
          if (i.dueDate && i.dueDate.startsWith(m)) installments += Number(i.amount || 0);
        });
      });

      let dailySpent = 0;
      s.dailyExpenses.forEach(e => {
        if (e.date && e.date.startsWith(m)) dailySpent += Number(e.amount || 0);
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

    checkRollover();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkRollover();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
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

  const dailyThisMonth = useMemo(
    () =>
      state.dailyExpenses
        .filter((e) => isInCurrentMonth(e.date))
        .reduce((s, e) => s + Number(e.amount || 0), 0),
    [state.dailyExpenses]
  );

  const safeToSpend =
    Number(state.settings.salary || 0) - fixedGrandTotal - installmentsTotalThisMonth - dailyThisMonth;

  // ---------- mutations ----------
  const updateSettings = (patch) =>
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const addFixedExpense = (name, amount) =>
    setState((s) => ({
      ...s,
      fixedExpenses: [...s.fixedExpenses, { id: uid(), name, amount: Number(amount), paidMonth: null }],
    }));

  const toggleFixedPaid = (id) =>
    setState((s) => ({
      ...s,
      fixedExpenses: s.fixedExpenses.map((e) =>
        e.id !== id
          ? e
          : { ...e, paidMonth: isFixedPaidThisMonth(e) ? null : currentMonthKey() }
      ),
    }));

  const removeFixedExpense = (id) =>
    setState((s) => ({ ...s, fixedExpenses: s.fixedExpenses.filter((e) => e.id !== id) }));

  const addDailyExpense = (amount, description, category = "other") =>
    setState((s) => ({
      ...s,
      dailyExpenses: [
        { id: uid(), amount: Number(amount), description, date: todayISO(), category },
        ...s.dailyExpenses,
      ],
    }));

  const removeDailyExpense = (id) =>
    setState((s) => ({ ...s, dailyExpenses: s.dailyExpenses.filter((e) => e.id !== id) }));

  const addDebtGroup = (group) =>
    setState((s) => ({ ...s, debtGroups: [...s.debtGroups, group] }));

  const removeDebtGroup = (id) =>
    setState((s) => ({ ...s, debtGroups: s.debtGroups.filter((g) => g.id !== id) }));

  const toggleInstallmentPaid = (groupId, instId) =>
    setState((s) => ({
      ...s,
      debtGroups: s.debtGroups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              installments: g.installments.map((i) =>
                i.id === instId ? { ...i, isPaid: !i.isPaid } : i
              ),
            }
      ),
    }));

  const addInstallmentToGroup = (groupId, installment) =>
    setState((s) => ({
      ...s,
      debtGroups: s.debtGroups.map((g) =>
        g.id !== groupId ? g : { ...g, installments: [...g.installments, installment] }
      ),
    }));

  const removeInstallment = (groupId, instId) =>
    setState((s) => ({
      ...s,
      debtGroups: s.debtGroups.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, installments: g.installments.filter((i) => i.id !== instId) }
      ),
    }));

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
        className="min-h-dvh antialiased overflow-x-hidden"
        style={{ background: "var(--bg-base)" }}
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
            paddingBottom: "calc(96px + env(safe-area-inset-bottom))",
          }}
        >
          {/* Header */}
          <header className="glass appheader" style={{ margin: "12px 14px 0" }}>
            <div className="av">
              <img src="/app-icon.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
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
              dailyThisMonth={dailyThisMonth}
              safeToSpend={safeToSpend}
              dailyExpenses={state.dailyExpenses}
              onRemoveDaily={removeDailyExpense}
            />
          ) : (
            <Commitments
              currency={currency}
              fixedExpenses={state.fixedExpenses}
              fixedTotal={fixedTotal}
              fixedGrandTotal={fixedGrandTotal}
              debtGroups={state.debtGroups}
              onAddFixed={addFixedExpense}
              onRemoveFixed={removeFixedExpense}
              onToggleFixed={toggleFixedPaid}
              onAddDebtGroup={addDebtGroup}
              onRemoveDebtGroup={removeDebtGroup}
              onToggleInstallment={toggleInstallmentPaid}
              onAddInstallment={addInstallmentToGroup}
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
            justifyContent: "center",
            paddingBottom: "env(safe-area-inset-bottom)",
            background: "linear-gradient(to bottom, transparent, var(--bg-base) 55%)",
          }}
        >
          <div
            className="glass tabbar"
            style={{
              width: "calc(100% - 28px)",
              maxWidth: 420,
              margin: "8px 0",
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
            >
              ＋
            </button>
          </div>
        </nav>

        {/* Add Expense Sheet */}
        <AddSheet
          open={showAddSheet}
          currency={currency}
          onClose={() => setShowAddSheet(false)}
          onSave={(amount, desc, cat) => {
            addDailyExpense(amount, desc, cat);
            setShowAddSheet(false);
          }}
        />

        {showSettings && (
          <SettingsSheet
            settings={state.settings}
            onClose={() => setShowSettings(false)}
            onSave={(patch) => {
              updateSettings(patch);
              setShowSettings(false);
            }}
          />
        )}

        {showHistory && (
          <HistorySheet
            history={state.history}
            currency={currency}
            onClose={() => setShowHistory(false)}
          />
        )}

        {storageError && (
          <div className="fixed bottom-16 left-0 right-0 z-40 mx-auto max-w-md px-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-red-800/60 bg-red-950/90 px-4 py-3 text-sm text-red-300 shadow-lg backdrop-blur">
              <span>Storage full — changes may not be saved. Free up space to continue.</span>
              <button
                onClick={() => setStorageError(false)}
                className="shrink-0 text-red-400 hover:text-red-200"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
