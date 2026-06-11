import FixedExpensesSection from "./commitments/FixedExpensesSection.jsx";
import DebtSection from "./commitments/DebtSection.jsx";

export default function Commitments({
  currency,
  fixedExpenses,
  fixedTotal,
  fixedGrandTotal,
  debtGroups,
  onAddFixed,
  onEditFixed,
  onRemoveFixed,
  onToggleFixed,
  onAddDebtGroup,
  onRemoveDebtGroup,
  onToggleInstallment,
  onAddInstallment,
  onEditInstallment,
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
        onEdit={onEditFixed}
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
        onEditInstallment={onEditInstallment}
        onRemoveInstallment={onRemoveInstallment}
      />
    </div>
  );
}
