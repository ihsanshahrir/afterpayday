// Uptime probe for everything AfterPayday depends on at runtime. Run by
// .github/workflows/uptime.yml on a schedule; also runnable locally:
//
//   SITE_URL=https://you.github.io/afterpayday/ \
//   SUPABASE_URL=https://ref.supabase.co SUPABASE_ANON_KEY=... \
//   node scripts/uptime-check.mjs
//
// Each check is optional on its inputs (a build without cloud sync or Smart
// Scan skips those). Exits 1 if any configured check fails, and appends a
// markdown table to $GITHUB_STEP_SUMMARY when running in Actions.
import { appendFileSync } from "node:fs";

const { SITE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SCAN_PROXY_URL, GITHUB_STEP_SUMMARY } = process.env;
const TIMEOUT_MS = 15_000;
const ATTEMPTS = 3; // a single blip shouldn't page anyone

async function get(url, init = {}) {
  let lastErr;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      return await fetch(url, { redirect: "follow", ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

const expectStatus = (res, ...ok) => {
  if (!ok.includes(res.status)) throw new Error(`HTTP ${res.status}`);
};

const checks = [];
const check = (name, enabled, fn) => checks.push({ name, enabled, fn });

let entryScript = null;

check("Site: app shell", Boolean(SITE_URL), async () => {
  const res = await get(SITE_URL);
  expectStatus(res, 200);
  const html = await res.text();
  if (!html.includes('id="root"')) throw new Error("HTML has no #root — wrong page served?");
  entryScript = html.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1];
  if (!entryScript) throw new Error("No entry <script type=module> in HTML");
  return `HTTP ${res.status}`;
});

check("Site: entry bundle", Boolean(SITE_URL), async () => {
  if (!entryScript) throw new Error("skipped — app shell check failed");
  const res = await get(new URL(entryScript, SITE_URL));
  expectStatus(res, 200);
  return `HTTP ${res.status}`;
});

check("Site: service worker", Boolean(SITE_URL), async () => {
  const res = await get(new URL("sw.js", SITE_URL));
  expectStatus(res, 200);
  return `HTTP ${res.status}`;
});

const sbHeaders = { apikey: SUPABASE_ANON_KEY || "" };
const sbEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

check("Supabase: auth", sbEnabled, async () => {
  const res = await get(`${SUPABASE_URL}/auth/v1/health`, { headers: sbHeaders });
  expectStatus(res, 200);
  return `HTTP ${res.status}`;
});

// Reaches Postgres itself: a paused project fails here even when the API
// gateway still answers. RLS means anon always gets [] back.
check("Supabase: database", sbEnabled, async () => {
  const res = await get(`${SUPABASE_URL}/rest/v1/app_state?select=user_id&limit=1`, { headers: sbHeaders });
  expectStatus(res, 200);
  return `HTTP ${res.status}`;
});

// CORS preflight only — never spends model credits.
check("Smart Scan proxy", Boolean(SCAN_PROXY_URL), async () => {
  const origin = SITE_URL ? new URL(SITE_URL).origin : "";
  const res = await get(SCAN_PROXY_URL, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
  });
  expectStatus(res, 204);
  return `HTTP ${res.status}`;
});

const rows = [];
let failed = 0;
for (const { name, enabled, fn } of checks) {
  if (!enabled) {
    rows.push([name, "⚪ skipped", "not configured"]);
    continue;
  }
  const t0 = Date.now();
  try {
    const detail = await fn();
    rows.push([name, "🟢 up", `${detail} · ${Date.now() - t0} ms`]);
  } catch (err) {
    failed++;
    rows.push([name, "🔴 DOWN", err?.message || String(err)]);
  }
}

for (const [name, status, detail] of rows) console.log(`${status.padEnd(10)} ${name.padEnd(24)} ${detail}`);

if (GITHUB_STEP_SUMMARY) {
  const table = ["| Check | Status | Detail |", "|---|---|---|", ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
  appendFileSync(GITHUB_STEP_SUMMARY, `${table}\n`);
}

if (!rows.some((r) => r[1] !== "⚪ skipped")) {
  console.error("No checks configured — set SITE_URL and/or SUPABASE_URL + SUPABASE_ANON_KEY.");
  process.exit(1);
}
process.exit(failed ? 1 : 0);
