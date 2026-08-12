/**
 * sRGB <-> CIELAB (D65) + euclidean distance.
 *
 * LAB because RGB distance lies about perceptual similarity (spec §3.1).
 */

export interface Lab {
  L: number;
  a: number;
  b: number;
}

/** sRGB byte -> linear light. 256-entry LUT kills the pow() in the hot path. */
const LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// D65 white point
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

function pivot(t: number): number {
  return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
}

/** Scratch so the per-pixel path allocates nothing. */
const scratch = new Float64Array(3);

/** Convert into `scratch` as [L, a, b]. Internal — no allocation. */
function toLabScratch(r: number, g: number, b: number): void {
  const rl = LINEAR[r];
  const gl = LINEAR[g];
  const bl = LINEAR[b];

  const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / XN;
  const y = (0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl) / YN;
  const z = (0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl) / ZN;

  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);

  scratch[0] = 116 * fy - 16;
  scratch[1] = 500 * (fx - fy);
  scratch[2] = 200 * (fy - fz);
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  toLabScratch(r, g, b);
  return { L: scratch[0], a: scratch[1], b: scratch[2] };
}

export function labDistance(p: Lab, q: Lab): number {
  const dL = p.L - q.L;
  const da = p.a - q.a;
  const db = p.b - q.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Distance from an RGB triple to a known Lab colour, without allocating a Lab.
 * This is the function the flood fill calls millions of times.
 */
export function rgbLabDistance(r: number, g: number, b: number, target: Lab): number {
  toLabScratch(r, g, b);
  const dL = scratch[0] - target.L;
  const da = scratch[1] - target.a;
  const db = scratch[2] - target.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}
