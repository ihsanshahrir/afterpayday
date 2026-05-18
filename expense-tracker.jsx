import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Wallet,
  Plus,
  Trash2,
  Settings as SettingsIcon,
  X,
  Check,
  LayoutDashboard,
  ListChecks,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  AlertTriangle,
  Calendar,
  History,
  HelpCircle,
  TrendingDown,
  PlusCircle,
  CheckCircle,
  Receipt,
  CreditCard,
} from "lucide-react";
import { uid } from "./utils/id.js";
import { todayISO, currentMonthKey, isInCurrentMonth, isFixedPaidThisMonth, monthLabel } from "./utils/date.js";
import { formatMoney } from "./utils/money.js";

// ---------- storage ----------
const STORAGE_KEY = "expense-tracker:v1";

const defaultState = {
  settings: { salary: 0, currency: "RM" },
  fixedExpenses: [],
  debtGroups: [],
  dailyExpenses: [],
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : defaultState;
    const s = { ...defaultState, ...parsed, settings: { ...defaultState.settings, ...(parsed?.settings || {}) } };
    
    if (!s.history) s.history = [];
    if (!s.currentMonth) s.currentMonth = currentMonthKey(); // Start tracking from now

    return s;
  } catch {
    return { ...defaultState, currentMonth: currentMonthKey(), history: [] };
  }
};

const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — silent for now */
  }
};

// ---------- splash ----------
function SplashScreen({ onDone }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const t1 = setTimeout(() => setExiting(true), 750);
    const t2 = setTimeout(() => onDone(), 1150);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: '#0a0a0a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
      transform: exiting ? 'translateY(-100%)' : 'translateY(0)',
      transition: exiting ? 'transform 0.38s cubic-bezier(0.4,0,0.6,1)' : 'none',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        transform: visible ? 'scale(1)' : 'scale(0.55)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease',
      }}>
        <img src="/app-icon.png" alt="AfterPayday" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <span style={{
        color: '#10b981', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.08s, opacity 0.3s ease 0.08s',
        display: 'inline-block',
      }}>AfterPayday</span>
    </div>
  );
}

// ---------- onboarding ----------
const ONBOARDING_KEY = 'afterpayday-onboarding-done';

const ONBOARDING_SLIDES = [
  {
    Icon: Wallet,
    title: 'Welcome to AfterPayday',
    body: 'Know exactly what you can spend after bills and commitments — every single day.',
    color: '#10b981',
  },
  {
    Icon: TrendingDown,
    title: 'Your Safe to Spend',
    body: 'We subtract your fixed expenses and daily spending from your salary. What\'s left is yours to spend freely.',
    color: '#6366f1',
  },
  {
    Icon: ListChecks,
    title: 'Track Commitments',
    body: 'Add recurring bills and installment debts under Commitments. Mark them paid each month.',
    color: '#f59e0b',
  },
  {
    Icon: PlusCircle,
    title: 'Log Daily Expenses',
    body: 'Tap the add area on the Dashboard to record what you spend today. Your Safe to Spend updates instantly.',
    color: '#3b82f6',
  },
  {
    Icon: CheckCircle,
    title: "You're All Set",
    body: 'Start by setting your monthly salary in Settings. AfterPayday will take care of the rest.',
    color: '#10b981',
  },
];

