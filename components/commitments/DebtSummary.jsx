import RingProgress from "../RingProgress.jsx";
import StatPager from "../StatPager.jsx";
import { isInCurrentMonth, isBeforeCurrentMonth } from "../../utils/date.js";
import { maskMoney } from "../../utils/money.js";

export default function DebtSummary({ currency, groups, amountsHidden }) {
  const all = groups.flatMap((g) => g.installments);
  const totalCount = all.length;
  if (totalCount === 0) return null;

  const remaining = all
    .filter((i) => !i.isPaid)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const thisMonth = all.filter((i) => isInCurrentMonth(i.dueDate));
  const thisMonthPaid = thisMonth
    .filter((i) => i.isPaid)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const thisMonthDue = thisMonth
    .filter((i) => !i.isPaid)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const thisMonthTotal = thisMonthPaid + thisMonthDue;
  const monthProgress = thisMonthTotal > 0 ? thisMonthPaid / thisMonthTotal : 1;
  const overdue = all
    .filter((i) => !i.isPaid && isBeforeCurrentMonth(i.dueDate))
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const allCaughtUp = thisMonthDue === 0 && overdue === 0;

  return (
    <div className="glass debt-summary">
      <RingProgress
        value={monthProgress}
        size={76}
        stroke={6}
        gradientId="ring-debt"
        from={allCaughtUp ? "var(--emerald)" : "var(--pink)"}
        to={allCaughtUp ? "var(--emerald-deep)" : "var(--violet)"}
        label={`${Math.round(monthProgress * 100)}%`}
        sublabel={allCaughtUp ? "done" : "paid"}
      />
      <StatPager
        ariaLabel="Debt summary"
        pages={[
          <div key="due" className="ds-stat hero solo">
            <span className="k">Due this month</span>
            <span className={`v ${allCaughtUp ? "paid" : "due"}`}>
              {maskMoney(thisMonthDue, currency, amountsHidden)}
            </span>
            {overdue > 0 && (
              <span className="overdue-note">{maskMoney(overdue, currency, amountsHidden)} overdue</span>
            )}
          </div>,
          <div key="breakdown" className="pager-row">
            <div className="ds-stat">
              <span className="k">Total paid this month</span>
              <span className={`v ${thisMonthPaid > 0 ? "paid" : ""}`}>
                {maskMoney(thisMonthPaid, currency, amountsHidden)}
              </span>
            </div>
            <div className="ds-stat">
              <span className="k">Overall remaining</span>
              <span className="v">{maskMoney(remaining, currency, amountsHidden)}</span>
            </div>
          </div>,
        ]}
      />
    </div>
  );
}
