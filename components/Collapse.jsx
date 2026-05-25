import { useState, useEffect, useLayoutEffect, useRef } from "react";

// Smooth height slide + fade for inline expand/collapse.
// Animates both opening and closing by keeping content mounted until the
// close transition finishes. Mirrors the settings sheet's slide feel.
export default function Collapse({ open, duration, children }) {
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(open);
  const ref = useRef(null);

  useEffect(() => {
    if (open) {
      setRender(true);
      return undefined;
    }
    setShown(false);
    const ms = duration || 300;
    const t = setTimeout(() => setRender(false), ms);
    return () => clearTimeout(t);
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