function OnboardingSlides({ onDone }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const touchStartX = useRef(null);
  const total = ONBOARDING_SLIDES.length;
  const isLast = current === total - 1;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    onDone();
  }, [onDone]);

  const handleNext = () => {
    if (isLast) { handleDismiss(); return; }
    setCurrent(c => c + 1);
  };

  const handlePrev = () => {
    if (current > 0) setCurrent(c => c - 1);
  };

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (delta > 50) handleNext();
    else if (delta < -50) handlePrev();
  };

  const { Icon, title, body, color } = ONBOARDING_SLIDES[current];

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        userSelect: 'none',
      }}
    >
      {/* Skip */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'max(1.5rem, env(safe-area-inset-top)) 1.25rem 0' }}>
        <button
          onClick={handleDismiss}
          style={{ color: '#737373', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 2rem', gap: 28 }}>
        <div style={{
          width: 96, height: 96, borderRadius: 28,
          backgroundColor: color + '18',
          border: `1.5px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={44} style={{ color }} strokeWidth={1.5} />
        </div>

        <div style={{ textAlign: 'center', maxWidth: 280 }}>
          <div style={{ color: '#f5f5f5', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>
            {title}
          </div>
          <div style={{ color: '#737373', fontSize: 15.5, lineHeight: 1.6 }}>
            {body}
          </div>
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 24 }}>
        {ONBOARDING_SLIDES.map((_, i) => (
          <div
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: i === current ? 20 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === current ? '#10b981' : '#404040',
              transition: 'width 0.25s ease, background-color 0.25s ease',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `0 1.5rem max(1.5rem, env(safe-area-inset-bottom)) 1.5rem`,
        paddingBottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 1rem)',
      }}>
        <button
          onClick={handlePrev}
          style={{
            color: current === 0 ? 'transparent' : '#737373',
            background: 'none', border: 'none', cursor: current === 0 ? 'default' : 'pointer',
            fontSize: 14, padding: '8px 12px',
            pointerEvents: current === 0 ? 'none' : 'auto',
          }}
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          style={{
            backgroundColor: '#10b981', color: '#fff',
            border: 'none', borderRadius: 12, cursor: 'pointer',
            fontSize: 15, fontWeight: 600, padding: '12px 28px',
            letterSpacing: '-0.01em',
          }}
        >
          {isLast ? 'Get Started' : 'Next →'}
        </button>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Auto-snapshot logic for month rollover
  useEffect(() => {
    const nowMonth = currentMonthKey();
    if (state.currentMonth && state.currentMonth !== nowMonth) {
      const m = state.currentMonth;
      
      const s_salary = state.settings.salary || 0;
      const s_fixedTotal = state.fixedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      
      let s_installments = 0;
      state.debtGroups.forEach(g => {
        g.installments.forEach(i => {
          if (i.dueDate && i.dueDate.startsWith(m)) s_installments += Number(i.amount || 0);
        });
      });
      
      let s_dailySpent = 0;
      state.dailyExpenses.forEach(e => {
        if (e.date && e.date.startsWith(m)) s_dailySpent += Number(e.amount || 0);
      });

      const snapshot = {
        id: uid(),
        month: m,
        salary: s_salary,
        fixedTotal: s_fixedTotal,
        installments: s_installments,
        dailySpent: s_dailySpent,
        balance: s_salary - s_fixedTotal - s_installments - s_dailySpent
      };

      setState(s => ({
        ...s,
        currentMonth: nowMonth,
        history: [snapshot, ...(s.history || [])]
      }));
    }
  }, [state.currentMonth, state.settings.salary, state.fixedExpenses, state.debtGroups, state.dailyExpenses]);

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

// ---------- dashboard ----------
function Dashboard({
  currency,
  salary,
  fixedTotal,
  fixedGrandTotal,
  installmentsTotalThisMonth,
  installmentsUnpaidThisMonth,
  dailyThisMonth,
  safeToSpend,
  dailyExpenses,
  onAddDaily,
  onRemoveDaily,
}) {
  const [showAllMonth, setShowAllMonth] = useState(false);

  const today = todayISO();
  const todays = dailyExpenses.filter((e) => e.date === today);
  const monthly = dailyExpenses.filter((e) => isInCurrentMonth(e.date));
  const list = showAllMonth ? monthly : todays;

  const isNegative = safeToSpend < 0;

  return (
    <div className="px-5">
      {/* Safe to Spend hero */}
      <div
        className={`rounded-2xl border p-6 ${
          isNegative
            ? "border-rose-500/30 bg-rose-500/5"
            : "border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950"
        }`}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-neutral-500">
          {isNegative && <AlertTriangle size={12} className="text-rose-400" />}
          Safe to Spend
        </div>
        <div className={`mt-2 text-4xl font-semibold tracking-tight ${isNegative ? "text-rose-400" : "text-neutral-50"}`}>
          {formatMoney(safeToSpend, currency)}
        </div>
        <div className="mt-1 text-xs text-neutral-500">for the rest of {monthLabel()}</div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <BreakdownItem label="Salary" value={formatMoney(salary, currency)} tone="positive" />
          <BreakdownItem 
            label="Fixed" 
            value={`− ${formatMoney(fixedGrandTotal, currency)}`} 
            subText={fixedTotal === 0 && fixedGrandTotal > 0 ? "All paid" : fixedGrandTotal > 0 ? `${formatMoney(fixedTotal, currency)} unpaid` : null} 
          />
          <BreakdownItem 
            label="Installments" 
            value={`− ${formatMoney(installmentsTotalThisMonth, currency)}`} 
            subText={installmentsUnpaidThisMonth === 0 && installmentsTotalThisMonth > 0 ? "All paid" : installmentsTotalThisMonth > 0 ? `${formatMoney(installmentsUnpaidThisMonth, currency)} unpaid` : null} 
          />
          <BreakdownItem label="Daily spent" value={`− ${formatMoney(dailyThisMonth, currency)}`} />
        </div>
      </div>

      {/* Quick add */}
      <QuickAddDaily currency={currency} onAdd={onAddDaily} />

      {/* List */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-neutral-300">
            {showAllMonth ? "This month" : "Today"}
            <span className="ml-2 text-neutral-600 text-xs">{list.length}</span>
          </h2>
          <button
            onClick={() => setShowAllMonth((v) => !v)}
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            {showAllMonth ? "Show today" : "View this month"}
          </button>
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
            No expenses {showAllMonth ? "this month" : "today"} yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-xl border border-neutral-900 bg-neutral-900/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm text-neutral-200 truncate">{e.description || "Untitled"}</div>
                  <div className="text-[11px] text-neutral-500">{e.date}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-neutral-100">{formatMoney(e.amount, currency)}</div>
                  <button
                    onClick={() => onRemoveDaily(e.id)}
                    className="text-neutral-600 hover:text-rose-400"
                    aria-label="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BreakdownItem({ label, value, tone, subText }) {
  return (
    <div className="rounded-lg bg-neutral-900/60 border border-neutral-800/60 px-3 py-2 flex flex-col justify-center">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-sm font-medium ${tone === "positive" ? "text-emerald-400" : "text-neutral-200"}`}>
        {value}
      </div>
      {subText && <div className="text-[9px] mt-0.5 text-neutral-500">{subText}</div>}
    </div>
  );
}

// ---------- quick add ----------
function QuickAddDaily({ currency, onAdd }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  const submit = () => {
    const a = parseFloat(amount);
    if (!Number.isFinite(a) || a <= 0) return;
    onAdd(a, desc.trim());
    setAmount("");
    setDesc("");
  };

  return (
    <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-3">Quick add expense</div>

      {/* Row 1: Amount + Description */}
      <div className="flex gap-2 mb-2">
        <div className="relative w-36 flex-shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">{currency}</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <input
          type="text"
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* Row 2: Full-width Add button */}
      <button
        onClick={submit}
        className="w-full py-2.5 rounded-lg bg-emerald-500 text-neutral-950 font-medium text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 active:bg-emerald-600 transition-colors"
      >
        <Plus size={16} />
        Add Expense
      </button>
    </div>
  );
}

