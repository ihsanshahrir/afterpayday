// Lazy, self-hosted Tesseract.js wrapper.
//
// tesseract.js (and its ~MB wasm core + language data) is dynamically imported
// only when the user first scans, so it never weighs down the initial bundle.
// All engine assets are served from `${BASE_URL}tesseract/` — no CDN is hit, so
// scanning keeps the app's offline/"nothing leaves the device" promise once the
// assets have been cached (see the Workbox rule in vite.config.js).

// SHA-256 of public/tesseract/eng.traineddata.gz as committed, plus the hash
// of its gunzipped payload. verifyModel() accepts either: servers that mark
// the file `Content-Encoding: gzip` (e.g. the Vite dev server) make fetch()
// hand back the decompressed bytes, which would otherwise fail the check and
// break scanning even though the served content is exactly what's pinned.
const MODEL_SHA256 =
  "2336abc91428f3842f81f92c9c8390a9b5c01ec9c5f56a738d6d8f587ef40771";
const MODEL_RAW_SHA256 =
  "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2";

let workerPromise = null;
// scanLock enforces single-scan-at-a-time at the module boundary (the UI also
// disables the button, but this makes the contract explicit for callers).
let scanLock = false;
let activeProgress = null;

const assetBase = () => `${import.meta.env.BASE_URL}tesseract/`;

async function verifyModel(base) {
  let resp;
  try {
    resp = await fetch(`${base}eng.traineddata.gz`);
  } catch {
    return; // offline / network failure — SW cache will serve the model; skip check
  }
  if (!resp.ok) return;
  const buf = await resp.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(hashBuf), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  if (hex !== MODEL_SHA256 && hex !== MODEL_RAW_SHA256) {
    throw new Error(
      "OCR language model integrity check failed — the model file does not match the expected hash"
    );
  }
}

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const base = assetBase();
      await verifyModel(base);
      const { createWorker } = await import("tesseract.js");
      return createWorker("eng", 1, {
        workerPath: `${base}worker.min.js`,
        corePath: base,
        langPath: base,
        logger: (m) => {
          if (m && m.status === "recognizing text" && typeof m.progress === "number") {
            activeProgress?.(m.progress);
          }
        },
      });
    })().catch((err) => {
      workerPromise = null; // let a later scan retry from scratch
      throw err;
    });
  }
  return workerPromise;
}

// Run OCR on a canvas/blob/image and return the raw recognized text.
// `onProgress` receives a 0..1 fraction while recognizing.
export async function recognizeReceipt(image, onProgress) {
  if (scanLock) throw new Error("A scan is already in progress");
  scanLock = true;
  activeProgress = onProgress ?? null;
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return (data && data.text) || "";
  } finally {
    scanLock = false;
    activeProgress = null;
  }
}
