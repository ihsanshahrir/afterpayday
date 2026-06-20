// Prepare a user-selected image for OCR. Phone photos are often 12MP; OCR is
// far faster and more reliable on a smaller, grayscale, contrast-boosted
// bitmap. Returns an HTMLCanvasElement ready to hand to Tesseract.
export async function downscaleToCanvas(file, maxDim = 1600) {
  const source = await loadImage(file);
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  if (source.close) source.close(); // release ImageBitmap memory

  // Grayscale + a light contrast stretch sharpens faint thermal-print text.
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const contrast = 1.2;
    for (let i = 0; i < d.length; i += 4) {
      let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      g = (g - 128) * contrast + 128;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    // getImageData can throw on tainted canvases; the raw draw still OCRs fine.
  }
  return canvas;
}

async function loadImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari can reject some files here; fall back to an <img>.
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
