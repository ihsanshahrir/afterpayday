import { useState } from "react";
import { Plus, X, CreditCard } from "lucide-react";
import Collapse from "../Collapse.jsx";
import DebtSummary from "./DebtSummary.jsx";
import DebtGroupCard from "./DebtGroupCard.jsx";
import NewDebtGroupForm from "./NewDebtGroupForm.jsx";

export default function DebtSection({ currency, groups, onAddGroup, onRemoveGroup, onToggle, onAddInstallment, onEditInstallment, onRemoveInstallment }) {
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

      {groups.length === 0 ? (
        !creating && (
          <div className="glass" style={{ padding: "30px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ color: "var(--fg-3)", font: "500 14px var(--font)", lineHeight: 1.5, maxWidth: 260 }}>
              Track car loans, mortgages, or any installment paid over months.
            </div>
            <button onClick={() => setCreating(true)} className="btn-grad" aria-label="Add debt group">
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
        )
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
              onEditInstallment={(instId, patch) => onEditInstallment(g.id, instId, patch)}
              onRemoveInstallment={(instId) => onRemoveInstallment(g.id, instId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
