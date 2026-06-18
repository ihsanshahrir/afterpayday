import { useState } from "react";
import { Plus, Check, Trash2, Pencil } from "lucide-react";
import Collapse from "../Collapse.jsx";
import ManualInstallmentForm from "./ManualInstallmentForm.jsx";
import EditDebtGroupForm from "./EditDebtGroupForm.jsx";
import { uid } from "../../utils/id.js";
import { isInCurrentMonth, isOverdue, fmtDate } from "../../utils/date.js";
import { maskMoney } from "../../utils/money.js";

export default function DebtGroupCard({ group, currency, onRemoveGroup, onEditGroup, onToggle, onAddInstallment, onEditInstallment, onRemoveInstallment, amountsHidden }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [addingInst, setAddingInst] = useState(false);
  const [editingInstId, setEditingInstId] = useState(null);
  const [editingGroup, setEditingGroup] = useState(false);

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
        <li key={i.id} className="inst-row editing" style={{ paddingBottom: 10 }}>
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
        </li>
      );
    }

    const st = statusOf(i);
    const isNext = nextDue && i.id === nextDue.id;
    return (
      <li key={i.id} className={`inst-row${i.isPaid ? " paid" : ""}${isNext ? " next" : ""}`}>
        <button
          className={`check${i.isPaid ? " on" : ""}`}
          onClick={() => onToggle(i.id)}
          aria-label={i.isPaid ? `Mark ${i.label} unpaid` : `Mark ${i.label} paid`}
        >
          {i.isPaid && <Check size={11} style={{ color: "#06281d" }} strokeWidth={3} />}
        </button>
        <div className="info">
          <div className="il">{i.label}</div>
          <div className="id">{fmtDate(i.dueDate)}</div>
        </div>
        {st && <span className={`pill ${st.cls}`}>{st.txt}</span>}
        <span className="ia">{maskMoney(i.amount, currency, amountsHidden)}</span>
        <button className="ix" onClick={() => setEditingInstId(i.id)} aria-label={`Edit ${i.label}`}>
          <Pencil size={12} strokeWidth={1.75} />
        </button>
        <button className="ix" onClick={() => onRemoveInstallment(i.id)} aria-label={`Delete ${i.label}`}>
          <Trash2 size={12} strokeWidth={1.75} />
        </button>
      </li>
    );
  };

  return (
    <div className="glass debt-card">
      <div className="top">
        <span className="dot" style={{ background: "var(--pink)" }} />
        <span className="name">{group.name}</span>
        {thisMonthAmt > 0 && (
          <span className="pm">
            {maskMoney(thisMonthAmt, currency, amountsHidden)}
            <span className="of">/mo</span>
          </span>
        )}
        <button className="edit-btn" onClick={() => setEditingGroup((v) => !v)} aria-label={`Edit ${group.name} group`}>
          <Pencil size={14} strokeWidth={1.75} />
        </button>
        <button className="trash-btn" onClick={onRemoveGroup} aria-label={`Delete ${group.name} group`}>
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>

      <Collapse open={editingGroup}>
        <EditDebtGroupForm
          currency={currency}
          group={group}
          onCancel={() => setEditingGroup(false)}
          onSave={(patch) => {
            onEditGroup(patch);
            setEditingGroup(false);
          }}
        />
      </Collapse>

      {totalCount > 0 && (
        <>
          <div className="dprogress">
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="meta">
            <span>{paidCount}/{totalCount} · {maskMoney(remaining, currency, amountsHidden)} left</span>
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
              <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {previewInst.map(renderInstRow)}
              </ul>

              <Collapse open={showAll}>
                <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {restInst.map(renderInstRow)}
                </ul>
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
              Total <span>{maskMoney(total, currency, amountsHidden)}</span>
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
