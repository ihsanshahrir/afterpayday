import { useState } from "react";
import { Trash2 } from "lucide-react";
import { todayISO, isInCurrentMonth, monthLabel } from "../utils/date.js";

const fmtNum = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  safeToSpend,
  dailyExpenses,
  onRemoveDaily,
}) {
  const [showAllMonth, setShowAllMonth] = useState(false);

  const today = todayISO();
  const todays = dailyExpenses.filter((e) => e.date === today);
  const monthly = dailyExpenses.filter((e) => isInCurrentMonth(e.date));
  const list = showAllMonth ? monthly : todays;

  const isNegative = safeToSpend < 0;
  const dayN = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const pct = Math.max(0, Math.min(100, (safeToSpend / Math.max(salary, 1)) * 100));
  const daysLeft = Math.max(daysInMonth - dayN + 1, 1);
  const perDay = safeToSpend / daysLeft;

  const [intRaw, centPart] = Math.abs(safeToSpend).toFixed(2).split(".");
  const intPart = Number(intRaw).toLocaleString("en-MY");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
      {/* Hero */}
      <div className="glass hero" style={{ margin: "12px 14px 0" }}>
        <div className="lbl">
          <span className="live" aria-hidden="true" />
          Safe to spend · live
        </div>
        <div className={`num${isNegative ? " neg" : ""}`}>
          <span className="sym">{currency}</span>
          {intPart}
          <span className="c">.{centPart}</span>
        </div>
        <div className="sub">
          {isNegative ? (
            <>Over budget for <b>{monthLabel()}</b></>
          ) : (
            <>Tracking <b>{currency} {fmtNum(perDay)}/day</b> through {monthLabel()}</>
          )}
        </div>
        <div className="progress">
          <div className="bar" style={{ width: `${pct}%` }} />
        </div>
        <div className="ticks">
          {[1, 7, 14, 21, 28, daysInMonth].map((n) => (
            <span key={n} className={n === dayN ? "now" : ""}>{n}</span>
          ))}
        </div>
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
        {list.length === 0 ? (
          <div className="empty">No expenses {showAllMonth ? "this month" : "today"} yet.</div>
        ) : (
          list.map((e) => {
            const cat = e.category || (Number(e.amount) < 0 ? "refund" : "other");
            const meta = CATEGORY_META[cat] || CATEGORY_META.other;
            const isRefund = Number(e.amount) < 0;
            return (
              <div key={e.id} className={`it ${isRefund ? "in" : "out"}`}>
                <div className="ic" style={{ background: meta.bg, color: meta.color }} aria-hidden="true">
                  {meta.icon}
                </div>
                <div className="text">
                  <div className="d">{e.description || "Untitled"}</div>
                  <div className="t">{e.date}</div>
                </div>
                <span className="v">{fmtNum(Math.abs(Number(e.amount)))}</span>
                <button className="x" aria-label="Remove" onClick={() => onRemoveDaily(e.id)}>
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
