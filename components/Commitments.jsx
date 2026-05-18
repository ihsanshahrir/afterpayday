import { useState, useEffect } from "react";
import {
  Receipt, Plus, X, Check, Trash2, CreditCard,
  Calendar, ChevronDown, ChevronRight,
} from "lucide-react";
import WheelColumn from "./WheelColumn.jsx";
import { uid } from "../utils/id.js";
import { todayISO, isFixedPaidThisMonth, isInCurrentMonth } from "../utils/date.js";
import { formatMoney } from "../utils/money.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const daysInMonth = (month, year) => new Date(year, month, 0).getDate();

export default function Commitments({
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
  const [mode, setMode] = useState("auto");
  const [name, setName] = useState("");
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
              <DatePickerField value={startDate} onChange={setStartDate} />
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

function DatePickerModal({ mode, initialDay, initialMonth, initialYear, onConfirm, onCancel }) {
  const [selectedDay, setSelectedDay] = useState(initialDay || 1);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [isClosing, setIsClosing] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 2 + i);

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

  const PREVIEW_COUNT = 3;
  const unpaidInstallments = group.installments.filter((i) => !i.isPaid);
  const visibleItems = showAll ? group.installments : unpaidInstallments.slice(0, PREVIEW_COUNT);
  const hiddenUnpaid = Math.max(0, unpaidCount - PREVIEW_COUNT);
  const hasMore = totalCount > PREVIEW_COUNT || paidCount > 0;
  const hiddenTotal = totalCount - visibleItems.length;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
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
        <DatePickerField value={dueDate} onChange={setDueDate} />
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
