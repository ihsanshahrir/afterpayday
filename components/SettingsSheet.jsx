import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import WheelColumn from "./WheelColumn.jsx";

const CURRENCIES = [
  { code: "RM",  flag: "🇲🇾", name: "Malaysian Ringgit" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore Dollar" },
  { code: "USD", flag: "🇺🇸", name: "US Dollar" },
  { code: "GBP", flag: "🇬🇧", name: "British Pound" },
  { code: "EUR", flag: "🇪🇺", name: "Euro" },
];

export default function SettingsSheet({ settings, onClose, onSave }) {
  const [salary, setSalary] = useState(String(settings.salary || ""));
  const [currency, setCurrency] = useState(settings.currency || "RM");
  const [isClosing, setIsClosing] = useState(false);

  const close = (callback) => {
    setIsClosing(true);
    setTimeout(callback, 280);
  };

  const save = () => {
    const s = parseFloat(salary);
    close(() => onSave({
      salary: Number.isFinite(s) && s >= 0 ? s : 0,
      currency: currency.trim() || "RM",
    }));
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      style={{ animation: `${isClosing ? 'iosPickerFadeOut' : 'iosPickerFadeIn'} 0.28s ease forwards` }}
      onClick={() => close(onClose)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-t-2xl border-t border-neutral-700/50 bg-neutral-950 p-5"
        style={{ animation: `${isClosing ? 'iosPickerSlideDown' : 'iosPickerSlideUp'} 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-neutral-500">Settings</div>
            <div className="text-base font-medium text-neutral-100">Income & currency</div>
          </div>
          <button onClick={() => close(onClose)} className="w-8 h-8 rounded-lg border border-neutral-800 flex items-center justify-center text-neutral-400 hover:bg-neutral-900">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-neutral-500">Monthly salary</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">{currency}</span>
              <input
                type="number"
                inputMode="decimal"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-neutral-500">Currency</label>
            <CurrencyPickerField value={currency} onChange={setCurrency} />
          </div>
        </div>

        <button
          onClick={save}
          className="mt-6 w-full py-3 rounded-lg bg-emerald-500 text-neutral-950 font-medium hover:bg-emerald-400"
        >
          Save
        </button>

        <style>{`
          @keyframes iosPickerFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes iosPickerFadeOut { from { opacity: 1 } to { opacity: 0 } }
          @keyframes iosPickerSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
          @keyframes iosPickerSlideDown { from { transform: translateY(0) } to { transform: translateY(100%) } }
        `}</style>
      </div>
    </div>
  );
}

function CurrencyPickerField({ value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const curr = CURRENCIES.find((c) => c.code === value) || CURRENCIES[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="mt-1 w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-emerald-500/30 text-sm text-neutral-100 text-left flex items-center justify-between focus:outline-none hover:bg-neutral-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{curr.flag}</span>
          <span>{curr.code}</span>
          <span className="text-neutral-500">— {curr.name}</span>
        </span>
        <ChevronDown size={14} className="text-neutral-500" />
      </button>
      {showPicker && (
        <CurrencyPickerModal
          initialCode={value}
          onConfirm={(code) => { onChange(code); setShowPicker(false); }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

function CurrencyPickerModal({ initialCode, onConfirm, onCancel }) {
  const initialIdx = Math.max(0, CURRENCIES.findIndex((c) => c.code === initialCode));
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [isClosing, setIsClosing] = useState(false);

  const close = (callback) => {
    setIsClosing(true);
    setTimeout(callback, 280);
  };

  const displayItems = CURRENCIES.map((c) => `${c.flag}  ${c.code} — ${c.name}`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ animation: `${isClosing ? 'iosPickerFadeOut' : 'iosPickerFadeIn'} 0.28s ease forwards` }}
      onClick={(e) => { e.stopPropagation(); close(onCancel); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-t-2xl border-t border-neutral-700/50 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(38,38,38,0.98) 0%, rgba(23,23,23,0.99) 100%)',
          animation: `${isClosing ? 'iosPickerSlideDown' : 'iosPickerSlideUp'} 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button onClick={() => close(onCancel)} className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
            Cancel
          </button>
          <span className="text-sm font-medium text-neutral-200">Select Currency</span>
          <button
            onClick={() => close(() => onConfirm(CURRENCIES[selectedIdx].code))}
            className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Done
          </button>
        </div>

        <div className="flex items-center justify-center px-4 pb-8 pt-2" style={{ height: 220 }}>
          <div className="flex-1 relative" style={{ height: 180 }}>
            <WheelColumn items={displayItems} selectedIndex={selectedIdx} onChange={setSelectedIdx} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes iosPickerFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes iosPickerFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes iosPickerSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes iosPickerSlideDown { from { transform: translateY(0) } to { transform: translateY(100%) } }
      `}</style>
    </div>
  );
}
