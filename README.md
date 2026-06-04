# AfterPayday

A mobile-first expense tracker built around one number — **how much is safe to spend today.**

No accounts. No sync. No backend. Just you and your money, stored locally on your device.

---

## What It Does

AfterPayday takes your monthly salary, subtracts your fixed bills and debt installments, then tracks your daily spending against whatever's left. The result is a single "safe-to-spend" figure that updates every time you log an expense.

**Core features:**

- **Safe-to-spend** — real-time calculation of spendable balance after all obligations
- **Fixed expenses** — recurring bills you mark paid each month (rent, utilities, subscriptions)
- **Installment debt** — debt groups with individual installments, due dates, and overdue tracking
- **Daily spending** — quick-add expenses by category: Food, Fuel, Shop, Other, Refund
- **Month rollover** — auto-archives the month when the date changes; unpaid items become overdue
- **Undo** — 5-second undo window after any deletion
- **Export / Import** — full JSON backup and restore
- **Onboarding** — guided first-run walkthrough

---

## Tech Stack

| Layer | Tool |
|---|---|
| UI | React 19 + Tailwind CSS v4 |
| Build | Vite 8 |
| PWA | vite-plugin-pwa + Workbox |
| Icons | Lucide React |
| Tests | Vitest |
| Storage | `localStorage` (no backend) |

---

## Getting Started

**Requirements:** Node 20.19+ or Node 22.12+

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## Installing as a PWA

AfterPayday is a fully offline-capable Progressive Web App. Install it to your home screen for a native app experience — no app store required.

### Android (Chrome)

1. Open the app in Chrome
2. Tap the **three-dot menu** (⋮) in the top right
3. Tap **"Add to Home screen"**
4. Tap **"Install"** on the prompt
5. The app appears on your home screen and opens in standalone mode

### iOS (Safari)

1. Open the app in **Safari** (must be Safari, not Chrome)
2. Tap the **Share button** (the box with an arrow ↑) at the bottom of the screen
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right
5. The app appears on your home screen

### Desktop (Chrome / Edge)

1. Open the app in Chrome or Edge
2. Look for the **install icon** (⊕) in the address bar
3. Click it and confirm **"Install"**
4. The app opens in its own window, separate from the browser

> **Tip:** Once installed, the app works fully offline. Your data is stored on your device and never sent anywhere.

---

## Project Structure

```
├── components/          # UI components (Dashboard, Commitments, etc.)
├── state/
│   └── storage.js       # localStorage persistence layer
├── utils/
│   ├── date.js          # Date helpers
│   ├── money.js         # Currency formatting
│   └── locale.js        # Locale config
├── expense-tracker.jsx  # Root app component & state
├── main.jsx             # React entry point
├── vite.config.js       # Build & PWA config
└── index.html           # HTML shell with PWA meta tags
```

---

## Deployment

The app deploys to GitHub Pages via the `.github/workflows/` pipeline. The base path is `/afterpayday/`.

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build locally
```

---

## License

MIT
