import { useState } from "react";
import { Plus, Check, Trash2, Pencil } from "lucide-react";
import Collapse from "../Collapse.jsx";
import ManualInstallmentForm from "./ManualInstallmentForm.jsx";
import { uid } from "../../utils/id.js";
import { isInCurrentMonth, isOverdue, fmtDate } from "../../utils/date.js";
import { formatMoney } from "../../utils/money.js";

export default function DebtGroupCard({ group, currency, onRemoveGroup, onToggle, onAddInstallment, onEditInstallment, onRemoveInstallment }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [addingInst, setAddingInst] = useState(false);
  const [editingInstId, setEditingInstId] = useState(null);

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
  const hiddenUnpaid = restInst.filter((i) => !i.isPaid).length;
  const hasMore = restInst.length > 0;

  const renderInstRow = (i) => {
    if (editingInstId === i.id) {
      return (
        <div key={i.id} className="inst-row editing" style={{ paddingBottom: 10 }}>
          <ManualInstallmentForm
            currency={currency}
            initial={i}
            submitLabel="Save"
            onCancel={() => setEditingInstId(null)}
            onSubmit={(fields) => {
              onEditInstallment(i.id, fields);
              setEditingInstId(null);
            }}
          />
        </div>
      );
    }

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
        <button className="ix" onClick={() => setEditingInstId(i.id)} aria-label="Edit">
          <Pencil size={12} strokeWidth={1.75} />
        </button>
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
                onSubmit={(fields) => {
                  onAddInstallment({ id: uid(), ...fields, isPaid: false });
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
