import { uid } from "./id.js";
import { daysInMonth } from "./date.js";
import { splitEvenly } from "./money.js";

// Build a monthly installment schedule that always sums back to `total`
// (splitEvenly lets the last installment absorb the rounding remainder).
// The due day follows `startDate`, clamped to each month's last valid day.
export function generateInstallments(total, months, startDate) {
  const amounts = splitEvenly(total, months);
  const [yy, mm, dd] = startDate.split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(yy, mm - 1 + i, 1);
    const mIdx = d.getMonth();
    const day = Math.min(dd, daysInMonth(mIdx + 1, d.getFullYear()));
    const ddStr = String(day).padStart(2, "0");
    const mmStr = String(mIdx + 1).padStart(2, "0");
    return {
      id: uid(),
      label: `Month ${i + 1}`,
      amount: amounts[i],
      dueDate: `${d.getFullYear()}-${mmStr}-${ddStr}`,
      isPaid: false,
    };
  });
}
