// Bundle-size budget for the production build. Run after `npm run build`
// (CI does this on every PR). Fails if the first-load payload or the service
// worker precache outgrows its budget, or if something that is deliberately
// lazy (the Supabase client, the Tesseract OCR engine) ends up precached for
// every install.
//
// Budgets carry ~10% headroom over the sizes after the 2026-09 audit. Raise
// one only on purpose, in the same PR as the change that needs it.
import { readFileSync, statSync, appendFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const BUDGETS = {
  initialJsGzipKiB: 100, // entry chunk + its modulepreloads (was 88.9)
  cssGzipKiB: 13, //                                          (was 10.6)
  precacheKiB: 620, // everything the SW downloads on install (was 557)
};

const DIST = "dist";
const html = readFileSync(join(DIST, "index.html"), "utf8");
const base = html.match(/src="(\/[^"]*?)assets\//)?.[1] ?? "/";
const toFile = (url) => join(DIST, url.startsWith(base) ? url.slice(base.length) : url);
const gzipKiB = (file) => gzipSync(readFileSync(file), { level: 9 }).length / 1024;

const initialJs = [
  ...html.matchAll(/<script type="module"[^>]*src="([^"]+)"/g),
  ...html.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"/g),
].map((m) => m[1]);
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);

const sw = readFileSync(join(DIST, "sw.js"), "utf8");
const precache = [...new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]))];

const initialJsKiB = initialJs.reduce((n, u) => n + gzipKiB(toFile(u)), 0);
const cssKiB = css.reduce((n, u) => n + gzipKiB(toFile(u)), 0);
const precacheKiB = precache.reduce((n, u) => n + statSync(join(DIST, u)).size, 0) / 1024;

const rows = [
  ["First-load JS (gzip)", initialJsKiB, BUDGETS.initialJsGzipKiB, "KiB"],
  ["CSS (gzip)", cssKiB, BUDGETS.cssGzipKiB, "KiB"],
  ["SW precache (raw)", precacheKiB, BUDGETS.precacheKiB, "KiB"],
].map(([name, size, budget, unit]) => ({ name, size, budget, unit, ok: size <= budget }));

const leaks = precache.filter((u) => /(^|\/)supabase-[^/]+\.js$|tesseract/.test(u));

let failed = rows.some((r) => !r.ok) || leaks.length > 0;
for (const r of rows) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.name.padEnd(22)} ${r.size.toFixed(1).padStart(7)} / ${r.budget} ${r.unit}`);
}
if (leaks.length) console.log(`✗ Lazy-only assets precached: ${leaks.join(", ")}`);
if (!initialJs.length || !precache.length) {
  console.log("✗ Couldn't find the entry script or precache manifest — did the build change shape?");
  failed = true;
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const table = [
    "| Metric | Size | Budget | |",
    "|---|---:|---:|---|",
    ...rows.map((r) => `| ${r.name} | ${r.size.toFixed(1)} ${r.unit} | ${r.budget} ${r.unit} | ${r.ok ? "✅" : "❌"} |`),
    ...(leaks.length ? [`| Lazy-only assets precached | ${leaks.join(", ")} | none | ❌ |`] : []),
  ].join("\n");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Bundle size\n\n${table}\n`);
}

process.exit(failed ? 1 : 0);
