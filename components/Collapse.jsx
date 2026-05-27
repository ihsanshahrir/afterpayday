import { useState, useEffect, useLayoutEffect, useRef } from "react";

// Smooth height slide + fade for inline expand/collapse.
// Animates both opening and closing by keeping content mounted until the
// close transition finishes. Mirrors the settings sheet's slide feel.
export default function Collapse({ open, duration, children }) {
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(open);
  const ref = useRef(null);

  // Unmount only after the real grid-template-rows transition finishes, so
  // the DOM removal lands one frame after the fully-closed paint instead of
  // racing a setTimeout (which is what produced the end-of-collapse snap).
  useEffect(() => {
    if (open) {
      setRender(true);
      return undefined;
    }
    setShown(false);
    const ms = duration || 300;
    const el = ref.current;
    let timer = null;
    const finish = () => {
      if (timer) clearTimeout(timer);
      if (el) el.removeEventListener("transitionend", onEnd);
      setRender(false);
    };
    const onEnd = (e) => {
      if (e.target !== el) return;
      if (e.propertyName !== "grid-template-rows") return;
      finish();
    };
    if (el) el.addEventListener("transitionend", onEnd);
    // Safety net: if transitionend never fires (tab hidden, reduced motion,
    // etc.) still unmount slightly after the nominal duration.
    timer = setTimeout(finish, ms + 60);
    return () => {
      if (timer) clearTimeout(timer);
      if (el) el.removeEventListener("transitionend", onEnd);
    };
  }, [open, duration]);

  // Once the collapsed state is in the DOM, force a reflow to lock in the
  // 0fr baseline, then flip to open so the grid-rows transition runs.
  useLayoutEffect(() => {
    if (render && open && !shown && ref.current) {
      void ref.current.offsetHeight;
      setShown(true);
    }
  }, [render, open, shown]);

  if (!render) return null;

  return (
    <div
      ref={ref}
      className={`collapse${shown ? " open" : ""}`}
      style={duration ? { "--collapse-dur": `${duration}ms` } : undefined}
    >
      <div className="collapse-inner">{children}</div>
    </div>
  );
}