// ---------- commitments ----------
function Commitments({
  currency,
  fixedExpenses,
  fixedTotal,
  fixedGrandTotal,
  debtGroups,
  onAddFixed,
  onRemoveFixed,
  onToggleFixed,
  onAddDebtGroup,
  onRemoveDebtGroup,
  onToggleInstallment,
  onAddInstallment,
  onRemoveInstallment,
}) {
  return (
    <div className="px-5 pt-4 space-y-8">
      <FixedExpensesSection
        currency={currency}
        items={fixedExpenses}
        total={fixedGrandTotal}
        unpaidTotal={fixedTotal}
        onAdd={onAddFixed}
        onRemove={onRemoveFixed}
        onToggle={onToggleFixed}
      />
      <DebtSection
        currency={currency}
        groups={debtGroups}
        onAddGroup={onAddDebtGroup}
        onRemoveGroup={onRemoveDebtGroup}
        onToggle={onToggleInstallment}
        onAddInstallment={onAddInstallment}
        onRemoveInstallment={onRemoveInstallment}
      />
    </div>
  );
}

function FixedExpensesSection({ currency, items, total, unpaidTotal, onAdd, onRemove, onToggle }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [showAll, setShowAll] = useState(false);

  const paidCount = items.filter((e) => isFixedPaidThisMonth(e)).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? paidCount / totalCount : 0;

  const PREVIEW_COUNT = 4;
  const unpaidItems = items.filter((e) => !isFixedPaidThisMonth(e));
  const visibleItems = showAll ? items : unpaidItems.slice(0, PREVIEW_COUNT);
  const unpaidCount = totalCount - paidCount;
  const hiddenUnpaid = Math.max(0, unpaidCount - PREVIEW_COUNT);
  const hasMore = totalCount > PREVIEW_COUNT || paidCount > 0;
  const hiddenTotal = totalCount - visibleItems.length;

  const submit = () => {
    const a = parseFloat(amount);
    if (!name.trim() || !Number.isFinite(a) || a <= 0) return;
    onAdd(name.trim(), a);
    setName("");
    setAmount("");
    setAdding(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Receipt size={13} className="text-amber-400" />
          </div>
          <h2 className="text-base font-semibold text-neutral-200 tracking-tight">Fixed Monthly Expenses</h2>
          {totalCount > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700/50">
              {paidCount}/{totalCount}
            </span>
          )}
        </div>
        <button onClick={() => setAdding((v) => !v)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
          {adding ? <X size={14} /> : <Plus size={14} />}
          {adding ? "Cancel" : "Add"}
        </button>
      </div>

      {adding && (
        <div className="mb-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 space-y-2">
          <input
            type="text"
            placeholder="Name (e.g. Rent)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">{currency}</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <button onClick={submit} className="px-4 rounded-lg bg-emerald-500 text-neutral-950 text-sm font-medium hover:bg-emerald-400 transition-colors">
              Save
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-center flex flex-col items-center gap-2">
          <Receipt size={20} className="text-neutral-700" />
          <span className="text-sm text-neutral-500">No fixed expenses yet.</span>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="px-4 pt-3 pb-1">
              <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progress * 100}%`,
                    background: progress === 1
                      ? 'linear-gradient(90deg, #34d399, #10b981)'
                      : 'linear-gradient(90deg, #34d399, #6ee7b7)',
                  }}
                />
              </div>
            </div>
          )}

          <ul className="divide-y divide-neutral-800/70">
            {visibleItems.map((e) => {
              const isPaid = isFixedPaidThisMonth(e);
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => onToggle(e.id)}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isPaid
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-neutral-700 hover:border-neutral-500"
                    }`}
                    aria-label={isPaid ? "Mark unpaid" : "Mark paid"}
                  >
                    {isPaid && <Check size={12} className="text-neutral-950" strokeWidth={3} />}
                  </button>
                  <span className={`flex-1 text-sm ${isPaid ? "line-through text-neutral-600" : "text-neutral-200"}`}>
                    {e.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${isPaid ? "line-through text-neutral-600" : "text-neutral-100"}`}>
                      {formatMoney(e.amount, currency)}
                    </span>
                    <button onClick={() => onRemove(e.id)} className="text-neutral-600 hover:text-rose-400" aria-label="Remove">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full px-4 py-2 text-[11px] font-medium text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/30 transition-colors border-t border-neutral-800/70"
            >
              {showAll
                ? "Show less"
                : `Show ${hiddenTotal} more ${hiddenUnpaid > 0 ? `(${hiddenUnpaid} unpaid)` : ""}`}
            </button>
          )}

          <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/70 border-t border-neutral-800/70">
            <span className="text-xs uppercase tracking-widest text-neutral-500">Unpaid</span>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-emerald-400">{formatMoney(unpaidTotal, currency)}</span>
              <span className="text-[11px] text-neutral-600">/ {formatMoney(total, currency)}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DebtSection({ currency, groups, onAddGroup, onRemoveGroup, onToggle, onAddInstallment, onRemoveInstallment }) {
  const [creating, setCreating] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
            <CreditCard size={13} className="text-rose-400" />
          </div>
          <h2 className="text-base font-semibold text-neutral-200 tracking-tight">Installment Debt</h2>
        </div>
        <button onClick={() => setCreating((v) => !v)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
          {creating ? <X size={14} /> : <Plus size={14} />}
          {creating ? "Cancel" : "New group"}
        </button>
      </div>

      {creating && (
        <NewDebtGroupForm
          currency={currency}
          onCancel={() => setCreating(false)}
          onCreate={(group) => {
            onAddGroup(group);
            setCreating(false);
          }}
        />
      )}

      {groups.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-center flex flex-col items-center gap-2">
          <CreditCard size={20} className="text-neutral-700" />
          <span className="text-sm text-neutral-500">No debt groups yet.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <DebtGroupCard
              key={g.id}
              group={g}
              currency={currency}
              onRemoveGroup={() => onRemoveGroup(g.id)}
              onToggle={(instId) => onToggle(g.id, instId)}
              onAddInstallment={(inst) => onAddInstallment(g.id, inst)}
              onRemoveInstallment={(instId) => onRemoveInstallment(g.id, instId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NewDebtGroupForm({ currency, onCancel, onCreate }) {
  const [mode, setMode] = useState("auto"); // 'auto' | 'manual'
  const [name, setName] = useState("");
  // auto fields
  const [total, setTotal] = useState("");
  const [months, setMonths] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const submit = () => {
    if (!name.trim()) return;
    if (mode === "auto") {
      const t = parseFloat(total);
      const n = parseInt(months, 10);
      if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(n) || n <= 0) return;
      if (n > 600) {
        alert("Maximum allowed duration is 600 months (50 years).");
        return;
      }
      const per = +(t / n).toFixed(2);
      const [yy, mm, dd] = startDate.split("-").map(Number);
      const installments = Array.from({ length: n }, (_, i) => {
        const monthDate = new Date(yy, mm - 1 + i, 1);
        const yyyy = monthDate.getFullYear();
        const mIdx = monthDate.getMonth();
        const mmStr = String(mIdx + 1).padStart(2, "0");
        // Clamp day to the number of days in that month
        const maxD = new Date(yyyy, mIdx + 1, 0).getDate();
        const day = Math.min(dd, maxD);
        const ddStr = String(day).padStart(2, "0");
        return {
          id: uid(),
          label: `Month ${i + 1}`,
          amount: per,
          dueDate: `${yyyy}-${mmStr}-${ddStr}`,
          isPaid: false,
        };
      });
      onCreate({ id: uid(), name: name.trim(), installments });
    } else {
      // manual: create with empty installments — user adds them inside the card
      onCreate({ id: uid(), name: name.trim(), installments: [] });
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 space-y-3">
      <div className="flex gap-1 p-1 bg-neutral-950 rounded-lg border border-neutral-800">
        <button
          onClick={() => setMode("auto")}
          className={`flex-1 text-xs py-1.5 rounded ${mode === "auto" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500"}`}
        >
          Auto-generate
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 text-xs py-1.5 rounded ${mode === "manual" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500"}`}
        >
          Manual
        </button>
      </div>

      <input
        type="text"
        placeholder="Group name (e.g. Macbook Air M4)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
      />

      {mode === "auto" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">{currency}</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Total amount"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Months"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-neutral-500">Starting date</label>
            <div className="mt-1">
              <DatePickerField
                value={startDate}
                onChange={setStartDate}
              />
            </div>
          </div>
        </div>
      )}

      {mode === "manual" && (
        <p className="text-xs text-neutral-500">
          Create the group, then add each installment with custom amounts and due dates from inside the group card.
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-neutral-800 text-sm text-neutral-300 hover:bg-neutral-800/50">
          Cancel
        </button>
        <button onClick={submit} className="flex-1 py-2 rounded-lg bg-emerald-500 text-neutral-950 text-sm font-medium hover:bg-emerald-400">
          Create group
        </button>
      </div>
    </div>
  );
}

// ---------- iOS-style Date Picker ----------
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const daysInMonth = (month, year) => new Date(year, month, 0).getDate();

const CURRENCIES = [
  { code: "RM",  flag: "🇲🇾", name: "Malaysian Ringgit" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore Dollar" },
  { code: "USD", flag: "🇺🇸", name: "US Dollar" },
  { code: "GBP", flag: "🇬🇧", name: "British Pound" },
  { code: "EUR", flag: "🇪🇺", name: "Euro" },
];

// -- Month-only picker field (for "Starting month" in auto-generate) --
function MonthPickerField({ label, value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const [yy, mm] = value.split("-").map(Number);
  const displayText = `${MONTHS[mm - 1]} ${yy}`;

  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-neutral-500">{label}</label>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-neutral-950 border border-emerald-500/30 text-sm text-neutral-100 text-left flex items-center justify-between focus:outline-none focus:border-emerald-500/50 hover:bg-neutral-900 transition-colors"
      >
        <span>{displayText}</span>
        <Calendar size={14} className="text-neutral-500" />
      </button>
      {showPicker && (
        <DatePickerModal
          mode="month"
          initialDay={1}
          initialMonth={mm}
          initialYear={yy}
          onConfirm={(day, month, year) => {
            onChange(`${year}-${String(month).padStart(2, "0")}`);
            setShowPicker(false);
          }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// -- Full date picker field (for due dates) --
function DatePickerField({ label, value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const [yy, mm, dd] = value.split("-").map(Number);
  const displayText = `${dd} ${MONTHS_SHORT[mm - 1]} ${yy}`;

  return (
    <button
      type="button"
      onClick={() => setShowPicker(true)}
      className="flex-1 px-3 py-2 rounded-lg bg-neutral-950 border border-emerald-500/30 text-sm text-neutral-100 text-left flex items-center justify-between focus:outline-none focus:border-emerald-500/50 hover:bg-neutral-900 transition-colors"
    >
      <span>{displayText}</span>
      <Calendar size={14} className="text-neutral-500" />
      {showPicker && (
        <DatePickerModal
          mode="date"
          initialDay={dd}
          initialMonth={mm}
          initialYear={yy}
          onConfirm={(day, month, year) => {
            onChange(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
            setShowPicker(false);
          }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </button>
  );
}

// -- Unified picker modal (mode = 'month' | 'date') --
function DatePickerModal({ mode, initialDay, initialMonth, initialYear, onConfirm, onCancel }) {
  const [selectedDay, setSelectedDay] = useState(initialDay || 1);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [isClosing, setIsClosing] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 2 + i);

  // Clamp day when month/year changes
  const maxDay = daysInMonth(selectedMonth, selectedYear);
  useEffect(() => {
    if (selectedDay > maxDay) setSelectedDay(maxDay);
  }, [selectedMonth, selectedYear, maxDay, selectedDay]);

  const dayItems = Array.from({ length: maxDay }, (_, i) => String(i + 1));

  const close = (callback) => {
    setIsClosing(true);
    setTimeout(callback, 280);
  };

  const isDateMode = mode === "date";
  const title = isDateMode ? "Select Date" : "Select Month";

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
          <span className="text-sm font-medium text-neutral-200">{title}</span>
          <button
            onClick={() => close(() => onConfirm(selectedDay, selectedMonth, selectedYear))}
            className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Done
          </button>
        </div>

        {/* Picker wheels */}
        <div className="flex items-center justify-center px-4 pb-8 pt-2" style={{ height: 220 }}>
          {isDateMode && (
            <div style={{ width: 70, height: 180 }} className="relative">
              <WheelColumn
                key={`day-${maxDay}`}
                items={dayItems}
                selectedIndex={selectedDay - 1}
                onChange={(i) => setSelectedDay(i + 1)}
              />
            </div>
          )}
          <div className="flex-1 relative" style={{ height: 180 }}>
            <WheelColumn
              items={MONTHS}
              selectedIndex={selectedMonth - 1}
              onChange={(i) => setSelectedMonth(i + 1)}
            />
          </div>
          <div style={{ width: 100, height: 180 }} className="relative">
            <WheelColumn
              items={years.map(String)}
              selectedIndex={years.indexOf(selectedYear)}
              onChange={(i) => setSelectedYear(years[i])}
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

function WheelColumn({ items, selectedIndex, onChange }) {
  const ITEM_H = 40;
  const VISIBLE = 5;
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);
  const velocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const rafId = useRef(null);

  const scrollToIndex = useCallback((idx, smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    const top = idx * ITEM_H;
    el.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    scrollToIndex(selectedIndex, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapToNearest = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    scrollToIndex(clamped, true);
    onChange(clamped);
  }, [items.length, onChange, scrollToIndex]);

  const handlePointerDown = (e) => {
    isDragging.current = true;
    didDrag.current = false;
    startY.current = e.clientY;
    startScroll.current = containerRef.current?.scrollTop || 0;
    velocity.current = 0;
    lastY.current = e.clientY;
    lastTime.current = Date.now();
    if (rafId.current) cancelAnimationFrame(rafId.current);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const el = containerRef.current;
    if (!el) return;
    const dy = startY.current - e.clientY;
    
    // Only treat as drag if moved more than 3px
    if (Math.abs(dy) > 3) {
      didDrag.current = true;
    }
    
    el.scrollTop = startScroll.current + dy;

    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocity.current = (lastY.current - e.clientY) / dt;
    }
    lastY.current = e.clientY;
    lastTime.current = now;
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    // If it was just a tap (no drag), don't snap — let the click handler deal with it
    if (!didDrag.current) return;

    const el = containerRef.current;
    if (!el) return;

    // Apply momentum
    const v = velocity.current;
    if (Math.abs(v) > 0.3) {
      const momentum = v * 120;
      el.scrollTo({ top: el.scrollTop + momentum, behavior: 'smooth' });
      setTimeout(snapToNearest, 300);
    } else {
      snapToNearest();
    }
  };

  const handleItemClick = (idx) => {
    // Only handle click if no drag happened
    if (didDrag.current) return;
    scrollToIndex(idx, true);
    onChange(idx);
  };

  // Pad top/bottom so first/last can be centered
  const padItems = Math.floor(VISIBLE / 2);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ touchAction: 'none' }}>
      {/* Selection highlight band */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-10 rounded-lg"
        style={{
          top: padItems * ITEM_H,
          height: ITEM_H,
          background: 'rgba(255,255,255,0.06)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      />
      {/* Top fade */}
      <div
        className="absolute top-0 left-0 right-0 z-20 pointer-events-none"
        style={{
          height: padItems * ITEM_H,
          background: 'linear-gradient(180deg, rgba(28,28,28,0.95) 0%, transparent 100%)',
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
        style={{
          height: padItems * ITEM_H,
          background: 'linear-gradient(0deg, rgba(28,28,28,0.95) 0%, transparent 100%)',
        }}
      />
      {/* Scrollable area */}
      <div
        ref={containerRef}
        className="h-full overflow-hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {/* Top padding */}
        <div style={{ height: padItems * ITEM_H }} />
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={idx}
              onClick={() => handleItemClick(idx)}
              className="flex items-center justify-center cursor-pointer select-none transition-all duration-150"
              style={{
                height: ITEM_H,
                fontSize: isSelected ? 18 : 15,
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? '#f5f5f5' : 'rgba(163,163,163,0.5)',
                transform: isSelected ? 'scale(1.02)' : 'scale(0.98)',
              }}
            >
              {item}
            </div>
          );
        })}
        {/* Bottom padding */}
        <div style={{ height: padItems * ITEM_H }} />
      </div>
    </div>
  );
}

function DebtGroupCard({ group, currency, onRemoveGroup, onToggle, onAddInstallment, onRemoveInstallment }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [addingInst, setAddingInst] = useState(false);

  const totalCount = group.installments.length;
  const paidCount = group.installments.filter((i) => i.isPaid).length;
  const unpaidCount = totalCount - paidCount;
  const total = group.installments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const paid = group.installments.filter((i) => i.isPaid).reduce((s, i) => s + Number(i.amount || 0), 0);
  const remaining = total - paid;
  const progress = totalCount > 0 ? paidCount / totalCount : 0;

  // Smart collapse: show next 3 unpaid when collapsed
  const PREVIEW_COUNT = 3;
  const unpaidInstallments = group.installments.filter((i) => !i.isPaid);
  const visibleItems = showAll
    ? group.installments
    : unpaidInstallments.slice(0, PREVIEW_COUNT);
  const hiddenUnpaid = Math.max(0, unpaidCount - PREVIEW_COUNT);
  const hasMore = totalCount > PREVIEW_COUNT || paidCount > 0;
  const hiddenTotal = totalCount - visibleItems.length;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 min-w-0">
            {open ? <ChevronDown size={14} className="text-neutral-500" /> : <ChevronRight size={14} className="text-neutral-500" />}
            <span className="text-sm font-medium text-neutral-200 truncate">{group.name}</span>
          </button>
          <div className="flex items-center gap-3">
            {totalCount > 0 && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700/50">
                {paidCount}/{totalCount}
              </span>
            )}
            <span className="text-xs text-neutral-500">
              {formatMoney(remaining, currency)} <span className="text-neutral-700">left</span>
            </span>
            <button onClick={onRemoveGroup} className="text-neutral-600 hover:text-rose-400" aria-label="Remove group">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && open && (
          <div className="mt-2.5 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress * 100}%`,
                background: progress === 1
                  ? 'linear-gradient(90deg, #34d399, #10b981)'
                  : 'linear-gradient(90deg, #34d399, #6ee7b7)',
              }}
            />
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-neutral-800/70">
          {group.installments.length === 0 ? (
            <div className="px-4 py-4 text-xs text-neutral-500">No installments yet.</div>
          ) : (
            <>
              {/* Visible installments */}
              <ul className="divide-y divide-neutral-800/70">
                {visibleItems.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => onToggle(i.id)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                        i.isPaid
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-neutral-700 hover:border-neutral-500"
                      }`}
                      aria-label={i.isPaid ? "Mark unpaid" : "Mark paid"}
                    >
                      {i.isPaid && <Check size={12} className="text-neutral-950" strokeWidth={3} />}
                    </button>
                    <div className={`flex-1 min-w-0 ${i.isPaid ? "line-through text-neutral-600" : "text-neutral-200"}`}>
                      <div className="text-sm truncate">{i.label}</div>
                      <div className="text-[11px] text-neutral-500">{i.dueDate}</div>
                    </div>
                    <div className={`text-sm ${i.isPaid ? "line-through text-neutral-600" : "text-neutral-100"}`}>
                      {formatMoney(i.amount, currency)}
                    </div>
                    <button
                      onClick={() => onRemoveInstallment(i.id)}
                      className="text-neutral-700 hover:text-rose-400"
                      aria-label="Remove installment"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>

              {/* Show more / Show less toggle */}
              {hasMore && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full px-4 py-2 text-xs text-center border-t border-neutral-800/70 hover:bg-neutral-800/30 transition-colors"
                >
                  {showAll ? (
                    <span className="text-neutral-400">Show less</span>
                  ) : (
                    <span className="text-emerald-400">
                      Show all
                      <span className="text-neutral-500 ml-1.5">
                        ({hiddenTotal > 0 ? `${hiddenUnpaid > 0 ? `${hiddenUnpaid} unpaid` : ""}${hiddenUnpaid > 0 && paidCount > 0 ? ", " : ""}${paidCount > 0 ? `${paidCount} paid` : ""}` : `${paidCount} paid`})
                      </span>
                    </span>
                  )}
                </button>
              )}
            </>
          )}

          <div className="px-4 py-2.5 bg-neutral-950/40 border-t border-neutral-800/70 flex items-center justify-between">
            {addingInst ? (
              <ManualInstallmentForm
                currency={currency}
                onCancel={() => setAddingInst(false)}
                onAdd={(inst) => {
                  onAddInstallment(inst);
                  setAddingInst(false);
                }}
              />
            ) : (
              <>
                <button onClick={() => setAddingInst(true)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                  <Plus size={12} /> Add installment
                </button>
                <span className="text-xs text-neutral-500">
                  Total <span className="text-neutral-300">{formatMoney(total, currency)}</span>
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ManualInstallmentForm({ currency, onCancel, onAdd }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());

  const submit = () => {
    const a = parseFloat(amount);
    if (!label.trim() || !Number.isFinite(a) || a <= 0 || !dueDate) return;
    onAdd({ id: uid(), label: label.trim(), amount: a, dueDate, isPaid: false });
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
        />
        <div className="relative w-28">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">{currency}</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-10 pr-2 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <DatePickerField
          value={dueDate}
          onChange={setDueDate}
        />
        <button onClick={onCancel} className="px-3 rounded-lg border border-neutral-800 text-xs text-neutral-300">
          Cancel
        </button>
        <button onClick={submit} className="px-4 rounded-lg bg-emerald-500 text-neutral-950 text-sm font-medium hover:bg-emerald-400">
          Add
        </button>
      </div>
    </div>
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
