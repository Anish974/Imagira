# Claude Code — Prompts

Put `CUTOUT_MVP_SPEC.md` in the project root first. Then paste these in order.

---

## Prompt 1 — Scaffold + Path A (start here)

```
Read CUTOUT_MVP_SPEC.md in the project root. That's the full spec — follow it.

Build steps 1-6 from section 11 only. Stop after step 6. Do NOT build the
ONNX/model path yet.

Scope for this pass:
- Next.js App Router + TypeScript + Tailwind scaffold
- Dropzone: drag-drop, click-to-browse, and Ctrl+V paste
- lib/colour.ts       - RGB<->LAB conversion + euclidean distance
- lib/detectPlainBg.ts - section 3.1 of the spec
- lib/floodFill.ts     - sections 3.2 and 3.3 of the spec
- Result UI: checkerboard preview, background swap, PNG download

Three things I care about most, in order:

1. The flood fill MUST be iterative BFS seeded from border pixels, NOT a global
   colour threshold. A white shirt on a white background has to survive. This is
   the correctness bar for the whole feature - if you get this wrong nothing else
   matters. Write it carefully.

2. All tunable constants from section 3.4 go in one exported config object so I
   can tune them in one place.

3. No backend, no API routes, no server-side processing anywhere. The image must
   never leave the browser. If you find yourself writing a route handler, stop.

Use Uint8ClampedArray/Uint8Array and a flat queue. No recursion - it will blow
the stack on large images.

Ask me before adding any dependency beyond next/react/tailwind.
```

---

## Prompt 2 — Verify Path A before moving on

```
Before we add the model, verify Path A against section 9 of the spec.

1. Write a small dev-only test page at /debug that lets me drop multiple images
   at once and shows, for each: the detection verdict (plain / not plain), the
   processing time in ms, and the before/after side by side.

2. Add console timing around detectPlainBg and floodFill separately so I can see
   where time goes.

Then tell me honestly which parts of section 9's Path A checklist you think will
fail, and why. Don't be optimistic - I want to know what's weak before I test.
```

---

## Prompt 3 — Model export (separate, Python, own folder)

```
Separate task, doesn't touch the Next.js app. Create a /scripts folder.

Write a Python script that:
1. Downloads BiRefNet-lite from Hugging Face (ZhengPeng7/BiRefNet - MIT licensed)
2. Exports it to ONNX with dynamic batch, fixed 1024x1024 spatial input
3. Quantises to fp16
4. Prints the final file size and verifies input/output shapes match the contract
   in section 4.3 of the spec
5. Runs one test image through both the PyTorch model and the ONNX model and
   reports max pixel difference between the two masks

Target: under 90 MB. If fp16 doesn't get there, try int8 and report the quality
difference so I can decide.

Verify the shapes in Python and show me the numbers before I wire anything into
the browser.
```

---

## Prompt 4 — Path B

```
Now add Path B per sections 4 and 11 steps 8-11 of the spec.

- lib/modelCache.ts   - Cache API wrapper, versioned key, streaming download with
                        progress callback
- workers/segment.worker.ts - ONNX inference off the main thread
- lib/pipeline.ts     - the router from section 2

Non-negotiables:
- WebGPU first, single-threaded WASM fallback. Do NOT use multi-threaded WASM -
  the SharedArrayBuffer/COOP/COEP path is explicitly out of scope (see 4.4).
- Inference runs in the worker, never on the main thread.
- The mask gets upscaled back to the ORIGINAL image dimensions and applied to
  the original untouched pixels. Output resolution must equal input resolution.
- Real progress bar with MB counter on first download.

Also add the "Try other method" toggle from section 7 so I can manually override
the router when it picks wrong.
```

---

## Prompt 5 — Test run

```
Add to the /debug page: a results table logging every image I process with
path taken, time in ms, and a 1-5 quality score I can set by hand. Let me export
that table as CSV.

This log is the actual deliverable - I need it to decide whether the whole
browser-only approach is viable.
```

---

## Tips while working

**When something looks wrong, say so specifically.** "Hair edges are jagged and there's a white halo about 2px wide" gets a fix. "Output is bad" gets guesswork.

**Push back if it over-builds.** Claude Code tends to add features you didn't ask for. If it starts building auth or an API route, stop it and point at section 8.

**Commit after every working step.** Especially before starting Path B — you want a clean rollback point while Path A works.

**Don't skip Prompt 2.** Verifying Path A before adding the model is what keeps you from debugging two unknowns at once.
