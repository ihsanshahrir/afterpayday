// Lazy, self-hosted Tesseract.js wrapper.
//
// tesseract.js (and its ~MB wasm core + language data) is dynamically imported
// only when the user first scans, so it never weighs down the initial bundle.
// All engine assets are served from `${BASE_URL}tesseract/` — no CDN is hit, so
// scanning keeps the app's offline/"nothing leaves the device" promise once the
// assets have been cached (see the Workbox rule in vite.config.js).

let workerPromise = null;
let currentProgress = null;

const assetBase = () => `${import.meta.env.BASE_URL}tesseract/`;

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const base = assetBase();
      return createWorker("eng", 1, {
        workerPath: `${base}worker.min.js`,
        corePath: base,
        langPath: base,
        logger: (m) => {
          if (m && m.status === "recognizing text" && typeof m.progress === "number") {
            currentProgress?.(m.progress);
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
  currentProgress = onProgress || null;
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return (data && data.text) || "";
  } finally {
    currentProgress = null;
  }
}
