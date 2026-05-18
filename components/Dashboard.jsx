import { useState } from "react";
import { AlertTriangle, Trash2, Plus } from "lucide-react";
import { todayISO, isInCurrentMonth, monthLabel } from "../utils/date.js";
import { formatMoney } from "../utils/money.js";

export default function Dashboard({
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
