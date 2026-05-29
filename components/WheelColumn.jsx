import { useEffect, useRef, useCallback, useId } from "react";

export default function WheelColumn({ items, selectedIndex, onChange, ariaLabel = "Picker" }) {
  const ITEM_H = 40;
  const VISIBLE = 5;
  const baseId = useId();
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);
  const velocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const scrollToIndex = useCallback((idx, smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    const top = idx * ITEM_H;
    el.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => scrollToIndex(selectedIndex, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the visible position in sync when the parent moves the selection
  // (e.g. day-clamp when switching to a shorter month). Skip while the user
  // is actively dragging so we don't fight their gesture.
  const lastSyncedIndex = useRef(selectedIndex);
  useEffect(() => {
    if (isDragging.current) return;
    if (lastSyncedIndex.current === selectedIndex) return;
    lastSyncedIndex.current = selectedIndex;
    scrollToIndex(selectedIndex, true);
  }, [selectedIndex, scrollToIndex]);

  const snapToNearest = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    scrollToIndex(clamped, true);
    lastSyncedIndex.current = clamped;
    onChange(clamped);
  }, [items.length, onChange, scrollToIndex]);

  const handlePointerDown = (e) => {
    // Capture so pointermove/up still fire when the cursor leaves the column.
    // Without this a mouse drag released outside leaves dragging stuck on.
    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    }
    isDragging.current = true;
    didDrag.current = false;
    startY.current = e.clientY;
    startScroll.current = containerRef.current?.scrollTop || 0;
    velocity.current = 0;
    lastY.current = e.clientY;
    lastTime.current = Date.now();
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const el = containerRef.current;
    if (!el) return;
    const dy = startY.current - e.clientY;
    if (Math.abs(dy) > 3) didDrag.current = true;
    el.scrollTop = startScroll.current + dy;
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (lastY.current - e.clientY) / dt;
    lastY.current = e.clientY;
    lastTime.current = now;
  };

  const handlePointerUp = (e) => {
    if (e && e.currentTarget && e.currentTarget.releasePointerCapture) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!didDrag.current) return;
    const el = containerRef.current;
    if (!el) return;
    const v = velocity.current;
    if (Math.abs(v) > 0.3) {
      el.scrollTo({ top: el.scrollTop + v * 120, behavior: 'smooth' });
      setTimeout(snapToNearest, 300);
    } else {
      snapToNearest();
    }
  };

  const handleItemClick = (idx) => {
    if (didDrag.current) return;
    lastSyncedIndex.current = idx;
    scrollToIndex(idx, true);
    onChange(idx);
  };

  const selectIndex = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    lastSyncedIndex.current = clamped;
    scrollToIndex(clamped, true);
    onChange(clamped);
  }, [items.length, onChange, scrollToIndex]);

  const handleKeyDown = (e) => {
    let next;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight": next = selectedIndex + 1; break;
      case "ArrowUp":
      case "ArrowLeft":  next = selectedIndex - 1; break;
      case "Home":       next = 0; break;
      case "End":        next = items.length - 1; break;
      case "PageDown":   next = selectedIndex + 3; break;
      case "PageUp":     next = selectedIndex - 3; break;
      default: return;
    }
    e.preventDefault();
    selectIndex(next);
  };

  const padItems = Math.floor(VISIBLE / 2);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ touchAction: 'none' }}>
      <div
        className="absolute left-0 right-0 pointer-events-none z-10 rounded-lg"
        style={{
          top: padItems * ITEM_H, height: ITEM_H,
          background: 'rgba(255,255,255,0.06)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 z-20 pointer-events-none"
        style={{ height: padItems * ITEM_H, background: 'linear-gradient(180deg, rgba(20,16,40,0.94) 0%, transparent 100%)' }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
        style={{ height: padItems * ITEM_H, background: 'linear-gradient(0deg, rgba(20,16,40,0.94) 0%, transparent 100%)' }}
      />
      <div
        ref={containerRef}
        className="h-full overflow-hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', outline: 'none' }}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={`${baseId}-${selectedIndex}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        <div style={{ height: padItems * ITEM_H }} />
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={idx}
              id={`${baseId}-${idx}`}
              role="option"
              aria-selected={isSelected}
              onClick={() => handleItemClick(idx)}
              className="flex items-center justify-center cursor-pointer select-none transition-all duration-150"
              style={{
                height: ITEM_H,
                fontSize: isSelected ? 18 : 15,
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? '#f5f5f5' : 'rgba(163,163,163,0.5)',
                transform: isSelected ? 'scale(1.02)' : 'scale(0.98)',
              }}
            >
              {item}
            </div>
          );
        })}
        <div style={{ height: padItems * ITEM_H }} />
      </div>
    </div>
  );
}
