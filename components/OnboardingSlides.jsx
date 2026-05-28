import { useState, useEffect, useRef, useCallback } from "react";
import { Wallet, TrendingDown, ListChecks, PlusCircle, CheckCircle } from "lucide-react";

export const ONBOARDING_KEY = "afterpayday-onboarding-done";

const SLIDES = [
  {
    Icon: Wallet,
    title: "Welcome to AfterPayday",
    body: "Know exactly what you can spend after bills and commitments — every single day.",
    color: "var(--emerald)",
  },
  {
    Icon: TrendingDown,
    title: "Your Safe to Spend",
    body: "We subtract fixed bills and daily spending from your salary. What's left is yours to spend freely.",
    color: "var(--violet)",
  },
  {
    Icon: ListChecks,
    title: "Track commitments",
    body: "Add recurring bills and installment debts. Mark them paid each month.",
    color: "var(--amber)",
  },
  {
    Icon: PlusCircle,
    title: "Log daily expenses",
    body: "Tap + to record what you spend today. Your Safe to Spend updates instantly.",
    color: "var(--pink)",
  },
  {
    Icon: CheckCircle,
    title: "You're all set",
    body: "Start by setting your monthly salary in Settings. AfterPayday handles the rest.",
    color: "var(--emerald)",
  },
];

export default function OnboardingSlides({ onDone }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const total = SLIDES.length;
  const isLast = current === total - 1;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    onDone();
  }, [onDone]);

  const handleNext = () => {
    if (isLast) { handleDismiss(); return; }
    setCurrent((c) => c + 1);
  };

  const handlePrev = () => {
    if (current > 0) setCurrent((c) => c - 1);
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    touchStartX.current = null;
    touchStartY.current = null;
    // Ignore vertical-dominant gestures so a scroll attempt with slight
    // horizontal drift doesn't advance the slide.
    if (Math.abs(dx) <= Math.abs(dy)) return;
    if (dx > 50) handleNext();
    else if (dx < -50) handlePrev();
  };

  const { Icon, title, body, color } = SLIDES[current];

  return (
    <div
      className="onboarding-stage"
      style={{
        position: "fixed",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        userSelect: "none",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        className="onboarding-skip"
        onClick={handleDismiss}
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        Skip
      </button>

      <div className="onboarding-content">
        <div
          className="onboarding-icon-halo"
          style={{ "--ob-color": color }}
        >
          <Icon size={46} strokeWidth={1.75} />
        </div>

        <div className="onboarding-text">
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
      </div>

      <div className="onboarding-dots">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className={`dot${i === current ? " active" : ""}`}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>

      <div
        className="onboarding-nav"
        style={{ paddingBottom: "calc(max(1.5rem, env(safe-area-inset-bottom)) + 1rem)" }}
      >
        <button
          className={`back${current === 0 ? " hide" : ""}`}
          onClick={handlePrev}
          aria-hidden={current === 0}
        >
          ← Back
        </button>
        <button className="next" onClick={handleNext}>
          {isLast ? "Get started" : "Next →"}
        </button>
      </div>
    </div>
  );
}
