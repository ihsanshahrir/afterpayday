import { useState, useEffect, useRef } from "react";

// Cross-fade between two pieces of content when `swapKey` changes.
// Outgoing content animates out while incoming animates in, in parallel,
// so the swap doesn't snap (the previous version only animated entry).
export default function SwapFade({ swapKey, duration = 240, children }) {
  const [current, setCurrent] = useState({ key: swapKey, content: children });
  const [previous, setPrevious] = useState(null);
  const prevKeyRef = useRef(swapKey);

  useEffect(() => {
    if (swapKey === prevKeyRef.current) {
      setCurrent({ key: swapKey, content: children });
      return undefined;
    }
    setPrevious(current);
    setCurrent({ key: swapKey, content: children });
    prevKeyRef.current = swapKey;
    const t = setTimeout(() => setPrevious(null), duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapKey, children, duration]);

  return (
    <div className="swap" style={{ "--swap-dur": `${duration}ms` }}>
      {previous && (
        <div key={`out-${previous.key}`} className="swap-out">
          {previous.content}
        </div>
      )}
      <div key={`in-${current.key}`} className="swap-in">
        {current.content}
      </div>
    </div>
  );
}
