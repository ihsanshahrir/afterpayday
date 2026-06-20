import { daysInMonth } from "./date.js";

// Turn raw OCR text from a receipt into the fields the Add sheet needs.
// Everything here is pure and string-only so it can be unit-tested without a
// browser, and so the OCR engine stays a swappable detail.

// ---------- money ----------

// A price token: 1+ leading digits, optional thousands groups, and a 2-digit
// decimal. The trailing lookaheads stop us from biting into a longer number or
// a date (e.g. the "31.12" in "31.12.2024").
const PRICE_RE = /\d{1,3}(?:[.,]?\d{3})*[.,]\d{2}(?!\d)(?![.,/-]\d)/g;

// Normalise a raw price string ("1,234.56", "1.234,56", "12,50", "45000.00")
// into a Number. The last separator followed by 1-2 digits is the decimal
// point; any earlier separators are thousands groupings and dropped.
export function normalizeMoney(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  let intPart, fracPart;
  if (lastSep === -1) {
    intPart = s;
    fracPart = "";
  } else {
    const decimals = s.length - lastSep - 1;
    if (decimals >= 1 && decimals <= 2) {
      intPart = s.slice(0, lastSep).replace(/[.,]/g, "");
      fracPart = s.slice(lastSep + 1);
    } else {
      intPart = s.replace(/[.,]/g, "");
      fracPart = "";
    }
  }
  const n = Number(fracPart ? `${intPart}.${fracPart}` : intPart);
  return Number.isFinite(n) ? n : null;
}

function priceTokens(line) {
  const out = [];
  const matches = String(line).match(PRICE_RE);
  if (matches) {
    for (const m of matches) {
      const n = normalizeMoney(m);
      if (n !== null && n > 0) out.push(n);
    }
  }
  return out;
}

// Lines that name the grand total. Plain "total" is included; the negative set
// below filters out the look-alikes (subtotal, change, tax, etc.).
const TOTAL_RE = /grand\s*total|amount\s*(?:due|payable)|balance\s*due|nett?\s*total|net\s*total|\btotal\b|jumlah|bayar/i;
const NOT_TOTAL_RE = /sub[\s-]*total|change|tender|\bcash\b|tunai|baki|kembali|round|discount|\bdisc\b|saving|\bqty\b|\bpoints?\b|balance\s*[bc]\/?f/i;

// The total is the largest price on a line that mentions a total keyword (and
// isn't a subtotal/change/tax line). If no such line exists, fall back to the
// largest price anywhere — on a receipt that is almost always the total.
export function parseAmount(text) {
  const lines = String(text || "").split(/\r?\n/);

  let best = null;
  for (const line of lines) {
    if (!TOTAL_RE.test(line) || NOT_TOTAL_RE.test(line)) continue;
    for (const t of priceTokens(line)) {
      if (best === null || t > best) best = t;
    }
  }
  if (best !== null) return best;

  for (const line of lines) {
    for (const t of priceTokens(line)) {
      if (best === null || t > best) best = t;
    }
  }
  return best;
}

// ---------- date ----------

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const expandYear = (y) => {
  const n = Number(y);
  return n < 100 ? n + 2000 : n;
};

const validYMD = (y, m, d) =>
  Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) &&
  y >= 2000 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(m, y);

// Build the ISO string directly rather than via Date, matching the codebase's
// deliberate timezone-safe approach (see utils/date.js).
const toISO = (y, m, d) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const monthNum = (word) => MONTHS[String(word).slice(0, 3).toLowerCase()];

