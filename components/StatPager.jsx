import { useState, useRef } from "react";

const SWIPE_THRESHOLD = 40;       // px to commit a page change
const DIRECTION_LOCK_THRESHOLD = 6; // px before we decide horizontal vs vertical intent

/**
 * Horizontally swipeable stat carousel with dot indicators.
 * - Touch: native swipe with horizontal/vertical direction lock so vertical
 *   page scrolling still works.
 * - Mouse: click-and-drag fallback for desktop.
 * - Dots: tap to jump; show current page.
 *
 * Pass any JSX as pages — the pager only owns layout + interaction.
 */
export default function StatPager({ pages, ariaLabel = "Stats" }) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const directionRef = useRef(null); // null | "h" | "v"

  const handleStart = (clientX, clientY) => {
    startXRef.current = clientX;
    startYRef.current = clientY;
    directionRef.current = null;
    setDragging(true);
    setDragX(0);
  };

  const handleMove = (clientX, clientY) => {
    if (!dragging) return;
    const dx = clientX - startXRef.current;
    const dy = clientY - startYRef.current;

    // Lock direction after first significant move so vertical scrolls don't
    // accidentally drag the pager and horizontal swipes commit cleanly.
    if (directionRef.current === null) {
      if (Math.abs(dx) > DIRECTION_LOCK_THRESHOLD || Math.abs(dy) > DIRECTION_LOCK_THRESHOLD) {
        directionRef.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      } else {
        return;
      }
    }
    if (directionRef.current !== "h") return;

    // Resist past first/last page so it feels rubber-banded.
    let offset = dx;
    if ((index === 0 && dx > 0) || (index === pages.length - 1 && dx < 0)) {
      offset = dx * 0.35;
    }
    setDragX(offset);
  };

  const handleEnd = () => {
    if (!dragging) return;
    setDragging(false);
    if (directionRef.current === "h") {
      if (dragX > SWIPE_THRESHOLD && index > 0) setIndex(index - 1);
      else if (dragX < -SWIPE_THRESHOLD && index < pages.length - 1) setIndex(index + 1);
    }
    setDragX(0);
    directionRef.current = null;
  };

  if (!pages || pages.length === 0) return null;

  // Pointer capture keeps the drag alive when the cursor leaves the viewport.
  // touchAction: pan-y lets native vertical scrolling pass through; horizontal
  // swipes are committed by the direction lock inside handleMove.
  const onPointerDown = (e) => {
    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    }
    handleStart(e.clientX, e.clientY);
  };
  const onPointerUp = (e) => {
    if (e && e.currentTarget && e.currentTarget.releasePointerCapture) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    handleEnd();
  };

  return (
    <div className="stat-pager" role="group" aria-label={ariaLabel}>
      <div
        className="stat-pager-viewport"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => handleMove(e.clientX, e.clientY)}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="stat-pager-track"
          style={{
            transform: `translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)`,
            transition: dragging ? "none" : "transform 320ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {pages.map((page, i) => (
            <div
              key={i}
              className="stat-pager-page"
              aria-hidden={i !== index}
            >
              {page}
            </div>
          ))}
        </div>
      </div>
      {pages.length > 1 && (
        <div className="stat-pager-dots" role="tablist" aria-label={`${ariaLabel} pages`}>
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              className={`spd-dot${i === index ? " on" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Page ${i + 1} of ${pages.length}`}
              aria-selected={i === index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
