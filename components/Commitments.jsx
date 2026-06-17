import FixedExpensesSection from "./commitments/FixedExpensesSection.jsx";
import DebtSection from "./commitments/DebtSection.jsx";

export default function Commitments({
  currency,
  storageFull,
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
  onEditDebtGroup,
  onToggleInstallment,
  onAddInstallment,
  onEditInstallment,
  onRemoveInstallment,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingBottom: 8 }}>
      <FixedExpensesSection
        currency={currency}
        storageFull={storageFull}
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
        storageFull={storageFull}
        groups={debtGroups}
        onAddGroup={onAddDebtGroup}
        onRemoveGroup={onRemoveDebtGroup}
        onEditGroup={onEditDebtGroup}
        onToggle={onToggleInstallment}
        onAddInstallment={onAddInstallment}
        onEditInstallment={onEditInstallment}
        onRemoveInstallment={onRemoveInstallment}
      />
    </div>
  );
}
