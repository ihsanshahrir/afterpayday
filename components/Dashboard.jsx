import { useState } from "react";
import { Trash2, Eye, EyeOff } from "lucide-react";
import { todayISO, isInCurrentMonth } from "../utils/date.js";
import { fmtNum, fmtCompact, MASK } from "../utils/money.js";
import { LOCALE } from "../utils/locale.js";
import SwapFade from "./SwapFade.jsx";

const CATEGORY_META = {
  food:   { icon: "☕", bg: "rgba(252,211,77,0.18)",  color: "var(--amber)" },
  fuel:   { icon: "⛽", bg: "rgba(167,139,250,0.18)", color: "var(--violet)" },
  shop:   { icon: "🛍", bg: "rgba(249,168,212,0.18)", color: "var(--pink)" },
  refund: { icon: "↺",  bg: "rgba(52,211,153,0.18)",  color: "var(--emerald)" },
  other:  { icon: "•",  bg: "rgba(255,255,255,0.10)", color: "var(--fg-2)" },
};

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
  onRemoveDaily,
  amountsHidden,
  setAmountsHidden,
}) {
  const [showAllMonth, setShowAllMonth] = useState(false);

  const today = todayISO();
  const todays = dailyExpenses.filter((e) => e.date === today);
  const monthly = dailyExpenses.filter((e) => isInCurrentMonth(e.date));
  const list = showAllMonth ? monthly : todays;

  const isNegative = safeToSpend < 0;
  const total = salary;
  const spent = spentThisMonth;
  const pctUsed = total > 0 ? Math.max(0, Math.min(100, (spent / total) * 100)) : 0;
  const hasIncome = salary > 0;

  const [intRaw, centPart] = Math.abs(safeToSpend).toFixed(2).split(".");
  const intPart = Number(intRaw).toLocaleString(LOCALE);

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
            {fmtNum(fixedGrandTotal)}
          </div>
          <div className="ps">
            {fixedTotal === 0 && fixedGrandTotal > 0
              ? "All paid"
              : fixedTotal > 0
                ? <><b>{currency} {fmtNum(fixedTotal)}</b> unpaid</>
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
            {fmtNum(installmentsTotalThisMonth)}
          </div>
          <div className="ps">
            {installmentsUnpaidThisMonth === 0 && installmentsTotalThisMonth > 0
              ? "All paid"
              : installmentsUnpaidThisMonth > 0
                ? <><b>{currency} {fmtNum(installmentsUnpaidThisMonth)}</b> unpaid</>
                : "None this month"}
            {installmentsOverdueUnpaid > 0 && (
              <span className="overdue-note">
                {currency} {fmtNum(installmentsOverdueUnpaid)} overdue
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Today / Month list */}
      <div className="glass list" style={{ margin: "0 14px" }}>
        <div className="lh">
          <span className="t">{showAllMonth ? "This month" : "Today"}</span>
          <button className="a" onClick={() => setShowAllMonth((v) => !v)}>
            {showAllMonth ? "Show today" : "This month →"}
          </button>
        </div>
        <SwapFade swapKey={showAllMonth ? "month" : "today"}>
          {list.length === 0 ? (
            <div className="empty">No expenses {showAllMonth ? "this month" : "today"} yet.</div>
          ) : (
            <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {list.map((e) => {
                const isRefund = e.kind === "refund";
                const cat = e.category || (isRefund ? "refund" : "other");
                const meta = CATEGORY_META[cat] || CATEGORY_META.other;
                return (
                  <li key={e.id} className={`it ${isRefund ? "in" : "out"}`}>
                    <div className="ic" style={{ background: meta.bg, color: meta.color }} aria-hidden="true">
                      {meta.icon}
                    </div>
                    <div className="text">
                      <div className="d">{e.description || "Untitled"}</div>
                      <div className="t">{e.date}</div>
                    </div>
                    <span className="v">{fmtNum(Math.abs(Number(e.amount)))}</span>
                    <button
                      className="x"
                      aria-label={`Delete ${e.description || (isRefund ? "refund" : "expense")}`}
                      onClick={() => onRemoveDaily(e.id)}
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SwapFade>
      </div>
    </div>
  );
}
