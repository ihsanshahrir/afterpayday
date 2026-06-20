// Copies the Tesseract.js runtime assets out of node_modules into
// public/tesseract/ so the OCR engine is served from our own origin (under the
// /afterpayday/ base) instead of a CDN. This keeps receipt scanning working
// offline and avoids sending anything to a third party.
//
// Runs automatically before `dev` and `build` (see package.json). The worker +
// core wasm are regenerated from the installed package version each time, so
// they are gitignored. The language model (eng.traineddata.gz) is NOT in
// node_modules — it is committed to the repo and left untouched here.

import { existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "tesseract");

// Only the LSTM core variants are needed (the worker runs with OEM 1). Both the
// SIMD and non-SIMD builds are copied so browsers without WASM SIMD still work.
const files = [
  ["tesseract.js", "dist/worker.min.js"],
  ["tesseract.js-core", "tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core", "tesseract-core-simd-lstm.wasm"],
  ["tesseract.js-core", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core", "tesseract-core-lstm.wasm"],
];

mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const [pkg, rel] of files) {
  const src = join(root, "node_modules", pkg, rel);
  if (!existsSync(src)) {
    console.error(`[copy-tesseract] missing ${pkg}/${rel} — run "npm install" first`);
    process.exitCode = 1;
    continue;
  }
  const dest = join(outDir, rel.split("/").pop());
  copyFileSync(src, dest);
  copied++;
}

const lang = join(outDir, "eng.traineddata.gz");
if (!existsSync(lang)) {
  console.error(
    "[copy-tesseract] public/tesseract/eng.traineddata.gz is missing. " +
      "It should be committed to the repo; OCR will not work without it."
  );
  process.exitCode = 1;
} else {
  console.log(`[copy-tesseract] language model present (${(statSync(lang).size / 1e6).toFixed(1)} MB)`);
}

console.log(`[copy-tesseract] copied ${copied} engine file(s) to public/tesseract/`);
