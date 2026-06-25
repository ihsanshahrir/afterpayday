import { useState, useMemo } from "react";
import { Trash2, Eye, EyeOff, Search, SlidersHorizontal } from "lucide-react";
import { todayISO, isInCurrentMonth, currentMonthKey, fmtRelativeDay, fmtTime } from "../utils/date.js";
import { fmtNum, fmtCompact, MASK } from "../utils/money.js";
import { LOCALE } from "../utils/locale.js";
import { categoryMeta, mergeCategories } from "../utils/categories.js";
import { groupDailyByDay, filterDailyExpenses, isDailyFilterActive } from "../state/derive.js";
import SwapFade from "./SwapFade.jsx";

const SORTS = [
  { id: "date-desc", label: "Newest" },
  { id: "date-asc", label: "Oldest" },
  { id: "amount-desc", label: "Largest" },
  { id: "amount-asc", label: "Smallest" },
];

const DEFAULT_FILTER = { text: "", category: "all", kind: "all", sort: "date-desc" };

export default function Dashboard({
  currency,
  salary,
  fixedTotal,
  fixedGrandTotal,
  installmentsTotalThisMonth,
  installmentsUnpaidThisMonth,
  installmentsOverdueUnpaid = 0,
  spentThisMonth,
  safeToSpend,
  dailyExpenses,
  categories,
  onRemoveDaily,
  onEditDaily,
  amountsHidden,
  setAmountsHidden,
}) {
  const [showAllMonth, setShowAllMonth] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filter, setFilter] = useState(DEFAULT_FILTER);

  const monthKey = currentMonthKey();
  const today = todayISO();
  const todays = useMemo(
    () => dailyExpenses.filter((e) => e.date === today),
    [dailyExpenses, today]
  );
  const monthly = useMemo(
    () => dailyExpenses.filter((e) => isInCurrentMonth(e.date)),
    [dailyExpenses]
  );

  const filterActive = isDailyFilterActive(filter);
  const monthGroups = useMemo(
    () => groupDailyByDay(dailyExpenses, monthKey),
    [dailyExpenses, monthKey]
  );
  const filteredMonth = useMemo(
    () => (filterActive ? filterDailyExpenses(monthly, filter) : monthly),
    [filterActive, monthly, filter]
  );

  const catOptions = useMemo(() => mergeCategories(categories), [categories]);

  const isNegative = safeToSpend < 0;
  const total = salary;
  const spent = spentThisMonth;
  const pctUsed = total > 0 ? Math.max(0, Math.min(100, (spent / total) * 100)) : 0;
  const hasIncome = salary > 0;

  const [intRaw, centPart] = Math.abs(safeToSpend).toFixed(2).split(".");
  const intPart = Number(intRaw).toLocaleString(LOCALE);

  const setF = (patch) => setFilter((f) => ({ ...f, ...patch }));

  const listCount = showAllMonth ? monthly.length : todays.length;

  // One list row. The tap-zone (icon + text + amount) is a button that opens the
  // entry for editing; the trash button is a sibling so interactive elements
  // never nest. `subtitle` is context-dependent (time, category, or day).
  const Row = (e, subtitle) => {
    const isRefund = e.kind === "refund";
    const meta = categoryMeta(categories, e.category, e.kind);
    const label = e.description || meta.label;
    const amt = amountsHidden ? MASK : fmtNum(Math.abs(Number(e.amount)));
    return (
      <li key={e.id} className={`it ${isRefund ? "in" : "out"}`}>
        <button
          type="button"
          className="it-tap"
          onClick={() => onEditDaily(e)}
          aria-label={`Edit ${label}`}
        >
          <div className="ic" style={{ background: meta.bg, color: meta.color }} aria-hidden="true">
            {meta.icon}
          </div>
          <div className="text">
            <div className="d">{label}</div>
            <div className="t">{subtitle}</div>
          </div>
          <span className="v">{amt}</span>
        </button>
        <button
          className="x"
          aria-label={`Delete ${label}`}
          onClick={() => onRemoveDaily(e.id)}
        >
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      </li>
    );
  };

  // Today: show the time when we have it (newer entries), else the category.
  const todaySubtitle = (e) => fmtTime(e.createdAt) || categoryMeta(categories, e.category, e.kind).label;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
      {/* Hero */}
      <div className="glass hero" style={{ margin: "12px 14px 0" }}>
        <div className="lbl">
          <span className="live" aria-hidden="true" />
          Safe to spend · live
          <button
            type="button"
            className="eye"
            aria-label={amountsHidden ? "Show amounts" : "Hide amounts"}
            aria-pressed={!amountsHidden}
            onClick={() => setAmountsHidden((v) => !v)}
          >
            {amountsHidden ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
          </button>
        </div>
        <div className={`num${isNegative ? " neg" : ""}`}>
          <span className="sym">{currency}</span>
          {amountsHidden ? (
            MASK
          ) : (
            <>
              {intPart}
              <span className="c">.{centPart}</span>
            </>
          )}
        </div>
        <div className="sub">
          {!hasIncome ? (
            "Set your monthly income to start tracking"
          ) : amountsHidden ? (
            isNegative ? (
              <>{currency} {MASK} spent · over by <b>{currency} {MASK}</b></>
            ) : (
              <>{currency} {MASK} spent of <b>{currency} {MASK}</b> this month</>
            )
          ) : isNegative ? (
            <>{currency} {fmtNum(spent)} spent · over by <b>{currency} {fmtNum(Math.abs(safeToSpend))}</b></>
          ) : (
            <>{currency} {fmtNum(spent)} spent of <b>{currency} {fmtNum(total)}</b> this month</>
          )}
        </div>
        <div className="progress">
          <div className={`bar${isNegative ? " over" : ""}`} style={{ width: `${pctUsed}%` }} />
        </div>
        {hasIncome && (
          <div className="ticks">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const v = total * f;
              return <span key={f} className={v <= spent ? "reached" : ""}>{amountsHidden ? MASK : fmtCompact(v)}</span>;
            })}
          </div>
        )}
      </div>

      {/* Pods */}
      <div className="pods" style={{ margin: "0 14px" }}>
        <div className="glass pod">
          <div className="pl">
            <span className="dot" style={{ background: "var(--amber)" }} />
            Fixed
          </div>
          <div className="pv">
            <span className="pre">{currency}</span>
            {amountsHidden ? MASK : fmtNum(fixedGrandTotal)}
          </div>
          <div className="ps">
            {fixedTotal === 0 && fixedGrandTotal > 0
              ? "All paid"
              : fixedTotal > 0
                ? <><b>{currency} {amountsHidden ? MASK : fmtNum(fixedTotal)}</b> unpaid</>
                : "None set"}
          </div>
        </div>
        <div className="glass pod">
          <div className="pl">
            <span className="dot" style={{ background: "var(--pink)" }} />
            Debt
          </div>
          <div className="pv">
            <span className="pre">{currency}</span>
            {amountsHidden ? MASK : fmtNum(installmentsTotalThisMonth)}
          </div>
          <div className="ps">
            {installmentsUnpaidThisMonth === 0 && installmentsTotalThisMonth > 0
              ? "All paid"
              : installmentsUnpaidThisMonth > 0
                ? <><b>{currency} {amountsHidden ? MASK : fmtNum(installmentsUnpaidThisMonth)}</b> unpaid</>
                : "None this month"}
            {installmentsOverdueUnpaid > 0 && (
              <span className="overdue-note">
                {currency} {amountsHidden ? MASK : fmtNum(installmentsOverdueUnpaid)} overdue
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Today / Month list */}
      <div className="glass list" style={{ margin: "0 14px" }}>
        <div className="lh">
          <span className="t">
            {showAllMonth ? "This month" : "Today"}
            {listCount > 0 && <span className="count"> · {listCount}</span>}
          </span>
          <div className="lh-actions">
            {showAllMonth && (
              <button
                className={`filter-btn${showFilters || filterActive ? " on" : ""}`}
                aria-label="Filter and sort"
                aria-pressed={showFilters}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal size={15} strokeWidth={1.75} />
              </button>
            )}
            <button className="a" onClick={() => setShowAllMonth((v) => !v)}>
              {showAllMonth ? "Show today" : "This month →"}
            </button>
          </div>
        </div>

        <SwapFade swapKey={showAllMonth ? "month" : "today"}>
          {!showAllMonth ? (
            todays.length === 0 ? (
              <div className="empty">No expenses today yet.</div>
            ) : (
              <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {todays.map((e) => Row(e, todaySubtitle(e)))}
              </ul>
            )
          ) : (
            <div>
              {showFilters && (
                <div className="filter-bar">
                  <div className="filter-search">
                    <Search size={14} strokeWidth={1.75} aria-hidden="true" />
                    <input
                      value={filter.text}
                      onChange={(e) => setF({ text: e.target.value })}
                      placeholder="Search description, merchant, tags…"
                      aria-label="Search this month"
                    />
                  </div>
                  <div className="filter-row">
                    <select aria-label="Category" value={filter.category} onChange={(e) => setF({ category: e.target.value })}>
                      <option value="all">All categories</option>
                      {catOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <select aria-label="Type" value={filter.kind} onChange={(e) => setF({ kind: e.target.value })}>
                      <option value="all">Expenses & refunds</option>
                      <option value="expense">Expenses</option>
                      <option value="refund">Refunds</option>
                    </select>
                    <select aria-label="Sort" value={filter.sort} onChange={(e) => setF({ sort: e.target.value })}>
                      {SORTS.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  {filterActive && (
                    <button className="filter-clear" onClick={() => setFilter(DEFAULT_FILTER)}>
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {monthly.length === 0 ? (
                <div className="empty">No expenses this month yet.</div>
              ) : filterActive ? (
                filteredMonth.length === 0 ? (
                  <div className="empty">Nothing matches those filters.</div>
                ) : (
                  <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {filteredMonth.map((e) => Row(e, fmtRelativeDay(e.date)))}
                  </ul>
                )
              ) : (
                monthGroups.map((g) => (
                  <div key={g.date} className="day-group">
                    <div className="day-head">
                      <span className="day-label">{fmtRelativeDay(g.date)}</span>
                      <span className={`day-sub${g.subtotal < 0 ? " in" : ""}`}>
                        {amountsHidden ? MASK : `${g.subtotal < 0 ? "+" : ""}${fmtNum(Math.abs(g.subtotal))}`}
                      </span>
                    </div>
                    <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {g.items.map((e) => Row(e, fmtTime(e.createdAt) || categoryMeta(categories, e.category, e.kind).label))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}
        </SwapFade>
      </div>
    </div>
  );
}
