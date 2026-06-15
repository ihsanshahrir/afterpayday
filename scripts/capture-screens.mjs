import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE_URL = 'http://localhost:5173/afterpayday/';
const OUT = '/home/user/afterpayday/screenshots';
mkdirSync(OUT, { recursive: true });

const VP = { width: 390, height: 844 }; // iPhone 14 Pro

let browser;
let idx = 0;

const today = new Date().toISOString().split('T')[0];
const monthKey = today.slice(0, 7);

// ── Correct storage format (matches storage.js schema) ───────────────────────
const STORAGE_KEY = 'expense-tracker:v1';
const ONBOARDING_KEY = 'afterpayday-onboarding-done';

const sampleData = {
  _version: 2,
  settings: { salary: 5000, currency: 'MYR' },
  currentMonth: monthKey,
  fixedExpenses: [
    { id: 'f1', name: 'Rent', amount: 1200, paidMonth: null },
    { id: 'f2', name: 'Internet', amount: 89, paidMonth: null },
    { id: 'f3', name: 'Electric', amount: 150, paidMonth: monthKey },
    { id: 'f4', name: 'Water Bill', amount: 45, paidMonth: monthKey },
  ],
  debtGroups: [
    {
      id: 'd1', name: 'Car Loan',
      installments: [
        { id: 'i1', label: 'June payment', amount: 650, dueDate: today, isPaid: false, paidMonth: null },
        { id: 'i2', label: 'July payment', amount: 650, dueDate: '2026-07-15', isPaid: false, paidMonth: null },
        { id: 'i3', label: 'Aug payment', amount: 650, dueDate: '2026-08-15', isPaid: true, paidMonth: '2026-08' },
      ],
    },
    {
      id: 'd2', name: 'Personal Loan',
      installments: [
        { id: 'i4', label: 'May overdue', amount: 300, dueDate: '2026-05-20', isPaid: false, paidMonth: null },
      ],
    },
  ],
  dailyExpenses: [
    { id: 'e1', amount: 15, category: 'food', description: 'Lunch', date: today, kind: 'expense' },
    { id: 'e2', amount: 8.5, category: 'coffee', description: 'Morning coffee', date: today, kind: 'expense' },
    { id: 'e3', amount: 120, category: 'shop', description: 'Groceries', date: today, kind: 'expense' },
    { id: 'e4', amount: 60, category: 'fuel', description: 'Petrol', date: today, kind: 'expense' },
    { id: 'e5', amount: 20, category: 'other', description: 'Refund received', date: today, kind: 'refund' },
  ],
  history: [
    { id: 'h1', month: '2026-05', salary: 5000, fixedTotal: 1484, installments: 950, dailySpent: 876.5, balance: 1689.5 },
    { id: 'h2', month: '2026-04', salary: 5000, fixedTotal: 1484, installments: 950, dailySpent: 1100, balance: 1466 },
    { id: 'h3', month: '2026-03', salary: 5000, fixedTotal: 1484, installments: 950, dailySpent: 654, balance: 1912 },
  ],
};

