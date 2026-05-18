import { useState } from "react";
import { formatMoney } from "../utils/money.js";

export default function HistorySheet({ history, currency, onClose }) {
  const [isClosing, setIsClosing] = useState(false);

  const close = () => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ animation: `${isClosing ? 'iosPickerFadeOut' : 'iosPickerFadeIn'} 0.28s ease forwards` }}
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-t-2xl border-t border-neutral-700/50"
        style={{
          background: 'linear-gradient(180deg, rgba(38,38,38,0.98) 0%, rgba(23,23,23,0.99) 100%)',
          animation: `${isClosing ? 'iosPickerSlideDown' : 'iosPickerSlideUp'} 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-700/50 shrink-0">
          <div className="w-12"></div>
          <span className="text-sm font-medium text-neutral-200">Monthly History</span>
          <button
            onClick={close}
            className="w-12 text-right text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Done
          </button>
        </div>

        <style>{`
          @keyframes iosPickerFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes iosPickerFadeOut { from { opacity: 1 } to { opacity: 0 } }
          @keyframes iosPickerSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
          @keyframes iosPickerSlideDown { from { transform: translateY(0) } to { transform: translateY(100%) } }
        `}</style>

        <div className="p-5 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {(!history || history.length === 0) ? (
            <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">
              No earlier history.
              <div className="mt-1 text-xs text-neutral-600">Snapshots are taken automatically at the start of a new month.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((h) => {
                const totalSpent = h.fixedTotal + h.installments + h.dailySpent;
                const progress = h.salary > 0 ? Math.min(1, totalSpent / h.salary) : 0;
                const isPositive = h.balance >= 0;
                const [yy, mm] = h.month.split('-');
                const monthStr = new Date(yy, mm - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });

                return (
                  <div key={h.id} className="rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-neutral-200">{monthStr}</span>
                      <div className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : '−'} {formatMoney(Math.abs(h.balance), currency)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                      <span>Salary <span className="text-neutral-300">{formatMoney(h.salary, currency)}</span></span>
                      <span>Spent <span className="text-neutral-300">{formatMoney(totalSpent, currency)}</span></span>
                    </div>

                    <div className="h-1.5 rounded-full bg-neutral-900 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${progress * 100}%`,
                          background: progress >= 1
                            ? 'linear-gradient(90deg, #f43f5e, #e11d48)'
                            : 'linear-gradient(90deg, #38bdf8, #818cf8)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
