import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './expense-tracker.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import './glass.css'
// Side-effect only: attaches the beforeinstallprompt/appinstalled listeners
// before React mounts, since Chrome can fire the event during first paint.
import './utils/installPrompt.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
