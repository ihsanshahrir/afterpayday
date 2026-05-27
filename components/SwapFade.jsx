import { useState, useEffect, useRef } from "react";

// Cross-fade between two pieces of content when `swapKey` changes.
// Outgoing layer is position:absolute (out of flow) so the container
// sizes to incoming content immediately — no height snap at either end.
export default function SwapFade({ swapKey, duration = 240, children }) {
  const [outgoing, setOutgoing] = useState(null);
  const prevKeyRef = useRef(swapKey);
  const prevNodeRef = useRef(children);

  // Snapshot old content and start exit animation when key changes.
  // Runs before the sync effect below (React fires effects in order),
  // so prevNodeRef still holds the previous render's children here.
  useEffect(() => {
    if (swapKey === prevKeyRef.current) return;
    setOutgoing({ key: prevKeyRef.current, node: prevNodeRef.current });
    prevKeyRef.current = swapKey;
    const t = setTimeout(() => setOutgoing(null), duration);
    return () => clearTimeout(t);
  }, [swapKey, duration]);

  // Keep prevNodeRef fresh after every render so the next snapshot is accurate.
  useEffect(() => {
    prevNodeRef.current = children;
  });

  return (
    <div className="swap" style={{ "--swap-dur": `${duration}ms` }}>
      {outgoing && (
        <div key={`out-${outgoing.key}`} className="swap-out">
          {outgoing.node}
        </div>
      )}
      <div key={`in-${swapKey}`} className="swap-in">
        {children}
      </div>
    </div>
  );
}
