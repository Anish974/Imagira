'use client';

/**
 * THROWAWAY SPIKE — delete once the numbers are in the log.
 *
 * One question only: is BiRefNet-lite fast enough on WebGPU to justify building
 * Path B properly (worker, Cache API, progress bar, router)?
 *
 * Deliberately NOT here: web worker, Cache API, progress bar, the auto-router.
 * Building those before knowing the answer is how you write 400 lines you throw
 * away. The browser's own HTTP cache covers repeat runs of the model download.
 */

import { useCallback, useRef, useState } from 'react';
import { loadImageData } from '@/lib/imageUtils';

const MODEL_URL =
  'https://huggingface.co/onnx-community/BiRefNet_lite/resolve/main/onnx/model_fp16.onnx';
const SIZE = 1024;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

type Provider = 'webgpu' | 'wasm';

interface Timing {
  label: string;
  ms: number;
}

/** Resize to 1024x1024 and normalise to NCHW float32 (spec 4.3). */
function preprocess(imageData: ImageData): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  const source = document.createElement('canvas');
  source.width = imageData.width;
  source.height = imageData.height;
  source.getContext('2d')!.putImageData(imageData, 0, 0);
  ctx.drawImage(source, 0, 0, SIZE, SIZE);

  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const out = new Float32Array(3 * SIZE * SIZE);
  const plane = SIZE * SIZE;
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    out[i] = (data[p] / 255 - MEAN[0]) / STD[0];
    out[i + plane] = (data[p + 1] / 255 - MEAN[1]) / STD[1];
    out[i + 2 * plane] = (data[p + 2] / 255 - MEAN[2]) / STD[2];
  }
  return out;
}

/** Sigmoid the logits, then bilinearly upscale the mask to the original size. */
function maskToAlpha(logits: Float32Array, width: number, height: number): Uint8Array {
  const alpha = new Uint8Array(width * height);
  const scaleX = SIZE / width;
  const scaleY = SIZE / height;

  for (let y = 0; y < height; y++) {
    const sy = Math.min(SIZE - 1, y * scaleY);
    const y0 = Math.floor(sy);
    const y1 = Math.min(SIZE - 1, y0 + 1);
    const fy = sy - y0;

    for (let x = 0; x < width; x++) {
      const sx = Math.min(SIZE - 1, x * scaleX);
      const x0 = Math.floor(sx);
      const x1 = Math.min(SIZE - 1, x0 + 1);
      const fx = sx - x0;

      const top = logits[y0 * SIZE + x0] * (1 - fx) + logits[y0 * SIZE + x1] * fx;
      const bottom = logits[y1 * SIZE + x0] * (1 - fx) + logits[y1 * SIZE + x1] * fx;
      const v = top * (1 - fy) + bottom * fy;
      alpha[y * width + x] = Math.round((1 / (1 + Math.exp(-v))) * 255);
    }
  }
  return alpha;
}

export default function SpikePage() {
  const [log, setLog] = useState<Timing[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [provider, setProvider] = useState<Provider>('webgpu');
  const sessionRef = useRef<{ session: unknown; provider: Provider } | null>(null);

  const run = useCallback(
    async (file: File) => {
      setError('');
      setLog([]);
      setResultUrl('');
      const timings: Timing[] = [];
      const mark = (label: string, ms: number) => {
        timings.push({ label, ms });
        setLog([...timings]);
      };

      try {
        setStatus('loading onnxruntime-web');
        const ort = await import('onnxruntime-web');
        ort.env.wasm.wasmPaths = '/ort/';
        ort.env.wasm.numThreads = 1; // multi-threaded wasm is out of scope (4.4)

        if (provider === 'webgpu' && !('gpu' in navigator)) {
          throw new Error('navigator.gpu missing — this browser has no WebGPU.');
        }

        setStatus('decoding image');
        let t = performance.now();
        const { imageData, width, height } = await loadImageData(file);
        mark(`decode ${width}x${height}`, performance.now() - t);

        if (!sessionRef.current || sessionRef.current.provider !== provider) {
          setStatus(`downloading model (109 MB, cached by the browser after the first run)`);
          t = performance.now();
          const buffer = await (await fetch(MODEL_URL)).arrayBuffer();
          mark(`download ${(buffer.byteLength / 1048576).toFixed(1)} MB`, performance.now() - t);

          setStatus(`creating ${provider} session`);
          t = performance.now();
          const session = await ort.InferenceSession.create(buffer, {
            executionProviders: [provider],
          });
          mark(`session create (${provider})`, performance.now() - t);
          sessionRef.current = { session, provider };
        }

        const session = sessionRef.current.session as {
          inputNames: string[];
          run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
        };

        setStatus('preprocessing');
        t = performance.now();
        const input = preprocess(imageData);
        mark('preprocess', performance.now() - t);

        setStatus('running inference');
        t = performance.now();
        const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) };
        const output = await session.run(feeds);
        mark('inference (cold)', performance.now() - t);

        setStatus('running inference again (warm)');
        t = performance.now();
        const warm = await session.run({
          [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]),
        });
        mark('inference (warm)', performance.now() - t);

        setStatus('applying mask');
        t = performance.now();
        const logits = Object.values(warm)[0].data as Float32Array;
        const alpha = maskToAlpha(logits, width, height);
        const out = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
        for (let i = 0, p = 3; i < alpha.length; i++, p += 4) out.data[p] = alpha[i];
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.putImageData(out, 0, 0);
        mark(`mask -> alpha at ${width}x${height}`, performance.now() - t);

        canvas.toBlob((blob) => blob && setResultUrl(URL.createObjectURL(blob)), 'image/png');
        void output;
        setStatus('done');
      } catch (e) {
        setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        setStatus('failed');
      }
    },
    [provider]
  );

  const total = log.reduce((sum, t) => sum + t.ms, 0);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <header>
        <h1 className="text-lg font-semibold">Path B spike</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Throwaway. Answers one question: is WebGPU inference fast enough to build Path B.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {(['webgpu', 'wasm'] as Provider[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProvider(p)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              provider === p
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-600'
            }`}
          >
            {p}
          </button>
        ))}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) run(file);
          }}
          className="text-sm"
        />
      </div>

      {status && <p className="text-sm text-neutral-600">{status}</p>}
      {error && (
        <pre className="overflow-x-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </pre>
      )}

      {log.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {log.map((t) => (
              <tr key={t.label} className="border-b border-neutral-100">
                <td className="py-1.5 text-neutral-600">{t.label}</td>
                <td className="py-1.5 text-right tabular-nums">{t.ms.toFixed(0)} ms</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="py-1.5">total</td>
              <td className="py-1.5 text-right tabular-nums">{total.toFixed(0)} ms</td>
            </tr>
          </tbody>
        </table>
      )}

      {resultUrl && (
        <div className="checkerboard flex items-center justify-center rounded-lg border border-neutral-200 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Path B cutout" className="max-h-[26rem] max-w-full object-contain" />
        </div>
      )}
    </main>
  );
}
