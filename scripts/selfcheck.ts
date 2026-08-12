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

// An input PNG can arrive with its background already cut out. Transparent
// pixels carry RGB 0,0,0, so reading colour alone mistakes them for opaque black
// and the compose step turns them back into black.
import { applyAlphaMask } from '../lib/imageUtils.ts';

function preCutPng(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const inSubject = x >= 20 && x < 44 && y >= 20 && y < 44;
      // White subject on a transparent field — the trap is that both read as
      // "background" if you only look at RGB.
      px[i] = px[i + 1] = px[i + 2] = inSubject ? 255 : 0;
      px[i + 3] = inSubject ? 255 : 0;
    }
  }
  px[(32 * W + 32) * 4 + 3] = 128; // one half-transparent pixel inside the subject
  return px;
}

const preCut = preCutPng();
const preCutDetection = detectPlainBg(preCut, W, H);
assert.equal(preCutDetection.isPlain, true, 'a transparent border is a plain background');
assert.ok(preCutDetection.transparentSamples > 0, 'transparent border samples must be counted');

const preCutMask = floodFillMask(preCut, W, H, preCutDetection.bgLab);
assert.equal(at(preCutMask, 0, 0), 0, 'transparent border must be treated as background');
assert.equal(at(preCutMask, 30, 30), 255, 'the white subject must survive a transparent field');

const composed = applyAlphaMask(new ImageData(new Uint8ClampedArray(preCut), W, H), preCutMask);
assert.equal(composed.data[(0 * W + 0) * 4 + 3], 0, 'transparent pixels must stay transparent');
assert.equal(
  composed.data[(32 * W + 32) * 4 + 3],
  128,
  'a half-transparent subject pixel must not be forced opaque'
);

console.log(
  'ok — white-on-white survives, background removed, edges soft, pre-cut PNGs keep their alpha, image enhancement functions pass'
);