// Returns "YYYY-MM-DD" or null. Day-first is assumed for ambiguous numeric
// dates (DD/MM/YYYY) since the app's default locale is non-US.
export function parseDate(text) {
  const t = String(text || "");
  let m;

  // ISO-ish: 2026-06-20, 2026/06/20, 2026.06.20
  m = t.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) {
    const y = expandYear(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (validYMD(y, mo, d)) return toISO(y, mo, d);
  }

  // Numeric DD/MM/YYYY (default) or MM/DD/YYYY when the first field can't be a day.
  m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), y = expandYear(m[3]);
    let d = a, mo = b;
    if (a <= 12 && b > 12) { d = b; mo = a; }
    if (validYMD(y, mo, d)) return toISO(y, mo, d);
  }

  // Textual: "12 Jun 2026", "12-Jun-2026"
  m = t.match(/\b(\d{1,2})[\s.-]+([A-Za-z]{3,})[a-z]*[\s,.-]+(20\d{2}|\d{2})\b/);
  if (m && monthNum(m[2])) {
    const d = Number(m[1]), mo = monthNum(m[2]), y = expandYear(m[3]);
    if (validYMD(y, mo, d)) return toISO(y, mo, d);
  }

  // Textual: "Jun 12, 2026"
  m = t.match(/\b([A-Za-z]{3,})[a-z]*[\s.]+(\d{1,2})[\s,]+(20\d{2}|\d{2})\b/);
  if (m && monthNum(m[1])) {
    const mo = monthNum(m[1]), d = Number(m[2]), y = expandYear(m[3]);
    if (validYMD(y, mo, d)) return toISO(y, mo, d);
  }

  return null;
}

// ---------- merchant ----------

// Header lines that are clearly not the store name.
const SKIP_LINE_RE = /receipt|invoice|tax\s*inv|\bgst\b|\bsst\b|\btel\b|tel[:.]|phone|\bfax\b|www\.|https?:|@|\bno\.?\s*\d|reg\.?\s*no|co\.?\s*reg|address|jalan|street|\bunit\b|\blot\b/i;

const cleanMerchant = (line) => {
  let out = line.replace(/[*_=|]{2,}/g, " ").replace(/\s{2,}/g, " ").trim();
  // Receipts often print the name in all-caps; title-case it for readability,
  // but leave mixed-case names (e.g. "McDonald's") untouched.
  if (out && out === out.toUpperCase()) {
    out = out.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
  }
  return out;
};

// The store name is almost always one of the first lines and is text, not
// numbers. Take the first "name-like" line.
export function parseMerchant(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 6)) {
    if (line.length < 2 || line.length > 40) continue;
    const letters = (line.match(/[A-Za-z]/g) || []).length;
    const digits = (line.match(/\d/g) || []).length;
    if (letters < 2 || digits > letters) continue;
    if (SKIP_LINE_RE.test(line)) continue;
    if (/^[\d\s.,:/-]+$/.test(line)) continue;
    return cleanMerchant(line);
  }
  return "";
}

// ---------- category ----------

// Maps a merchant / receipt body to one of the app's spending categories.
// Refund is intentionally excluded — a scanned receipt is always an expense.
const CATEGORY_KEYWORDS = [
  ["fuel", /\b(shell|petronas|petron|caltex|esso|bhp|mobil|chevron|petrol|diesel|fuel|gasolin\w*|minyak|service\s*station)\b/i],
  ["food", /\b(restoran|restaurant|cafe|caf[eé]|kopitiam|mamak|kitchen|\bfood\b|makan|nasi|\bmee\b|kfc|mcd|mcdonald\w*|burger|pizza|bakery|bake\w*|coffee|\bkopi\b|starbucks|tealive|bistro|eatery|dining|grill|steak|sushi|ramen|warung|catering)\b/i],
  ["shop", /\b(mart|store|supermarket|hypermarket|hyper|\bmall\b|grocer\w*|tesco|lotus|aeon|mydin|giant|speedmart|emporium|watson|guardian|pharmacy|farmasi|sundry|hardware|stationer\w*|bookstore|electronic\w*|boutique|apparel|department)\b/i],
];

export function guessCategory(merchant = "", fullText = "") {
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(merchant)) return cat;
  }
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(fullText)) return cat;
  }
  return "other";
}

// ---------- entry point ----------

export function parseReceiptText(text) {
  const merchant = parseMerchant(text);
  return {
    amount: parseAmount(text),
    description: merchant,
    category: guessCategory(merchant, text),
    date: parseDate(text),
  };
}
