# Background Remover — MVP Spec

**Version:** 0.1 (MVP)
**Owner:** Anish
**Goal:** Browser-only background removal tool. Zero server cost, zero image upload.

---

## 1. What we are building

A single-page web app. User drops a photo, background gets removed, user downloads a transparent PNG.

**The critical constraint: the image never leaves the browser.**

No upload endpoint. No server-side processing. No GPU bill. All processing happens on the user's own machine using Canvas APIs and an ONNX model running in WebAssembly/WebGPU.

This is not a limitation — it is the entire product thesis:

| | Competitors | Us |
|---|---|---|
| Cost per image | ~$0.02–0.09 | **$0** |
| Free tier resolution | Downscaled / watermarked | **Full resolution** |
| Privacy | Image on their server | **Never uploaded** |
| Scaling cost | Linear with users | **Flat (static hosting)** |

---

## 2. The two-path architecture

This is the core design decision. Do not skip it.

```
Image loaded into canvas
        |
        v
[ Path detector: is the background a flat, uniform colour? ]
        |
        +--- YES ---> Path A: Flood-fill removal
        |             ~5ms, 0 MB downloaded, runs instantly
        |
        +--- NO ----> Path B: BiRefNet ONNX model
                      ~1-3s, model downloaded once, cached forever
```

**Why:** roughly 60–70% of real uploads are product shots, logos, screenshots, and scanned items on plain white/grey backgrounds. Those cases don't need a neural network. Routing them to cheap pixel maths means most users get an instant result and never wait for a model download.

Path A also gives us a working product on day one before any ML is wired up. Build Path A first, ship it, then add Path B.

---

## 3. Path A — Flood-fill removal (build this first)

### 3.1 Detection: is the background plain?

Sample the border pixels of the image (all four edges, every 4th pixel to keep it fast).

1. Convert samples to LAB colour space (perceptually uniform — RGB distance lies to you about how similar two colours look).
2. Compute the mean LAB value and the Euclidean distance of each sample from that mean.
3. **Plain if:** ≥92% of border samples are within a distance of 12 from the mean.

Expose the threshold as a constant. It will need tuning against the test set.

### 3.2 Removal: flood fill, NOT global threshold

**This is the single most important implementation detail in the whole MVP.**

The naive approach is: "find the background colour, delete every pixel matching it." This is wrong. A person wearing a white shirt on a white background loses the shirt. A product with a white label loses the label. The output looks broken and the user never comes back.

Correct approach — **flood fill inward from the edges:**

1. Seed a queue with every border pixel whose colour is within tolerance of the detected background colour.
2. BFS outward (4-connectivity). For each neighbour, if its colour distance from the background colour is within tolerance and it hasn't been visited, mark it transparent and enqueue it.
3. Stop when the queue empties.

Because the fill only spreads through *connected* regions reachable from the edge, an interior white shirt is never touched — it is enclosed by the subject and unreachable.

Use a `Uint8ClampedArray` and a flat `Uint8Array` visited map. Do not use recursion — you will blow the stack on a 4000px image. Iterative queue only.

### 3.3 Edge softening

A raw flood fill produces hard, aliased, jagged edges. Fix in two steps:

1. Build the alpha channel as an 8-bit mask (0 = removed, 255 = kept).
2. Apply a 1.5px Gaussian blur to **the alpha channel only** — never to RGB.
3. Optionally erode the mask by 1px before blurring, to pull in the halo of background-coloured fringe pixels.

### 3.4 Tunables

Expose these; they will need tuning:

```ts
const PLAIN_BG_LAB_THRESHOLD = 12;   // §3.1 detection
const PLAIN_BG_RATIO = 0.92;         // §3.1 detection
const FLOOD_TOLERANCE = 24;          // §3.2 fill spread
const ALPHA_BLUR_RADIUS = 1.5;       // §3.3
const EROSION_PX = 1;                // §3.3
```

---

## 4. Path B — BiRefNet via ONNX Runtime Web

Only start this after Path A ships and works.

### 4.1 Model

