import { CONFIG, type Config } from './config.ts';
import { rgbLabDistance, type Lab } from './colour.ts';

const UNSEEN = 0;
const REJECTED = 1;
const FILLED = 2;

/**
 * LAB conversion costs three cbrt() calls, and the fill runs it on every pixel
 * it touches — millions on a large image. Cache the distance in 6-bit-per-channel
 * buckets so repeated colours (most of a photo) cost two array reads instead.
 *
 * ponytail: quantising to 4 RGB levels shifts the measured distance by ~1-2 LAB
 * units against a tolerance of 24, i.e. it nudges an already-tunable threshold.
 * Drop QUANT_SHIFT to 1 if edge fringing ever traces back to this.
 */
const QUANT_SHIFT = 2;
const CACHE_SIZE = 1 << (3 * (8 - QUANT_SHIFT));

function makeDistanceFn(bgLab: Lab): (r: number, g: number, b: number) => number {
  const dist = new Float32Array(CACHE_SIZE);
  const known = new Uint8Array(CACHE_SIZE);
  const half = 1 << (QUANT_SHIFT - 1);

  return (r, g, b) => {
    const qr = r >> QUANT_SHIFT;
    const qg = g >> QUANT_SHIFT;
    const qb = b >> QUANT_SHIFT;
    const key = (qr << (2 * (8 - QUANT_SHIFT))) | (qg << (8 - QUANT_SHIFT)) | qb;
    if (known[key] === 1) return dist[key];
    // Measure from the bucket centre so the result never depends on visit order.
    const d = rgbLabDistance(
      (qr << QUANT_SHIFT) + half,
      (qg << QUANT_SHIFT) + half,
      (qb << QUANT_SHIFT) + half,
      bgLab
    );
    dist[key] = d;
    known[key] = 1;
    return d;
  };
}

/**
 * Spec §3.2 — iterative BFS flood fill seeded from the border.
 *
 * NOT a global colour threshold. The fill only spreads through pixels
 * *connected* to the image edge, so a white shirt enclosed by the subject is
 * unreachable and survives. That is the whole correctness bar for Path A.
 *
 * Returns a hard alpha mask: 0 = removed background, 255 = kept subject.
 */
export function floodFillMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgLab: Lab,
  cfg: Config = CONFIG
): Uint8Array {
  const n = width * height;
  const state = new Uint8Array(n);
  // ponytail: queue is sized for the worst case (every pixel is background).
  // 4 bytes/px, so 64 MB on a 4000x4000 image. Swap for a chunked/ring queue
  // only if memory actually becomes the failure mode.
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const tolerance = cfg.FLOOD_TOLERANCE;
  const distanceTo = makeDistanceFn(bgLab);

  const tryPush = (idx: number): void => {
    if (state[idx] !== UNSEEN) return;
    const p = idx * 4;
    if (distanceTo(data[p], data[p + 1], data[p + 2]) <= tolerance) {
      state[idx] = FILLED;
      queue[tail++] = idx;
    } else {
      state[idx] = REJECTED;
    }
  };

  // Seed: every border pixel that matches the background colour.
  for (let x = 0; x < width; x++) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    tryPush(y * width);
    tryPush(y * width + width - 1);
  }

  // BFS, 4-connectivity. Iterative — recursion blows the stack on big images.
  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 0) tryPush(idx - 1);
    if (x < width - 1) tryPush(idx + 1);
    if (y > 0) tryPush(idx - width);
    if (y < height - 1) tryPush(idx + width);
  }

  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = state[i] === FILLED ? 0 : 255;
  return mask;
}

/**
 * Spec §3.3 — shrink the kept region by `px` pixels so background-coloured
 * fringe pixels along the cut get pulled in before blurring.
 *
 * Out-of-bounds counts as kept, so the image border is never shaved when
 * nothing was removed there.
 */
export function erodeMask(mask: Uint8Array, width: number, height: number, px: number): Uint8Array {
  let src = mask;
  for (let pass = 0; pass < px; pass++) {
    const out = new Uint8Array(src);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (src[i] === 0) continue;
        const up = y > 0 ? src[i - width] : 255;
        const down = y < height - 1 ? src[i + width] : 255;
        const left = x > 0 ? src[i - 1] : 255;
        const right = x < width - 1 ? src[i + 1] : 255;
        if (up === 0 || down === 0 || left === 0 || right === 0) out[i] = 0;
      }
    }
    src = out;
  }
  return src;
}

/**
 * Spec §3.3 — soften the alpha channel ONLY. Never touch RGB: blurring colour
 * is what produces a smeared halo.
 *
 * A true separable gaussian over the whole mask costs ~230ms on a 2000x2000
 * image, which blows the 100ms budget on its own. But the mask is flat 0 or 255
 * nearly everywhere, and a gaussian over a uniform neighbourhood returns that
 * same value — so only the band around a 0/255 transition can change. We flag
 * that band and run the exact kernel there. Same output, a fraction of the work.
 *
 *   flag 2 = within `radius` of a transition -> needs the vertical pass
 *   flag 1 = within `2 * radius`             -> only feeds the vertical pass
 */
export function blurAlpha(
  mask: Uint8Array,
  width: number,
  height: number,
  sigma: number
): Uint8Array {
  if (sigma <= 0) return mask;

  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const kernel = new Float64Array(size);
  let total = 0;
  for (let k = -radius; k <= radius; k++) {
    const v = Math.exp(-(k * k) / (2 * sigma * sigma));
    kernel[k + radius] = v;
    total += v;
  }
  for (let k = 0; k < size; k++) kernel[k] /= total;

  const n = width * height;
  const flag = new Uint8Array(n);
  const band = radius * 2;

  // Flag the band around every transition.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = mask[i];
      const edge =
        (x < width - 1 && mask[i + 1] !== v) || (y < height - 1 && mask[i + width] !== v);
      if (!edge) continue;

      const y0 = Math.max(0, y - band);
      const y1 = Math.min(height - 1, y + band + 1);
      const x0 = Math.max(0, x - band);
      const x1 = Math.min(width - 1, x + band + 1);
      for (let sy = y0; sy <= y1; sy++) {
        const near = sy >= y - radius && sy <= y + radius + 1;
        const row = sy * width;
        for (let sx = x0; sx <= x1; sx++) {
          const level = near && sx >= x - radius && sx <= x + radius + 1 ? 2 : 1;
          if (flag[row + sx] < level) flag[row + sx] = level;
        }
      }
    }
  }

  // Horizontal pass, flagged pixels only.
  const tmp = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      if (flag[i] === 0) continue;
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = x + k < 0 ? 0 : x + k > width - 1 ? width - 1 : x + k;
        acc += mask[row + sx] * kernel[k + radius];
      }
      tmp[i] = acc;
    }
  }

  // Vertical pass. Everything outside the band keeps its hard value.
  const out = new Uint8Array(mask);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (flag[i] !== 2) continue;
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = y + k < 0 ? 0 : y + k > height - 1 ? height - 1 : y + k;
        acc += tmp[sy * width + x] * kernel[k + radius];
      }
      out[i] = acc < 0 ? 0 : acc > 255 ? 255 : acc;
    }
  }

  return out;
}

/** Path A end to end: fill, erode, soften. */
export function buildAlphaMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgLab: Lab,
  cfg: Config = CONFIG
): Uint8Array {
  const hard = floodFillMask(data, width, height, bgLab, cfg);
  const eroded = cfg.EROSION_PX > 0 ? erodeMask(hard, width, height, cfg.EROSION_PX) : hard;
  return blurAlpha(eroded, width, height, cfg.ALPHA_BLUR_RADIUS);
}
