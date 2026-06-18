import { useState } from "react";
import { Receipt, Plus, X, Check, Trash2, Pencil } from "lucide-react";
import RingProgress from "../RingProgress.jsx";
import Collapse from "../Collapse.jsx";
import StatPager from "../StatPager.jsx";
import { isFixedPaidThisMonth } from "../../utils/date.js";
import { maskMoney } from "../../utils/money.js";

export default function FixedExpensesSection({ currency, storageFull, items, total, unpaidTotal, onAdd, onEdit, onRemove, onToggle, amountsHidden }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditName(e.name);
    setEditAmount(String(e.amount));
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    const a = parseFloat(editAmount);
    if (!editName.trim() || !Number.isFinite(a) || a <= 0) return;
    onEdit(editingId, editName.trim(), a);
    setEditingId(null);
  };

  const paidCount = items.filter((e) => isFixedPaidThisMonth(e)).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? paidCount / totalCount : 0;
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

    if (editingId === e.id) {
      return (
        <li key={e.id} className="fx-row editing">
          <input
            type="text"
            aria-label="Expense name"
            value={editName}
            onChange={(ev) => setEditName(ev.target.value)}
            className="glass-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <div style={{ position: "relative", width: 110 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", font: "500 13px var(--font)", pointerEvents: "none" }}>
              {currency}
            </span>
            <input
              type="number"
              inputMode="decimal"
              aria-label={`Amount in ${currency}`}
              value={editAmount}
              onChange={(ev) => setEditAmount(ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && saveEdit()}
              className="glass-input"
              style={{ paddingLeft: "2.8rem" }}
            />
          </div>
          <button className="row-x" onClick={saveEdit} aria-label="Save">
            <Check size={15} strokeWidth={2} />
          </button>
          <button className="row-x" onClick={cancelEdit} aria-label="Cancel edit">
            <X size={15} strokeWidth={1.75} />
          </button>
        </li>
      );
    }

    return (
      <li key={e.id} className={`fx-row${isPaid ? " paid" : ""}`}>
        <button
          className={`check${isPaid ? " on" : ""}`}
          onClick={() => onToggle(e.id)}
          aria-label={isPaid ? `Mark ${e.name} unpaid` : `Mark ${e.name} paid`}
        >
          {isPaid && <Check size={12} style={{ color: "#06281d" }} strokeWidth={3} />}
        </button>
        <span className="name">{e.name}</span>
        {isPaid && <span className="tag">PAID</span>}
        <span className="amt">{maskMoney(e.amount, currency, amountsHidden)}</span>
        <button
          className="row-x"
          onClick={() => startEdit(e)}
          aria-label={`Edit ${e.name}`}
        >
          <Pencil size={13} strokeWidth={1.75} />
        </button>
        <button
          className="row-x"
          onClick={() => onRemove(e.id)}
          aria-label={`Delete ${e.name}`}
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </li>
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
          aria-label={adding ? "Cancel" : "Add fixed expense"}
          disabled={!adding && storageFull}
          aria-disabled={!adding && storageFull}
        >
          {adding ? <><X size={13} strokeWidth={1.75} /> Cancel</> : <><Plus size={13} strokeWidth={1.75} /> Add</>}
        </button>
      </div>

      <Collapse open={adding}>
        <div className="glass" style={{ padding: "14px", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Expenses (e.g., Rent, Zakat...)"
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
        !adding && (
          <div className="glass" style={{ padding: "30px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ color: "var(--fg-3)", font: "500 14px var(--font)", lineHeight: 1.5, maxWidth: 260 }}>
              Add rent, subscriptions, or anything you pay every month.
            </div>
            <button onClick={() => setAdding(true)} className="btn-grad" aria-label="Add fixed expense">
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="glass fixed-summary">
            <RingProgress
              value={progress}
              size={76}
              stroke={6}
              gradientId="ring-fixed"
              from={allPaid ? "var(--emerald)" : "var(--amber)"}
              to={allPaid ? "var(--emerald-deep)" : "var(--emerald)"}
              label={`${paidCount}/${totalCount}`}
              sublabel={allPaid ? "done" : "paid"}
            />
            <StatPager
              ariaLabel="Fixed monthly summary"
              pages={[
                <div key="due" className="fc-stat hero solo">
                  <span className="k">Due this month</span>
                  <span className={`v ${allPaid ? "paid" : "due"}`}>
                    {maskMoney(unpaidTotal, currency, amountsHidden)}
                  </span>
                </div>,
                <div key="paid" className="fc-stat hero solo">
                  <span className="k">Total paid this month</span>
                  <span className={`v ${total - unpaidTotal > 0 ? "paid" : ""}`}>
                    {maskMoney(Math.max(0, total - unpaidTotal), currency, amountsHidden)}
                  </span>
                </div>,
              ]}
            />
          </div>

          <div className="glass fixed-card">
            {allPaid && (
              <div className="fc-done">
                <Check size={14} strokeWidth={2.5} /> All paid this month
              </div>
            )}

            <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {previewItems.map(renderFixedRow)}
            </ul>

            <Collapse open={showAll}>
              <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {restItems.map(renderFixedRow)}
              </ul>
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
        </div>
      )}
    </div>
  );
}
