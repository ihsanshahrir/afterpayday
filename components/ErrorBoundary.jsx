import { Component } from "react";
import { STORAGE_KEY } from "../state/storage.js";
import { ONBOARDING_KEY } from "./OnboardingSlides.jsx";
import { SMART_SCAN_PREF_KEY, INSTALL_PREF_KEY } from "../utils/ui.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[AfterPayday] Uncaught render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleClearData = () => {
    if (window.confirm("This will delete all your data and restart the app. Are you sure?")) {
      // Only clear keys this app owns. Plain localStorage.clear() would also
      // remove unrelated data on the same origin.
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ONBOARDING_KEY);
        localStorage.removeItem(SMART_SCAN_PREF_KEY);
        localStorage.removeItem(INSTALL_PREF_KEY);
        localStorage.removeItem("afterpayday:sync");
        localStorage.removeItem("afterpayday:auth");
        localStorage.removeItem("afterpayday:device");
        sessionStorage.removeItem("afterpayday-splash");
      } catch (_) { /* swallow — best-effort cleanup */ }
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100dvh',
        backgroundColor: '#0a0a0a',
        color: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        gap: '1.5rem',
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: '#fee2e220',
          border: '1px solid #fca5a520',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          ⚠
        </div>

        <div style={{ textAlign: 'center', maxWidth: 280 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: '#737373', lineHeight: 1.6 }}>
            The app hit an unexpected error. Your data is safe — try reloading.
          </div>
        </div>

        {this.state.error && (
          <details style={{ maxWidth: 320, width: '100%' }}>
            <summary style={{ fontSize: 11, color: '#525252', cursor: 'pointer', userSelect: 'none' }}>
              Error details
            </summary>
            <pre style={{
              marginTop: 8, padding: '0.75rem', borderRadius: 8,
              backgroundColor: '#171717', border: '1px solid #262626',
              fontSize: 10, color: '#a3a3a3', overflowX: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </pre>
          </details>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
              backgroundColor: '#10b981', color: '#0a0a0a',
              fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
            }}
          >
            Try again
          </button>
          <button
            onClick={this.handleClearData}
            style={{
              padding: '10px 24px', borderRadius: 12, cursor: 'pointer',
              backgroundColor: 'transparent',
              border: '1px solid #262626',
              color: '#737373', fontSize: 13,
            }}
          >
            Reset app data
          </button>
        </div>
      </div>
    );
  }
}
