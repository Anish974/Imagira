export interface EnhanceOptions {
  enabled: boolean;
  sharpen: number; // 0 to 100
  defringe: number; // 0 to 100
  contrast: number; // -50 to 50
  brightness: number; // -50 to 50
  upscale2x: boolean;
}

export const DEFAULT_ENHANCE_OPTIONS: EnhanceOptions = {
  enabled: false,
  sharpen: 35,
  defringe: 40,
  contrast: 10,
  brightness: 0,
  upscale2x: false,
};

/**
 * Applies a 3x3 unsharp mask kernel to sharpen image details without amplifying noise.
 */
export function sharpenImageData(imageData: ImageData, strengthPercent: number): ImageData {
  if (strengthPercent <= 0) return imageData;
  const factor = (strengthPercent / 100) * 0.8;
  const { width, height, data } = imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const dst = out.data;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha === 0) continue; // skip transparent pixels

      for (let c = 0; c < 3; c++) {
        const center = data[idx + c];
        const up = data[((y - 1) * width + x) * 4 + c];
        const down = data[((y + 1) * width + x) * 4 + c];
        const left = data[(y * width + (x - 1)) * 4 + c];
        const right = data[(y * width + (x + 1)) * 4 + c];

        // Laplacian high-pass difference
        const laplacian = 4 * center - (up + down + left + right);
        const sharpened = center + laplacian * factor;
        dst[idx + c] = Math.min(255, Math.max(0, Math.round(sharpened)));
      }
    }
  }
  return out;
}

/**
 * Cleans background color bleed / fringe along cutout alpha edges.
 */
export function deFringeImageData(imageData: ImageData, strengthPercent: number): ImageData {
  if (strengthPercent <= 0) return imageData;
  const factor = strengthPercent / 100;
  const { width, height, data } = imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const dst = out.data;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      // Focus on semi-transparent transition pixels (edges)
      if (alpha > 0 && alpha < 250) {
        // Find maximum alpha neighbor (true interior color)
        let maxAlpha = 0;
        let bestIdx = idx;

        const neighbors = [
          ((y - 1) * width + x) * 4,
          ((y + 1) * width + x) * 4,
          (y * width + (x - 1)) * 4,
          (y * width + (x + 1)) * 4,
        ];

        for (const nIdx of neighbors) {
          if (data[nIdx + 3] > maxAlpha) {
            maxAlpha = data[nIdx + 3];
            bestIdx = nIdx;
          }
        }

        if (maxAlpha > 200) {
          // Blend edge RGB towards interior neighbor's RGB to kill halo
          for (let c = 0; c < 3; c++) {
            const edgeVal = data[idx + c];
            const innerVal = data[bestIdx + c];
            dst[idx + c] = Math.round(edgeVal * (1 - factor) + innerVal * factor);
          }
        }
      }
    }
  }
  return out;
}

/**
 * Adjusts contrast and brightness for subject vibrance.
 */
export function adjustClarityAndContrast(
  imageData: ImageData,
  contrast: number,
  brightness: number
): ImageData {
  if (contrast === 0 && brightness === 0) return imageData;
  const { width, height, data } = imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const dst = out.data;

  // Contrast factor formula
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // keep transparent background

    for (let c = 0; c < 3; c++) {
      const val = data[i + c];
      const adjusted = factor * (val - 128) + 128 + brightness;
      dst[i + c] = Math.min(255, Math.max(0, Math.round(adjusted)));
    }
  }
  return out;
}

/**
 * Resamples canvas 2x with high-quality smoothing and subtle sharpness recovery.
 */
export function upscaleCanvas2x(source: HTMLCanvasElement): HTMLCanvasElement {
  const target = document.createElement('canvas');
  target.width = source.width * 2;
  target.height = source.height * 2;
  const ctx = target.getContext('2d');
  if (!ctx) return source;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, target.width, target.height);

  // Apply subtle sharpness after upscaling to retain crisp HD edges
  const imgData = ctx.getImageData(0, 0, target.width, target.height);
  const sharpened = sharpenImageData(imgData, 25);
  ctx.putImageData(sharpened, 0, 0);

  return target;
}

/**
 * Pipeline that executes all selected image enhancements.
 */
export function applyEnhancements(
  sourceCanvas: HTMLCanvasElement,
  options: EnhanceOptions
): HTMLCanvasElement {
  if (!options.enabled && !options.upscale2x) {
    return sourceCanvas;
  }

  let canvas = sourceCanvas;

  if (options.upscale2x) {
    canvas = upscaleCanvas2x(canvas);
  }

  if (!options.enabled) {
    return canvas;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (options.defringe > 0) {
    imgData = deFringeImageData(imgData, options.defringe);
  }

  if (options.contrast !== 0 || options.brightness !== 0) {
    imgData = adjustClarityAndContrast(imgData, options.contrast, options.brightness);
  }

  if (options.sharpen > 0) {
    imgData = sharpenImageData(imgData, options.sharpen);
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = canvas.width;
  outCanvas.height = canvas.height;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.putImageData(imgData, 0, 0);

  return outCanvas;
}
