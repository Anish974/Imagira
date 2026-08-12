import { CONFIG, type Config } from './config.ts';
import { rgbToLab, labDistance, type Lab } from './colour.ts';

export interface PlainBgResult {
  isPlain: boolean;
  /** fraction of border samples within PLAIN_BG_LAB_THRESHOLD of the mean */
  ratio: number;
  /** mean LAB of the inlier border samples — the seed colour for the flood fill */
  bgLab: Lab;
  /** same colour as RGB, for UI display */
  bgRgb: [number, number, number];
  sampleCount: number;
  /** border samples that were already transparent — the image arrived pre-cut */
  transparentSamples: number;
}

/**
 * Spec §3.1 — sample all four borders, convert to LAB, and call it plain if
 * enough samples cluster around the mean.
 */
export function detectPlainBg(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cfg: Config = CONFIG
): PlainBgResult {
  const step = Math.max(1, cfg.BORDER_SAMPLE_STEP);
  const labs: Lab[] = [];
  const rgbs: [number, number, number][] = [];
  let transparent = 0;
  let sampled = 0;

  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    sampled++;
    // Already-transparent pixels are background by definition, and their RGB is
    // meaningless — reading it would drag the detected colour toward black.
    if (data[i + 3] <= cfg.TRANSPARENT_ALPHA) {
      transparent++;
      return;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    labs.push(rgbToLab(r, g, b));
    rgbs.push([r, g, b]);
  };

  for (let x = 0; x < width; x += step) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    sample(0, y);
    sample(width - 1, y);
  }

  const n = labs.length;
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  for (const lab of labs) {
    sumL += lab.L;
    sumA += lab.a;
    sumB += lab.b;
  }
  // n can be 0 when the whole border is already transparent; avoid NaN poisoning
  // every later distance comparison.
  const mean: Lab = n > 0 ? { L: sumL / n, a: sumA / n, b: sumB / n } : { L: 0, a: 0, b: 0 };

  // Inliers define the background colour — outliers are subject bleeding into
  // the frame edge and would drag the seed colour off target.
  let inliers = 0;
  let ir = 0;
  let ig = 0;
  let ib = 0;
  let iL = 0;
  let ia = 0;
  let ibb = 0;
  for (let k = 0; k < n; k++) {
    if (labDistance(labs[k], mean) <= cfg.PLAIN_BG_LAB_THRESHOLD) {
      inliers++;
      iL += labs[k].L;
      ia += labs[k].a;
      ibb += labs[k].b;
      ir += rgbs[k][0];
      ig += rgbs[k][1];
      ib += rgbs[k][2];
    }
  }

  // Transparent border samples are uniform background too, so they count toward
  // "plain" even though they contribute no colour.
  const ratio = sampled > 0 ? (inliers + transparent) / sampled : 0;
  const bgLab: Lab = inliers > 0 ? { L: iL / inliers, a: ia / inliers, b: ibb / inliers } : mean;
  const bgRgb: [number, number, number] =
    inliers > 0
      ? [Math.round(ir / inliers), Math.round(ig / inliers), Math.round(ib / inliers)]
      : [0, 0, 0];

  return {
    isPlain: ratio >= cfg.PLAIN_BG_RATIO,
    ratio,
    bgLab,
    bgRgb,
    sampleCount: sampled,
    transparentSamples: transparent,
  };
}