const emptyData = {
  _version: 2,
  settings: { salary: 0, currency: 'MYR' },
  currentMonth: monthKey,
  fixedExpenses: [],
  debtGroups: [],
  dailyExpenses: [],
  history: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────
async function mkPage(data, skipOnboarding = true) {
  const ctx = await browser.newContext({ viewport: VP });
  const p = await ctx.newPage();
  await p.addInitScript(({ sk, ok, d, doSkip }) => {
    localStorage.clear();
    localStorage.setItem(sk, JSON.stringify(d));
    if (doSkip) localStorage.setItem(ok, '1');
  }, { sk: STORAGE_KEY, ok: ONBOARDING_KEY, d: data, doSkip: skipOnboarding });
  await p.goto(BASE_URL);
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(800);
  return { p, ctx };
}

async function shot(p, label) {
  idx++;
  const num = String(idx).padStart(2, '0');
  const file = `${OUT}/${num}-${label}.png`;
  await p.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${num}-${label}`);
}

async function waitMs(p, ms) { await p.waitForTimeout(ms); }

// ════════════════════════════════════════════════════════════════════════════
// 1. SPLASH SCREEN (very first frame)
// ════════════════════════════════════════════════════════════════════════════
{
  const ctx = await (await chromium.launch({ executablePath: CHROME, headless: true })).newContext({ viewport: VP });
  // Use a local browser just for splash to avoid variable hoisting
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx2 = await b.newContext({ viewport: VP });
  const p = await ctx2.newPage();
  await p.addInitScript(() => localStorage.clear());
  await p.goto(BASE_URL, { waitUntil: 'commit' });
  await waitMs(p, 150);
  await p.screenshot({ path: `${OUT}/01-splash-screen.png` });
  console.log('✓ 01-splash-screen');
  await b.close();
  await ctx.close();
  idx = 1;
}

browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ════════════════════════════════════════════════════════════════════════════
// 2–6. ONBOARDING SLIDES 1–5
// ════════════════════════════════════════════════════════════════════════════
{
  const ctx = await browser.newContext({ viewport: VP });
  const p = await ctx.newPage();
  await p.addInitScript(({ sk, d }) => {
    localStorage.clear();
    localStorage.setItem(sk, JSON.stringify(d));
    // Intentionally NOT setting onboarding key so it shows
  }, { sk: STORAGE_KEY, d: emptyData });
  await p.goto(BASE_URL);
  await p.waitForLoadState('networkidle');
  // Wait for splash to fade out
  await waitMs(p, 2800);
  await shot(p, 'onboarding-slide-1');

  for (let i = 2; i <= 5; i++) {
    // Tap the right portion of the screen to advance slide
    await p.mouse.click(330, 600);
    await waitMs(p, 600);
    await shot(p, `onboarding-slide-${i}`);
  }
  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 7. DASHBOARD — empty / no salary set
// ════════════════════════════════════════════════════════════════════════════
{
  const { p, ctx } = await mkPage(emptyData);
  await shot(p, 'dashboard-empty');
  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 8. DASHBOARD — Today view with data
// ════════════════════════════════════════════════════════════════════════════
{
  const { p, ctx } = await mkPage(sampleData);
  await shot(p, 'dashboard-today');

  // ── 9. DASHBOARD — This month toggle ────────────────────────────────────
  const monthToggle = p.locator('button').filter({ hasText: /this month/i }).first();
  if (await monthToggle.isVisible().catch(() => false)) {
    await monthToggle.click({ force: true });
    await waitMs(p, 400);
    await shot(p, 'dashboard-this-month');
    // Toggle back
    await p.locator('button').filter({ hasText: /today/i }).first().click({ force: true }).catch(() => {});
    await waitMs(p, 300);
  }

  // ── 10. ADD EXPENSE SHEET ────────────────────────────────────────────────
  await p.locator('button[aria-label="Add expense"]').click();
  await waitMs(p, 500);
  await shot(p, 'add-expense-sheet');
  await p.keyboard.press('Escape');
  await waitMs(p, 400);

  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 11. COMMITMENTS — overview
// ════════════════════════════════════════════════════════════════════════════
{
  const { p, ctx } = await mkPage(sampleData);
  // Click Commitments tab (second tab)
  await p.locator('nav[aria-label="Primary"] button').nth(1).click();
  await waitMs(p, 600);
  await shot(p, 'commitments-overview');

  // ── 12. DEBT GROUP expanded ──────────────────────────────────────────────
  // Debt group cards are toggleable — find "Car Loan" group toggle
  const debtCard = p.locator('button, [role="button"]').filter({ hasText: /car loan/i }).first();
  if (await debtCard.isVisible().catch(() => false)) {
    await debtCard.click();
    await waitMs(p, 500);
    await shot(p, 'commitments-debt-group-expanded');
  }

  // ── 13. DATE PICKER MODAL ────────────────────────────────────────────────
  // Click a due date field inside an installment row
  const dateBtn = p.locator('button').filter({ hasText: /jun|jul|2026|\d{1,2}\/\d{1,2}\/\d{4}/i }).first();
  if (await dateBtn.isVisible().catch(() => false)) {
    await dateBtn.click();
    await waitMs(p, 600);
    const dialog = p.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      await shot(p, 'date-picker-modal');
      await p.keyboard.press('Escape');
      await waitMs(p, 400);
    }
  }

  // ── 14. MANUAL INSTALLMENT FORM ─────────────────────────────────────────
  // Look for "Add" button inside the expanded debt group
  const addInstBtn = p.locator('button').filter({ hasText: /add installment|add payment|\+ (install|payment)/i }).first();
  if (await addInstBtn.isVisible().catch(() => false)) {
    await addInstBtn.click();
    await waitMs(p, 600);
    await shot(p, 'manual-installment-form');
    await p.keyboard.press('Escape');
    await waitMs(p, 400);
  } else {
    // Sometimes there's just a small + button
    const allBtns = p.locator('button');
    const count = await allBtns.count();
    for (let i = 0; i < count; i++) {
      const txt = (await allBtns.nth(i).textContent() || '').trim();
      const box = await allBtns.nth(i).boundingBox().catch(() => null);
      if (txt === '+' && box && box.y > 400) {
        await allBtns.nth(i).click();
        await waitMs(p, 600);
        await shot(p, 'manual-installment-form');
        await p.keyboard.press('Escape');
        await waitMs(p, 400);
        break;
      }
    }
  }

  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 15. NEW DEBT GROUP FORM
// ════════════════════════════════════════════════════════════════════════════
{
  const { p, ctx } = await mkPage(sampleData);
  await p.locator('nav[aria-label="Primary"] button').nth(1).click();
  await waitMs(p, 600);

  // Find "Add debt" or "+ New debt group" button
  let opened = false;
  const btns = p.locator('button');
  const count = await btns.count();
  for (let i = 0; i < count; i++) {
    const txt = (await btns.nth(i).textContent() || '').toLowerCase();
    if (txt.includes('debt') || txt.includes('add group') || txt.includes('new group')) {
      await btns.nth(i).click();
      opened = true;
      break;
    }
  }
  if (!opened) {
    // Scroll down and look for + in debt section
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await waitMs(p, 300);
    for (let i = count - 1; i >= 0; i--) {
      const txt = (await btns.nth(i).textContent() || '').trim();
      const box = await btns.nth(i).boundingBox().catch(() => null);
      if (txt === '+' && box) {
        await btns.nth(i).click();
        opened = true;
        break;
      }
    }
  }
  await waitMs(p, 700);
  await shot(p, 'new-debt-group-form');
  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 16. ADD FIXED EXPENSE (inline form or modal)
// ════════════════════════════════════════════════════════════════════════════
{
  const { p, ctx } = await mkPage(sampleData);
  await p.locator('nav[aria-label="Primary"] button').nth(1).click();
  await waitMs(p, 600);

  // The "add fixed expense" button is usually at the top
  const btns = p.locator('button');
  const count = await btns.count();
  for (let i = 0; i < count; i++) {
    const txt = (await btns.nth(i).textContent() || '').toLowerCase();
    const box = await btns.nth(i).boundingBox().catch(() => null);
    if ((txt.includes('fixed') || txt.includes('bill') || txt === '+') && box && box.y < 400) {
      await btns.nth(i).click();
      break;
    }
  }
  await waitMs(p, 700);
  await shot(p, 'add-fixed-expense-form');
  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 17. SETTINGS SHEET
// ════════════════════════════════════════════════════════════════════════════
{
  const { p, ctx } = await mkPage(sampleData);
  await p.locator('button[aria-label="Settings"]').click();
  await waitMs(p, 600);
  await shot(p, 'settings-sheet');
  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 18. HISTORY SHEET
// ════════════════════════════════════════════════════════════════════════════
{
  const { p, ctx } = await mkPage(sampleData);
  await p.locator('button[aria-label="History"]').click();
  await waitMs(p, 600);
  await shot(p, 'history-sheet');
  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 19. ONBOARDING / HELP SHEET (re-opened via ? button)
// ════════════════════════════════════════════════════════════════════════════
{
  const { p, ctx } = await mkPage(sampleData);
  const helpBtn = p.locator('button[aria-label="Help"]');
  if (await helpBtn.isVisible().catch(() => false)) {
    await helpBtn.click();
    await waitMs(p, 700);
    await shot(p, 'help-onboarding-reopened');
  }
  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 20. UNDO TOAST — after deleting a daily expense
// ════════════════════════════════════════════════════════════════════════════
{
  const { p, ctx } = await mkPage(sampleData);
  // Find delete buttons on expense items
  const delBtn = p.locator('button[aria-label*="delete" i], button[aria-label*="remove" i]').first();
  if (await delBtn.isVisible().catch(() => false)) {
    await delBtn.click();
    await waitMs(p, 200);
    await shot(p, 'undo-toast');
  } else {
    // Try last button in expense list
    const listBtns = p.locator('ul button, ol button, [class*="list"] button');
    const cnt = await listBtns.count();
    if (cnt > 0) {
      await listBtns.nth(cnt - 1).click();
      await waitMs(p, 200);
      await shot(p, 'undo-toast');
    }
  }
  await ctx.close();
}

// ════════════════════════════════════════════════════════════════════════════
// 21. ERROR BOUNDARY (inject an error)
// ════════════════════════════════════════════════════════════════════════════
// Skip — hard to trigger reliably without modifying source code

await browser.close();
console.log(`\nDone! ${idx} screenshots saved to ${OUT}/`);