- **BiRefNet-lite**, exported to ONNX, quantised to fp16 (or int8 if quality holds).
- Target size: **under 90 MB**. If the export is larger, quantise harder — download size is the main UX risk in this path.
- **License: MIT.** This matters. Do not substitute BRIA RMBG-2.0 — its weights are CC-BY-NC and cannot be used commercially without a paid agreement. BiRefNet is the commercially safe choice and is the base architecture BRIA itself builds on.

### 4.2 Hosting the model

**Do not commit the model into `/public`.** It bloats the repo and the deploy.

Fetch it from a CDN (Hugging Face, or Cloudflare R2 later) and cache it client-side using the **Cache API**, keyed by model version. First visit downloads it; every subsequent visit reads from cache with zero network.

Show a real progress bar during that first download (`ReadableStream` + `Content-Length`). A silent 90 MB download feels like a hang.

### 4.3 Inference contract

```
Input:   float32 [1, 3, 1024, 1024], NCHW, RGB
         Normalised with ImageNet stats:
           mean = [0.485, 0.456, 0.406]
           std  = [0.229, 0.224, 0.225]

Output:  float32 [1, 1, 1024, 1024]
         Apply sigmoid -> values in [0,1] -> this is the alpha mask
```

**Full-resolution output for free:** the model always runs at 1024×1024, but the mask it produces is then bilinearly upscaled back to the original image dimensions and applied as the alpha channel of the *original, untouched* pixels. So a 4000px input yields a 4000px output. The model cost is fixed regardless of input size. This is why we can offer full resolution on the free tier when competitors don't.

### 4.4 Execution provider

Try in this order, falling back on failure:

1. **WebGPU** — fastest, use when `navigator.gpu` exists
2. **WASM, single-threaded** — universal fallback

**Deliberately skip multi-threaded WASM for the MVP.** It requires `SharedArrayBuffer`, which requires COOP/COEP headers, which then break cross-origin fetches (including the model download from a CDN) unless every resource sends CORP headers. It is a rabbit hole. Single-threaded WASM inside a Web Worker is fast enough and has none of that complexity.

### 4.5 Threading

Run inference in a **Web Worker**. On the main thread it freezes the UI for seconds and the tab looks crashed. Transfer the input tensor with `postMessage` transferables to avoid a copy.

---

## 5. Tech stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | Familiar; Vercel free tier |
| Rendering | `'use client'` throughout | No SSR value here |
| Styling | Tailwind | |
| Image ops | Canvas 2D API | No libs needed for Path A |
| ML runtime | `onnxruntime-web` | |
| Hosting | Vercel free tier | Static; no serverless functions |

**No backend. No database. No auth. No analytics SDK.** If a task requires a server, it is out of scope for the MVP.

---

## 6. File structure

```
app/
  layout.tsx
  page.tsx                    # the only page
components/
  Dropzone.tsx                # file input + drag/drop + paste
  Preview.tsx                 # before/after with checkerboard
  Controls.tsx                # background swap, download
  ProgressBar.tsx             # model download progress
lib/
  colour.ts                   # rgb<->lab, distance
  detectPlainBg.ts            # §3.1
  floodFill.ts                # §3.2 + §3.3
  imageUtils.ts               # load, resize, compose, export
  modelCache.ts               # §4.2 Cache API wrapper
  pipeline.ts                 # the router in §2
workers/
  segment.worker.ts           # §4.5
```

---

## 7. UI requirements

Single screen. No routing, no nav, no marketing copy.

**States:**
1. **Empty** — dropzone. Accepts drag-drop, click-to-browse, and **Ctrl+V paste** (paste is heavily used and almost always forgotten).
2. **Processing** — spinner. If Path B and the model isn't cached, show the download progress bar with MB counter.
3. **Result** — before/after view over a checkerboard pattern (so transparency is visible), plus controls.
4. **Error** — plain message and a retry.

**Controls in the result state:**
- Background: Transparent / White / Black / custom colour picker
- Download PNG (transparent) — the primary action
- Download JPG (only enabled when a solid background is selected)
- "Try other method" — manually switch between Path A and Path B when the auto-router picks wrong. Cheap to build, saves the user when detection misfires.

