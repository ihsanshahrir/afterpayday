import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Settings as SettingsIcon,
  X,
  LayoutDashboard,
  ListChecks,
  ChevronDown,
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
import WheelColumn from "./components/WheelColumn.jsx";

// ---------- root ----------
export default function App() {
  const [showSplash] = useState(() => {
    if (sessionStorage.getItem('afterpayday-splash')) return false;
    sessionStorage.setItem('afterpayday-splash', '1');
    return true;
  });
  const [splashDone, setSplashDone] = useState(!showSplash);
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY));
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    const ok = saveState(state);
    if (!ok) setStorageError(true);
  }, [state]);

  // Auto-snapshot logic for month rollover.
  // Runs on mount and whenever the tab becomes visible (covers the user
  // returning to the app after midnight). Latest state is read via a ref
  // so the effect itself does not depend on every expense field.
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
      if (document.visibilityState === 'visible') checkRollover();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Prompt for salary on very first run (skip if onboarding is active — it will open settings on completion)
  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY) && state.settings.salary === 0 && state.fixedExpenses.length === 0 && state.debtGroups.length === 0 && state.dailyExpenses.length === 0) {
      return; // new user: let onboarding run first
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

  const addDailyExpense = (amount, description) =>
    setState((s) => ({
      ...s,
      dailyExpenses: [
        { id: uid(), amount: Number(amount), description, date: todayISO() },
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
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 antialiased overflow-x-hidden" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <div className="max-w-md mx-auto pb-24">
        {/* Header */}
        <header className="px-5 pb-4 flex items-center justify-between" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center overflow-hidden">
              <img src="/app-icon.png" alt="App Icon" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-600">AfterPayday</div>
              <div className="text-base font-semibold text-emerald-400">{monthLabel()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOnboarding(true)}
              className="w-9 h-9 rounded-lg border border-neutral-800 bg-neutral-900/50 flex items-center justify-center hover:bg-neutral-800 transition-colors"
              aria-label="Help"
            >
              <HelpCircle size={16} className="text-neutral-400" />
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="w-9 h-9 rounded-lg border border-neutral-800 bg-neutral-900/50 flex items-center justify-center hover:bg-neutral-800 transition-colors"
              aria-label="History"
            >
              <History size={16} className="text-neutral-400" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 rounded-lg border border-neutral-800 bg-neutral-900/50 flex items-center justify-center hover:bg-neutral-800 transition-colors"
              aria-label="Settings"
            >
              <SettingsIcon size={16} className="text-neutral-400" />
            </button>
          </div>
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
            onAddDaily={addDailyExpense}
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

        {/* Tab bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-900 bg-neutral-950 backdrop-blur">
          <div className="max-w-md mx-auto grid grid-cols-2">
            <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={LayoutDashboard} label="Dashboard" />
            <TabButton active={tab === "commitments"} onClick={() => setTab("commitments")} icon={ListChecks} label="Commitments" />
          </div>
        </nav>

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
    </div>
    </>
  );
}

// ---------- tab button ----------
function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 transition-colors ${
        active ? "text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      <Icon size={18} />
      <span className="text-[11px] tracking-wide">{label}</span>
    </button>
  );
}

// ---------- settings ----------
function SettingsSheet({ settings, onClose, onSave }) {
  const [salary, setSalary] = useState(String(settings.salary || ""));
  const [currency, setCurrency] = useState(settings.currency || "RM");
  const [isClosing, setIsClosing] = useState(false);

  const close = (callback) => {
    setIsClosing(true);
    setTimeout(callback, 280);
  };

  const save = () => {
    const s = parseFloat(salary);
    close(() => onSave({
      salary: Number.isFinite(s) && s >= 0 ? s : 0,
      currency: currency.trim() || "RM",
    }));
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      style={{ animation: `${isClosing ? 'iosPickerFadeOut' : 'iosPickerFadeIn'} 0.28s ease forwards` }}
      onClick={() => close(onClose)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-t-2xl border-t border-neutral-700/50 bg-neutral-950 p-5"
        style={{
          animation: `${isClosing ? 'iosPickerSlideDown' : 'iosPickerSlideUp'} 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-neutral-500">Settings</div>
            <div className="text-base font-medium text-neutral-100">Income & currency</div>
          </div>
          <button onClick={() => close(onClose)} className="w-8 h-8 rounded-lg border border-neutral-800 flex items-center justify-center text-neutral-400 hover:bg-neutral-900">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-neutral-500">Monthly salary</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">{currency}</span>
              <input
                type="number"
                inputMode="decimal"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-neutral-500">Currency</label>
            <CurrencyPickerField value={currency} onChange={setCurrency} />
          </div>
        </div>

        <button
          onClick={save}
          className="mt-6 w-full py-3 rounded-lg bg-emerald-500 text-neutral-950 font-medium hover:bg-emerald-400"
        >
          Save
        </button>

        <style>{`
          @keyframes iosPickerFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes iosPickerFadeOut { from { opacity: 1 } to { opacity: 0 } }
          @keyframes iosPickerSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
          @keyframes iosPickerSlideDown { from { transform: translateY(0) } to { transform: translateY(100%) } }
        `}</style>
      </div>
    </div>
  );
}

// ---------- Currency Picker ----------
function CurrencyPickerField({ value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const curr = CURRENCIES.find((c) => c.code === value) || CURRENCIES[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="mt-1 w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-emerald-500/30 text-sm text-neutral-100 text-left flex items-center justify-between focus:outline-none hover:bg-neutral-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{curr.flag}</span>
          <span>{curr.code}</span>
          <span className="text-neutral-500">— {curr.name}</span>
        </span>
        <ChevronDown size={14} className="text-neutral-500" />
      </button>
      {showPicker && (
        <CurrencyPickerModal
          initialCode={value}
          onConfirm={(code) => {
            onChange(code);
            setShowPicker(false);
          }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

function CurrencyPickerModal({ initialCode, onConfirm, onCancel }) {
  const initialIdx = Math.max(0, CURRENCIES.findIndex((c) => c.code === initialCode));
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [isClosing, setIsClosing] = useState(false);

  const close = (callback) => {
    setIsClosing(true);
    setTimeout(callback, 280);
  };

  const displayItems = CURRENCIES.map((c) => `${c.flag}  ${c.code} — ${c.name}`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ animation: `${isClosing ? 'iosPickerFadeOut' : 'iosPickerFadeIn'} 0.28s ease forwards` }}
      onClick={(e) => { e.stopPropagation(); close(onCancel); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-t-2xl border-t border-neutral-700/50 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(38,38,38,0.98) 0%, rgba(23,23,23,0.99) 100%)',
          animation: `${isClosing ? 'iosPickerSlideDown' : 'iosPickerSlideUp'} 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button
            onClick={() => close(onCancel)}
            className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <span className="text-sm font-medium text-neutral-200">Select Currency</span>
          <button
            onClick={() => close(() => onConfirm(CURRENCIES[selectedIdx].code))}
            className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Done
          </button>
        </div>

        {/* Picker wheel */}
        <div className="flex items-center justify-center px-4 pb-8 pt-2" style={{ height: 220 }}>
          <div className="flex-1 relative" style={{ height: 180 }}>
            <WheelColumn
              items={displayItems}
              selectedIndex={selectedIdx}
              onChange={setSelectedIdx}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes iosPickerFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes iosPickerFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes iosPickerSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes iosPickerSlideDown { from { transform: translateY(0) } to { transform: translateY(100%) } }
      `}</style>
    </div>
  );
}

// ---------- History ----------
function HistorySheet({ history, currency, onClose }) {
  const [isClosing, setIsClosing] = useState(false);

  const close = () => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ animation: `${isClosing ? 'iosPickerFadeOut' : 'iosPickerFadeIn'} 0.28s ease forwards` }}
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-t-2xl border-t border-neutral-700/50"
        style={{
          background: 'linear-gradient(180deg, rgba(38,38,38,0.98) 0%, rgba(23,23,23,0.99) 100%)',
          animation: `${isClosing ? 'iosPickerSlideDown' : 'iosPickerSlideUp'} 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching iOS style */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-700/50 shrink-0">
          <div className="w-12"></div>
          <span className="text-sm font-medium text-neutral-200">Monthly History</span>
          <button
            onClick={close}
            className="w-12 text-right text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Done
          </button>
        </div>

      <style>{`
        @keyframes iosPickerFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes iosPickerFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes iosPickerSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes iosPickerSlideDown { from { transform: translateY(0) } to { transform: translateY(100%) } }
      `}</style>

        <div className="p-5 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {(!history || history.length === 0) ? (
            <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">
              No earlier history.
              <div className="mt-1 text-xs text-neutral-600">Snapshots are taken automatically at the start of a new month.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((h) => {
                const totalSpent = h.fixedTotal + h.installments + h.dailySpent;
                const progress = h.salary > 0 ? Math.min(1, totalSpent / h.salary) : 0;
                const isPositive = h.balance >= 0;
                
                // Parse "2026-04" -> "April 2026"
                const [yy, mm] = h.month.split('-');
                const monthStr = new Date(yy, mm - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });

                return (
                  <div key={h.id} className="rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-neutral-200">{monthStr}</span>
                      <div className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : '−'} {formatMoney(Math.abs(h.balance), currency)}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                      <span>Salary <span className="text-neutral-300">{formatMoney(h.salary, currency)}</span></span>
                      <span>Spent <span className="text-neutral-300">{formatMoney(totalSpent, currency)}</span></span>
                    </div>

                    <div className="h-1.5 rounded-full bg-neutral-900 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${progress * 100}%`,
                          background: progress >= 1
                            ? 'linear-gradient(90deg, #f43f5e, #e11d48)'
                            : 'linear-gradient(90deg, #38bdf8, #818cf8)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
