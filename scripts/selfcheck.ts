/**
 * The correctness bar for Path A: a white subject on a white background must
 * keep its white interior (spec §3.2 / §9).
 *
 * Run: npm run check
 */
import assert from 'node:assert/strict';

// ImageData is a browser global. The enhance helpers construct one internally,
// and they only ever read data/width/height, so a plain stand-in is enough to
// run them under node.
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace = 'srgb' as PredefinedColorSpace;
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  } as unknown as typeof ImageData;
}

import { detectPlainBg } from '../lib/detectPlainBg.ts';
import { floodFillMask, buildAlphaMask } from '../lib/floodFill.ts';

const W = 64;
const H = 64;

/** White page, near-white subject with a thin dark outline, dead centre. */
function whiteOnWhite(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  const set = (x: number, y: number, v: number) => {
    const i = (y * W + x) * 4;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) set(x, y, 250); // background
  }
  for (let y = 20; y < 44; y++) {
    for (let x = 20; x < 44; x++) {
      const onOutline = y < 22 || y >= 42 || x < 22 || x >= 42;
      set(x, y, onOutline ? 30 : 255); // dark outline, white interior
    }
  }
  return data;
}

const data = whiteOnWhite();
const at = (mask: Uint8Array, x: number, y: number) => mask[y * W + x];

const detection = detectPlainBg(data, W, H);
assert.equal(detection.isPlain, true, 'uniform border should read as plain');
assert.ok(detection.ratio > 0.99, `border match ratio too low: ${detection.ratio}`);

const hard = floodFillMask(data, W, H, detection.bgLab);
assert.equal(at(hard, 0, 0), 0, 'corner background should be removed');
assert.equal(at(hard, 32, 10), 0, 'background above the subject should be removed');
assert.equal(at(hard, 32, 21), 255, 'the dark outline must be kept');
assert.equal(at(hard, 32, 32), 255, 'WHITE INTERIOR MUST SURVIVE — flood fill cannot reach it');

// A global colour threshold would wipe the interior; prove we did not build one.
const interiorKept = (() => {
  let kept = 0;
  for (let y = 22; y < 42; y++) for (let x = 22; x < 42; x++) if (at(hard, x, y) === 255) kept++;
  return kept;
})();
assert.equal(interiorKept, 400, `all 400 interior pixels must survive, got ${interiorKept}`);

import {
  sharpenImageData,
  deFringeImageData,
  adjustClarityAndContrast,
} from '../lib/enhance.ts';

const soft = buildAlphaMask(data, W, H, detection.bgLab);
assert.ok(at(soft, 32, 32) > 250, 'softening must not eat the subject core');
assert.ok(at(soft, 0, 0) < 5, 'softening must not resurrect the background');
assert.ok(
  at(soft, 32, 18) > 0 && at(soft, 32, 18) < 255,
  'edge should be a gradient after blur, not a hard step'
);

// Test Image Enhancement functions
const img = new ImageData(new Uint8ClampedArray(data), W, H);
const sharpened = sharpenImageData(img, 50);
assert.equal(sharpened.data.length, data.length, 'sharpened image data length must match');

const defringed = deFringeImageData(img, 50);
assert.equal(defringed.data.length, data.length, 'defringed image data length must match');

const adjusted = adjustClarityAndContrast(img, 15, 5);
assert.equal(adjusted.data.length, data.length, 'adjusted image data length must match');

console.log('ok — white-on-white survives, background removed, edges soft, image enhancement functions pass');