**Also required:**
- A visible line: *"Your image never leaves your device — all processing happens in your browser."* This is the differentiator; state it plainly.
- Which path ran, shown subtly (e.g. "Fast mode" / "AI mode"). Useful for the user, essential for you while tuning thresholds.

**Design direction:** restrained, tool-like, not a landing page. Neutral greys, one accent colour, generous whitespace, system font stack or Inter. The image is the hero — the chrome should recede. Avoid gradients, avoid hero sections, avoid stock-SaaS decoration.

---

## 8. Non-goals for the MVP

Explicitly out of scope. Do not build these:

- ❌ Any backend, API route, or server-side processing
- ❌ Auth, accounts, payments, pricing page
- ❌ The public developer API (that is a later phase)
- ❌ Upscaling, shadow generation, AI background generation
- ❌ Manual refine/restore brush
- ❌ Batch processing
- ❌ An LLM layer for routing (pixel maths handles it; an LLM would force uploads and destroy the zero-cost model)
- ❌ Mobile app

---

## 9. Acceptance criteria

The MVP is done when all of these hold:

**Path A**
- [ ] Plain-background detection correctly classifies ≥90% of the test set
- [ ] A white subject on a white background retains the subject (the flood-fill correctness test)
- [ ] Completes in under 100ms for a 2000×2000 image
- [ ] Edges are soft, not jagged

**Path B**
- [ ] Model downloads once with a visible progress bar, then loads from cache with no network on reload
- [ ] Inference completes in under 4s on the dev laptop (RTX 3050 / Ryzen 7 4800H)
- [ ] Output resolution equals input resolution
- [ ] UI stays responsive throughout (worker is actually working)

**General**
- [ ] Zero network requests containing image data — verify in the Network tab
- [ ] Handles JPG, PNG, WebP
- [ ] Handles a 4000×4000 input without crashing the tab
- [ ] Deploys to Vercel free tier

---

## 10. Test set

Collect ~20 images before starting. Split roughly:

| Category | Count | Expected path |
|---|---|---|
| Product on white | 4 | A |
| Logo / graphic | 2 | A |
| Screenshot | 1 | A |
| **White subject on white bg** | 2 | A (correctness trap) |
| Person, busy background | 3 | B |
| Person with loose hair | 3 | B |
| Animal with fur | 2 | B |
| Transparent object (glass) | 2 | B (expected to fail — establishes the baseline) |
| Low contrast subject/bg | 1 | B |

Log for each: which path ran, time taken, and a subjective quality score out of 5.

**This log is the actual deliverable of the MVP.** The app is how you generate it. It tells you whether the browser-only approach is viable at all, and whether the thresholds in §3.4 need moving — before you commit weeks to the API product.

---

## 11. Build order

1. Next.js scaffold, dropzone, load image to canvas, render it
2. `colour.ts` — RGB↔LAB and distance
3. `detectPlainBg.ts` — log the verdict to console, no UI yet
4. `floodFill.ts` — Path A end to end
5. Result UI: checkerboard, background swap, PNG download
6. **Ship it.** Deploy. Path A alone is a usable product.
7. Model export + quantisation (separate task, Python, outside this repo)
8. `modelCache.ts` + progress bar
9. `segment.worker.ts` + ONNX inference
10. Wire the router in `pipeline.ts`
11. Run the test set, fill the log, tune thresholds

Steps 1–6 are the real MVP. Steps 7–11 are phase two.

---

## 12. Known risks

| Risk | Mitigation |
|---|---|
| 90 MB download feels too slow | Path A means most users never hit it; progress bar; cached after first visit |
| Low-end phones can't run inference | Detect and degrade to Path A only, with a clear message |
| Flood fill leaves a colour fringe | Erode before blur (§3.3); tune `FLOOD_TOLERANCE` |
| Detection misroutes an image | Manual "try other method" toggle (§7) |
| ONNX export produces wrong output shape | Verify shapes in Python before touching the browser |
| Large images blow browser memory | Cap the working canvas; keep the original only as a `Blob` until export |
