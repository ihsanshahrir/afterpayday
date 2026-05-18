import { useState, useEffect } from "react";

export default function SplashScreen({ onDone }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const t1 = setTimeout(() => setExiting(true), 750);
    const t2 = setTimeout(() => onDone(), 1150);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: '#0a0a0a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
      transform: exiting ? 'translateY(-100%)' : 'translateY(0)',
      transition: exiting ? 'transform 0.38s cubic-bezier(0.4,0,0.6,1)' : 'none',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        transform: visible ? 'scale(1)' : 'scale(0.55)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease',
      }}>
        <img src="/app-icon.png" alt="AfterPayday" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <span style={{
        color: '#10b981', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.08s, opacity 0.3s ease 0.08s',
        display: 'inline-block',
      }}>AfterPayday</span>
    </div>
  );
}
