import { useState, useEffect, useRef, useCallback } from "react";
import { Wallet, TrendingDown, ListChecks, PlusCircle, CheckCircle } from "lucide-react";

export const ONBOARDING_KEY = 'afterpayday-onboarding-done';

const SLIDES = [
  {
    Icon: Wallet,
    title: 'Welcome to AfterPayday',
    body: 'Know exactly what you can spend after bills and commitments — every single day.',
    color: '#10b981',
  },
  {
    Icon: TrendingDown,
    title: 'Your Safe to Spend',
    body: "We subtract your fixed expenses and daily spending from your salary. What's left is yours to spend freely.",
    color: '#6366f1',
  },
  {
    Icon: ListChecks,
    title: 'Track Commitments',
    body: 'Add recurring bills and installment debts under Commitments. Mark them paid each month.',
    color: '#f59e0b',
  },
  {
    Icon: PlusCircle,
    title: 'Log Daily Expenses',
    body: 'Tap the add area on the Dashboard to record what you spend today. Your Safe to Spend updates instantly.',
    color: '#3b82f6',
  },
  {
    Icon: CheckCircle,
    title: "You're All Set",
    body: 'Start by setting your monthly salary in Settings. AfterPayday will take care of the rest.',
    color: '#10b981',
  },
];

export default function OnboardingSlides({ onDone }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const touchStartX = useRef(null);
  const total = SLIDES.length;
  const isLast = current === total - 1;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    onDone();
  }, [onDone]);

  const handleNext = () => {
    if (isLast) { handleDismiss(); return; }
    setCurrent(c => c + 1);
  };

  const handlePrev = () => {
    if (current > 0) setCurrent(c => c - 1);
  };

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (delta > 50) handleNext();
    else if (delta < -50) handlePrev();
  };

  const { Icon, title, body, color } = SLIDES[current];

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        userSelect: 'none',
      }}
    >
      {/* Skip */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'max(1.5rem, env(safe-area-inset-top)) 1.25rem 0' }}>
        <button
          onClick={handleDismiss}
          style={{ color: '#737373', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 2rem', gap: 28 }}>
        <div style={{
          width: 96, height: 96, borderRadius: 28,
          backgroundColor: color + '18',
          border: `1.5px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={44} style={{ color }} strokeWidth={1.5} />
        </div>

        <div style={{ textAlign: 'center', maxWidth: 280 }}>
          <div style={{ color: '#f5f5f5', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>
            {title}
          </div>
          <div style={{ color: '#737373', fontSize: 15.5, lineHeight: 1.6 }}>
            {body}
          </div>
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 24 }}>
        {SLIDES.map((_, i) => (
          <div
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: i === current ? 20 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === current ? '#10b981' : '#404040',
              transition: 'width 0.25s ease, background-color 0.25s ease',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `0 1.5rem max(1.5rem, env(safe-area-inset-bottom)) 1.5rem`,
        paddingBottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 1rem)',
      }}>
        <button
          onClick={handlePrev}
          style={{
            color: current === 0 ? 'transparent' : '#737373',
            background: 'none', border: 'none', cursor: current === 0 ? 'default' : 'pointer',
            fontSize: 14, padding: '8px 12px',
            pointerEvents: current === 0 ? 'none' : 'auto',
          }}
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          style={{
            backgroundColor: '#10b981', color: '#fff',
            border: 'none', borderRadius: 12, cursor: 'pointer',
            fontSize: 15, fontWeight: 600, padding: '12px 28px',
            letterSpacing: '-0.01em',
          }}
        >
          {isLast ? 'Get Started' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
