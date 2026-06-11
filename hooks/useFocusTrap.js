import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Keyboard containment for modal sheets: while active, Tab/Shift+Tab wrap
// inside the container, Escape calls onEscape, and on deactivate focus
// returns to whatever element opened the sheet. Pass initialFocus: false
// when the sheet manages its own initial focus (e.g. a delayed input focus
// timed to the slide-in animation).
export default function useFocusTrap(containerRef, { active, onEscape, initialFocus = true }) {
  const restoreRef = useRef(null);
  const onEscapeRef = useRef(onEscape);
  useEffect(() => { onEscapeRef.current = onEscape; });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    restoreRef.current = document.activeElement;

    if (initialFocus) {
      const first = container.querySelector(FOCUSABLE);
      if (first) first.focus();
    }

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscapeRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !container.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !container.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      const restore = restoreRef.current;
      if (restore && document.contains(restore)) restore.focus();
      restoreRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
