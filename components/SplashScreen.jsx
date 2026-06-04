import { useState, useEffect } from "react";

// Two-stage exit so the homepage (especially the glass tabbar with backdrop-filter)
// never peeks through mid-animation on iOS PWA:
//   1. content (icon + label) fades + lifts while the full-screen black layer stays opaque
//   2. only then does the black layer fade out, just before unmount
export default function SplashScreen({ onDone }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [fadingBg, setFadingBg] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const t1 = setTimeout(() => setExiting(true), 800);
    const t2 = setTimeout(() => setFadingBg(true), 1150);
    const t3 = setTimeout(() => onDone(), 1600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: '#06040e',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
      opacity: fadingBg ? 0 : 1,
      transition: fadingBg ? 'opacity 0.35s ease' : 'none',
      pointerEvents: fadingBg ? 'none' : 'auto',
      willChange: 'opacity',
      transform: 'translateZ(0)',
      WebkitTransform: 'translateZ(0)',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        transform: visible
          ? (exiting ? 'scale(0.94)' : 'scale(1)')
          : 'scale(0.55)',
        opacity: visible ? (exiting ? 0 : 1) : 0,
        transition: exiting
          ? 'transform 0.32s ease-in, opacity 0.28s ease-in'
          : 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease',
        willChange: 'transform, opacity',
      }}>
        <img src={`${import.meta.env.BASE_URL}app-icon.png`} alt="AfterPayday" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <span style={{
        color: '#10b981', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        transform: visible
          ? (exiting ? 'translateY(-4px)' : 'translateY(0)')
          : 'translateY(10px)',
        opacity: visible ? (exiting ? 0 : 1) : 0,
        transition: exiting
          ? 'transform 0.28s ease-in, opacity 0.24s ease-in'
          : 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.08s, opacity 0.3s ease 0.08s',
        display: 'inline-block',
        willChange: 'transform, opacity',
      }}>AfterPayday</span>
    </div>
  );
}
