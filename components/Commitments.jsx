import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Receipt, Plus, X, Check, Trash2, CreditCard,
  Calendar,
} from "lucide-react";
import WheelColumn from "./WheelColumn.jsx";
import RingProgress from "./RingProgress.jsx";
import Collapse from "./Collapse.jsx";
import { uid } from "../utils/id.js";
import { todayISO, isFixedPaidThisMonth, isInCurrentMonth, isOverdue, fmtDate, MONTHS_SHORT } from "../utils/date.js";
import { formatMoney } from "../utils/money.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingBottom: 8 }}>
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
  const paidTotal = Math.max(0, total - unpaidTotal);
  const allPaid = totalCount > 0 && paidCount === totalCount;

  const PREVIEW_COUNT = 4;
  const unpaidItems = items.filter((e) => !isFixedPaidThisMonth(e));
  const previewItems = unpaidItems.slice(0, PREVIEW_COUNT);
  const previewIds = new Set(previewItems.map((e) => e.id));
  const restItems = items.filter((e) => !previewIds.has(e.id));
  const hiddenTotal = restItems.length;
  const hiddenUnpaid = restItems.filter((e) => !isFixedPaidThisMonth(e)).length;
  const hasMore = restItems.length > 0;

  const renderFixedRow = (e) => {
    const isPaid = isFixedPaidThisMonth(e);
    return (
      <div key={e.id} className={`fx-row${isPaid ? " paid" : ""}`}>
        <button
          className={`check${isPaid ? " on" : ""}`}
          onClick={() => onToggle(e.id)}
          aria-label={isPaid ? "Mark unpaid" : "Mark paid"}
        >
          {isPaid && <Check size={12} style={{ color: "#06281d" }} strokeWidth={3} />}
        </button>
        <span className="name">{e.name}</span>
        {isPaid && <span className="tag">PAID</span>}
        <span className="amt">{formatMoney(e.amount, currency)}</span>
        <button
          className="row-x"
          onClick={() => onRemove(e.id)}
          aria-label="Remove"
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    );
  };

  const submit = () => {
    const a = parseFloat(amount);
    if (!name.trim() || !Number.isFinite(a) || a <= 0) return;
    onAdd(name.trim(), a);
    setName("");
    setAmount("");
    setAdding(false);
  };

  return (
    <div className="sect">
      <div className="head">
        <div className="chip amber"><Receipt size={15} strokeWidth={1.75} /></div>
        <h2>Fixed Monthly Expenses</h2>
        {totalCount > 0 && (
          <span className="badge">{paidCount}/{totalCount}</span>
        )}
        <button
          onClick={() => setAdding((v) => !v)}
          className={adding ? "cancel-add" : "add"}
          aria-label={adding ? "Cancel" : "Add expense"}
        >
          {adding ? <><X size={13} strokeWidth={1.75} /> Cancel</> : <><Plus size={13} strokeWidth={1.75} /> Add</>}
        </button>
      </div>

      <Collapse open={adding}>
        <div className="glass" style={{ padding: "14px", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Name (e.g. Rent)"
            aria-label="Expense name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input"
            style={{ marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", font: "500 14px var(--font)", pointerEvents: "none" }}>
                {currency}
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                aria-label={`Amount in ${currency}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="glass-input"
                style={{ paddingLeft: "3rem" }}
              />
            </div>
            <button onClick={submit} className="glass-btn-primary">Save</button>
          </div>
        </div>
      </Collapse>

      {items.length === 0 ? (
        <div className="glass" style={{ padding: "28px 20px", textAlign: "center" }}>
          <Receipt size={22} style={{ color: "var(--fg-4)", marginBottom: 8 }} />
          <div style={{ color: "var(--fg-3)", font: "500 13px var(--font)" }}>No fixed expenses yet.</div>
        </div>
      ) : (
        <div className="glass fixed-card">
          <div className="fc-head">
            <RingProgress
              value={progress}
              size={64}
              stroke={6}
              gradientId="ring-fixed"
              from="var(--amber)"
              to="var(--emerald)"
              label={`${paidCount}/${totalCount}`}
              sublabel="paid"
            />
            <div className="fc-stats">
              <div className="fc-stat">
                <span className="k">Paid</span>
                <span className="v paid">{formatMoney(paidTotal, currency)}</span>
              </div>
              <div className="fc-stat">
                <span className="k">Remaining</span>
                <span className="v">{formatMoney(unpaidTotal, currency)}</span>
              </div>
            </div>
          </div>

          {allPaid && (
            <div className="fc-done">
              <Check size={14} strokeWidth={2.5} /> All paid this month
            </div>
          )}

          {previewItems.map(renderFixedRow)}

          <Collapse open={showAll}>
            {restItems.map(renderFixedRow)}
          </Collapse>

          {hasMore && (
            <button
              className="show-more"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? "Show less"
                : `Show ${hiddenTotal} more${hiddenUnpaid > 0 ? ` (${hiddenUnpaid} unpaid)` : ""}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DebtSection({ currency, groups, onAddGroup, onRemoveGroup, onToggle, onAddInstallment, onRemoveInstallment }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="sect">
      <div className="head">
        <div className="chip pink"><CreditCard size={15} strokeWidth={1.75} /></div>
        <h2>Installment Debt</h2>
        <button
          onClick={() => setCreating((v) => !v)}
          className={creating ? "cancel-add" : "add"}
          aria-label={creating ? "Cancel" : "Add debt group"}
        >
          {creating ? <><X size={13} strokeWidth={1.75} /> Cancel</> : <><Plus size={13} strokeWidth={1.75} /> New group</>}
        </button>
      </div>

      <Collapse open={creating}>
        <NewDebtGroupForm
          currency={currency}
          onCancel={() => setCreating(false)}
          onCreate={(group) => {
            onAddGroup(group);
            setCreating(false);
          }}
        />
      </Collapse>

      {groups.length === 0 && !creating ? (
        <div className="glass" style={{ padding: "28px 20px", textAlign: "center" }}>
          <CreditCard size={22} style={{ color: "var(--fg-4)", marginBottom: 8 }} />
          <div style={{ color: "var(--fg-3)", font: "500 13px var(--font)" }}>No debt groups yet.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groups.length > 0 && <DebtSummary currency={currency} groups={groups} />}
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
    </div>
  );
}

function DebtSummary({ currency, groups }) {
  const all = groups.flatMap((g) => g.installments);
  const totalCount = all.length;
  if (totalCount === 0) return null;

  const paidCount = all.filter((i) => i.isPaid).length;
  const remaining = all
    .filter((i) => !i.isPaid)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const thisMonthDue = all
    .filter((i) => !i.isPaid && isInCurrentMonth(i.dueDate))
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const progress = paidCount / totalCount;

  return (
    <div className="glass debt-summary">
      <RingProgress
        value={progress}
        size={64}
        stroke={6}
        gradientId="ring-debt"
        from="var(--pink)"
        to="var(--violet)"
        label={`${Math.round(progress * 100)}%`}
        sublabel="paid"
      />
      <div className="ds-stats">
        <div className="ds-stat">
          <span className="k">Remaining</span>
          <span className="v">{formatMoney(remaining, currency)}</span>
        </div>
        <div className="ds-stat">
          <span className="k">Due this month</span>
          <span className="v due">{formatMoney(thisMonthDue, currency)}</span>
        </div>
      </div>
    </div>
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

  const previewT = parseFloat(total);
  const previewN = parseInt(months, 10);
  const showPreview =
    mode === "auto" &&
    Number.isFinite(previewT) && previewT > 0 &&
    Number.isFinite(previewN) && previewN > 0 && previewN <= 600;
  let previewText = null;
  if (showPreview) {
    const per = previewT / previewN;
    const [yy, mm] = startDate.split("-").map(Number);
    const end = new Date(yy, mm - 1 + (previewN - 1), 1);
    previewText = `${formatMoney(per, currency)} / month · ${previewN} month${previewN > 1 ? "s" : ""} · ends ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }

  return (
    <div className="glass" style={{ padding: "14px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="seg">
        <button className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>
          Auto-generate
        </button>
        <button className={mode === "manual" ? "on" : ""} onClick={() => setMode("manual")}>
          Manual
        </button>
      </div>

      <input
        type="text"
        placeholder="Group name (e.g. Macbook Air M4)"
        aria-label="Debt group name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="glass-input"
      />

      {mode === "auto" && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", font: "500 14px var(--font)", pointerEvents: "none" }}>
                {currency}
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Total amount"
                aria-label={`Total amount in ${currency}`}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="glass-input"
                style={{ paddingLeft: "3rem" }}
              />
            </div>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Months"
              aria-label="Number of months"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="glass-input"
              style={{ width: 104 }}
            />
          </div>
          <div>
            <label style={{ font: "500 10px var(--font)", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-3)" }}>
              Starting date
            </label>
            <div style={{ marginTop: 6 }}>
              <DatePickerField value={startDate} onChange={setStartDate} />
            </div>
          </div>
          {previewText && <div className="preview">{previewText}</div>}
        </>
      )}

      {mode === "manual" && (
        <p style={{ font: "500 12px var(--font)", color: "var(--fg-3)", margin: 0, lineHeight: 1.5 }}>
          Create the group, then add each installment with custom amounts and due dates.
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} className="glass-btn-secondary" style={{ flex: 1 }}>Cancel</button>
        <button onClick={submit} className="glass-btn-primary" style={{ flex: 1 }}>Confirm</button>
      </div>
    </div>
  );
}

function DatePickerField({ value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const [yy, mm, dd] = value.split("-").map(Number);
  const displayText = `${dd} ${MONTHS_SHORT[mm - 1]} ${yy}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        aria-label={`Selected date: ${displayText}. Tap to change.`}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 14px", borderRadius: 12,
          background: "var(--glass)", border: "1px solid rgba(52,211,153,0.35)",
          color: "var(--fg)", font: "500 14px var(--font)",
          transition: "border-color 150ms", cursor: "pointer",
        }}
      >
        <span>{displayText}</span>
        <Calendar size={14} style={{ color: "var(--fg-3)" }} strokeWidth={1.75} />
      </button>
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
    </div>
  );
}

function DatePickerModal({ mode, initialDay, initialMonth, initialYear, onConfirm, onCancel }) {
  const [selectedDay, setSelectedDay] = useState(initialDay || 1);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [isOpen, setIsOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 2 + i);

  const maxDay = daysInMonth(selectedMonth, selectedYear);
  useEffect(() => {
    if (selectedDay > maxDay) setSelectedDay(maxDay);
  }, [selectedMonth, selectedYear, maxDay, selectedDay]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const dayItems = Array.from({ length: maxDay }, (_, i) => String(i + 1));

  const confirm = () => {
    setIsOpen(false);
    setTimeout(() => onConfirm(selectedDay, selectedMonth, selectedYear), 400);
  };

  const cancel = () => {
    setIsOpen(false);
    setTimeout(onCancel, 400);
  };

  const isDateMode = mode === "date";
  const title = isDateMode ? "Select date" : "Select month";

  return createPortal(
    <>
      <div className={`scrim${isOpen ? " on" : ""}`} onClick={cancel} />
      <div
        className={`sheet${isOpen ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grab" />

        {/* title */}
        <p style={{ margin: "0 0 16px", font: "700 22px/1 var(--font)", letterSpacing: "-0.02em", color: "var(--fg)" }}>{title}</p>

        {/* wheel columns */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isDateMode ? "1fr 1.4fr 1fr" : "1fr",
          gap: 8,
          margin: "0 0 4px",
          position: "relative",
        }}>
          {/* center highlight band */}
          <div style={{
            position: "absolute", left: 0, right: 0,
            top: "50%", height: 44, transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.08)",
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)",
            zIndex: 0, pointerEvents: "none",
          }} />
          {isDateMode && (
            <div style={{ position: "relative", height: 200 }}>
              <WheelColumn key={`day-${maxDay}`} items={dayItems} selectedIndex={selectedDay - 1} onChange={(i) => setSelectedDay(i + 1)} />
            </div>
          )}
          <div style={{ position: "relative", height: 200 }}>
            <WheelColumn items={MONTHS} selectedIndex={selectedMonth - 1} onChange={(i) => setSelectedMonth(i + 1)} />
          </div>
          <div style={{ position: "relative", height: 200 }}>
            <WheelColumn items={years.map(String)} selectedIndex={years.indexOf(selectedYear)} onChange={(i) => setSelectedYear(years[i])} />
          </div>
        </div>

        {/* bottom actions */}
        <div className="sheet-actions">
          <button className="btn-secondary" onClick={cancel}>Cancel</button>
          <button className="btn-primary" onClick={confirm}>Confirm</button>
        </div>
      </div>
    </>,
    document.body
  );
}

function DebtGroupCard({ group, currency, onRemoveGroup, onToggle, onAddInstallment, onRemoveInstallment }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [addingInst, setAddingInst] = useState(false);

  const totalCount = group.installments.length;
  const paidCount = group.installments.filter((i) => i.isPaid).length;
  const unpaidCount = totalCount - paidCount;
  const total = group.installments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const remaining = group.installments
    .filter((i) => !i.isPaid)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const progress = totalCount > 0 ? paidCount / totalCount : 0;

  const thisMonthAmt = group.installments
    .filter((i) => isInCurrentMonth(i.dueDate))
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  const nextDue = group.installments
    .filter((i) => !i.isPaid && i.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const statusOf = (i) => {
    if (i.isPaid) return { cls: "paid", txt: "PAID" };
    if (isOverdue(i.dueDate)) return { cls: "over", txt: "OVERDUE" };
    if (isInCurrentMonth(i.dueDate)) return { cls: "due", txt: "DUE" };
    return null;
  };

  const PREVIEW_COUNT = 3;
  const unpaidInstallments = group.installments.filter((i) => !i.isPaid);
  const previewInst = unpaidInstallments.slice(0, PREVIEW_COUNT);
  const previewInstIds = new Set(previewInst.map((i) => i.id));
  const restInst = group.installments.filter((i) => !previewInstIds.has(i.id));
  const hiddenTotal = restInst.length;
  const hiddenUnpaid = restInst.filter((i) => !i.isPaid).length;
  const hasMore = restInst.length > 0;

  const renderInstRow = (i) => {
    const st = statusOf(i);
    const isNext = nextDue && i.id === nextDue.id;
    return (
      <div key={i.id} className={`inst-row${i.isPaid ? " paid" : ""}${isNext ? " next" : ""}`}>
        <button
          className={`check${i.isPaid ? " on" : ""}`}
          onClick={() => onToggle(i.id)}
          aria-label={i.isPaid ? "Mark unpaid" : "Mark paid"}
        >
          {i.isPaid && <Check size={11} style={{ color: "#06281d" }} strokeWidth={3} />}
        </button>
        <div className="info">
          <div className="il">{i.label}</div>
          <div className="id">{fmtDate(i.dueDate)}</div>
        </div>
        {st && <span className={`pill ${st.cls}`}>{st.txt}</span>}
        <span className="ia">{formatMoney(i.amount, currency)}</span>
        <button className="ix" onClick={() => onRemoveInstallment(i.id)} aria-label="Remove">
          <Trash2 size={12} strokeWidth={1.75} />
        </button>
      </div>
    );
  };

  return (
    <div className="glass debt-card">
      <div className="top">
        <span className="dot" style={{ background: "var(--pink)" }} />
        <span className="name">{group.name}</span>
        {thisMonthAmt > 0 && (
          <span className="pm">
            {formatMoney(thisMonthAmt, currency)}
            <span className="of">/mo</span>
          </span>
        )}
        <button className="trash-btn" onClick={onRemoveGroup} aria-label="Remove group">
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>

      {totalCount > 0 && (
        <>
          <div className="dprogress">
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="meta">
            <span>{paidCount}/{totalCount} · {formatMoney(remaining, currency)} left</span>
            {nextDue ? (
              <span className="due-chip">Next: {fmtDate(nextDue.dueDate)}</span>
            ) : (
              <span>{Math.round(progress * 100)}%</span>
            )}
          </div>
        </>
      )}

      <button className="expand-btn" onClick={() => setOpen((v) => !v)}>
        {open
          ? "Hide installments ↑"
          : totalCount === 0
            ? "Add installments ↓"
            : `Show installments${unpaidCount > 0 ? ` · ${unpaidCount} unpaid` : ""} ↓`}
      </button>

      <Collapse open={open}>
        <div className="installments">
          {group.installments.length === 0 ? (
            <div style={{ padding: "14px 0", color: "var(--fg-3)", font: "500 12px var(--font)" }}>
              No installments yet.
            </div>
          ) : (
            <>
              {previewInst.map(renderInstRow)}

              <Collapse open={showAll}>
                {restInst.map(renderInstRow)}
              </Collapse>

              {hasMore && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  style={{
                    width: "100%", padding: "8px 0", background: "none", border: 0,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    font: "500 11px var(--font)", color: "var(--fg-3)", textAlign: "center",
                    transition: "color 150ms", cursor: "pointer", marginTop: 2,
                  }}
                >
                  {showAll
                    ? "Show less"
                    : `Show all (${hiddenUnpaid > 0 ? `${hiddenUnpaid} unpaid` : `${paidCount} paid`})`}
                </button>
              )}
            </>
          )}

          <div className="inst-footer">
            <button className="add-inst" onClick={() => setAddingInst((v) => !v)}>
              <Plus size={12} strokeWidth={1.75} /> Add installment
            </button>
            <span className="total-lbl">
              Total <span>{formatMoney(total, currency)}</span>
            </span>
          </div>
          <Collapse open={addingInst}>
            <div style={{ paddingTop: 10 }}>
              <ManualInstallmentForm
                currency={currency}
                onCancel={() => setAddingInst(false)}
                onAdd={(inst) => {
                  onAddInstallment(inst);
                  setAddingInst(false);
                }}
              />
            </div>
          </Collapse>
        </div>
      </Collapse>
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
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Label"
          aria-label="Installment label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="glass-input"
          style={{ flex: 1 }}
        />
        <div style={{ position: "relative", width: 110 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", font: "500 13px var(--font)", pointerEvents: "none" }}>
            {currency}
          </span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            aria-label={`Amount in ${currency}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="glass-input"
            style={{ paddingLeft: "2.8rem" }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <DatePickerField value={dueDate} onChange={setDueDate} />
        </div>
        <button onClick={onCancel} className="glass-btn-secondary" style={{ padding: "0 14px" }}>Cancel</button>
        <button onClick={submit} className="glass-btn-primary" style={{ padding: "0 16px" }}>Add</button>
      </div>
    </div>
  );
}
