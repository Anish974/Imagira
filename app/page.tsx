'use client';

import { useCallback, useRef, useState } from 'react';
import Controls from '@/components/Controls';
import Dropzone from '@/components/Dropzone';
import EnhanceControls from '@/components/EnhanceControls';
import PipelineTrace, { type Stage } from '@/components/PipelineTrace';
import Preview from '@/components/Preview';
import { CONFIG } from '@/lib/config';
import { detectPlainBg } from '@/lib/detectPlainBg';
import { blurAlpha, erodeMask, floodFillMask } from '@/lib/floodFill';
import { applyEnhancements, DEFAULT_ENHANCE_OPTIONS, type EnhanceOptions } from '@/lib/enhance';
import {
  applyAlphaMask,
  baseName,
  canvasToObjectUrl,
  compositeOnColour,
  downloadCanvas,
  loadImageData,
  toCanvas,
} from '@/lib/imageUtils';

interface Result {
  beforeUrl: string;
  afterUrl: string;
  isPlain: boolean;
  ratio: number;
  /** the image arrived with its background already transparent */
  preCut: boolean;
  stages: Stage[];
  width: number;
  height: number;
  name: string;
}

type Status = 'empty' | 'processing' | 'result' | 'error';

const PENDING_STAGES: Stage[] = [
  { label: 'border sample', ms: 0 },
  { label: 'flood fill', ms: 0 },
  { label: 'erode + soften', ms: 0 },
  { label: 'compose', ms: 0 },
];

export default function Page() {
  const [status, setStatus] = useState<Status>('empty');
  const [result, setResult] = useState<Result | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [enhanceOptions, setEnhanceOptions] = useState<EnhanceOptions>(DEFAULT_ENHANCE_OPTIONS);
  const [error, setError] = useState('');

  const cutoutRef = useRef<HTMLCanvasElement | null>(null);
  const enhancedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const urlsRef = useRef<string[]>([]);

  const reset = useCallback(() => {
    urlsRef.current.forEach(URL.revokeObjectURL);
    urlsRef.current = [];
    cutoutRef.current = null;
    enhancedCanvasRef.current = null;
    setResult(null);
    setBackground(null);
    setEnhanceOptions(DEFAULT_ENHANCE_OPTIONS);
    setError('');
    setStatus('empty');
  }, []);

  const updateEnhancedOutput = useCallback(async (options: EnhanceOptions) => {
    const cutout = cutoutRef.current;
    if (!cutout) return;

    const enhanced = applyEnhancements(cutout, options);
    enhancedCanvasRef.current = enhanced;
    const afterUrl = await canvasToObjectUrl(enhanced);

    if (urlsRef.current.length > 1) {
      URL.revokeObjectURL(urlsRef.current[1]);
      urlsRef.current[1] = afterUrl;
    } else {
      urlsRef.current.push(afterUrl);
    }

    setResult((prev) => (prev ? { ...prev, afterUrl } : null));
  }, []);

  const process = useCallback(async (file: File) => {
    urlsRef.current.forEach(URL.revokeObjectURL);
    urlsRef.current = [];
    setStatus('processing');
    setError('');

    try {
      const { imageData, width, height, objectUrl } = await loadImageData(file);

      // Stages are timed separately so the trace reports what actually happened
      // rather than one opaque number. Same work as buildAlphaMask, measured.
      const t0 = performance.now();
      const detection = detectPlainBg(imageData.data, width, height, CONFIG);
      const t1 = performance.now();
      const hard = floodFillMask(imageData.data, width, height, detection.bgLab, CONFIG);
      const t2 = performance.now();
      const eroded =
        CONFIG.EROSION_PX > 0 ? erodeMask(hard, width, height, CONFIG.EROSION_PX) : hard;
      const mask = blurAlpha(eroded, width, height, CONFIG.ALPHA_BLUR_RADIUS);
      const t3 = performance.now();

      const cutout = toCanvas(applyAlphaMask(imageData, mask));
      cutoutRef.current = cutout;
      const initialOptions = DEFAULT_ENHANCE_OPTIONS;
      const enhanced = applyEnhancements(cutout, initialOptions);
      enhancedCanvasRef.current = enhanced;
      const t4 = performance.now();

      const afterUrl = await canvasToObjectUrl(enhanced);
      urlsRef.current = [objectUrl, afterUrl];

      setResult({
        beforeUrl: objectUrl,
        afterUrl,
        isPlain: detection.isPlain,
        ratio: detection.ratio,
        preCut: detection.transparentSamples > detection.sampleCount / 2,
        stages: [
          { label: 'border sample', ms: t1 - t0 },
          { label: 'flood fill', ms: t2 - t1 },
          { label: 'erode + soften', ms: t3 - t2 },
          { label: 'compose', ms: t4 - t3 },
        ],
        width,
        height,
        name: baseName(file.name),
      });
      setBackground(null);
      setEnhanceOptions(initialOptions);
      setStatus('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That image could not be read. Try another file.');
      setStatus('error');
    }
  }, []);

  const handleEnhanceChange = (newOptions: EnhanceOptions) => {
    setEnhanceOptions(newOptions);
    updateEnhancedOutput(newOptions);
  };

  const download = (type: 'image/png' | 'image/jpeg') => {
    const finalCanvas = enhancedCanvasRef.current ?? cutoutRef.current;
    if (!finalCanvas || !result) return;
    // PNG stays transparent; JPG has no alpha so it gets the chosen backdrop.
    const canvas =
      type === 'image/png' ? finalCanvas : compositeOnColour(finalCanvas, background ?? '#ffffff');
    const suffix = enhanceOptions.enabled ? '-enhanced' : '-cutout';
    downloadCanvas(canvas, type, `${result.name}${suffix}.${type === 'image/png' ? 'png' : 'jpg'}`);
  };

  const scale = enhanceOptions.upscale2x ? 2 : 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-16">
      <div className="border border-line bg-panel">
        {/* Status rail */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-medium tracking-[0.2em] text-text">IMAGIRA</span>
            <span className="tag">background removal</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === 'processing'
                  ? 'blink bg-signal'
                  : status === 'error'
                    ? 'bg-faint'
                    : 'bg-signal'
              }`}
            />
            <span className="tag">
              {status === 'processing' ? 'working' : status === 'error' ? 'halted' : 'ready'}
            </span>
            <span className="tag text-faint">·</span>
            <span className="tag">on this device</span>
          </div>
        </header>

        <main className="p-4">
          {status === 'empty' && <Dropzone onFile={process} />}

          {status === 'processing' && (
            <div className="space-y-6">
              <div className="flex h-[26rem] items-center justify-center border border-line bg-ink">
                <span className="readout text-xs text-dim">
                  reading pixels<span className="blink">_</span>
                </span>
              </div>
              <PipelineTrace stages={PENDING_STAGES} running />
            </div>
          )}

          {status === 'error' && (
            <div className="flex h-[26rem] flex-col items-center justify-center gap-5 border border-line bg-ink">
              <span className="tag">Halted</span>
              <p className="max-w-sm text-center text-sm text-text">{error}</p>
              <button
                type="button"
                onClick={reset}
                className="border border-line-2 px-4 py-2 text-xs text-dim transition-colors hover:border-faint hover:text-text"
              >
                Start over
              </button>
            </div>
          )}

          {status === 'result' && result && (
            <div className="space-y-6">
              <Preview
                beforeUrl={result.beforeUrl}
                afterUrl={result.afterUrl}
                background={background}
                isEnhanced={enhanceOptions.enabled}
                isUpscaled={enhanceOptions.upscale2x}
              />

              {/* Readouts: the three facts worth knowing about this run. */}
              <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3">
                {[
                  { term: 'Path', value: result.preCut ? 'Fast · nothing to cut' : 'Fast · flood fill' },
                  {
                    term: 'Output',
                    value: `${result.width * scale} × ${result.height * scale}`,
                  },
                  { term: 'Border match', value: `${(result.ratio * 100).toFixed(1)}%` },
                ].map((item) => (
                  <div key={item.term} className="bg-panel px-3 py-2.5">
                    <dt className="tag">{item.term}</dt>
                    <dd className="readout mt-1.5 text-sm text-text">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {result.preCut && (
                <p className="border-l-2 border-signal bg-raise px-3 py-2.5 text-xs text-dim">
                  <span className="text-signal">Already transparent.</span> This image arrived with
                  its background cut out, so there was nothing to remove. What you see is the
                  original. To cut the solid shape inside it, you need the model path — it is not
                  wired up yet.
                </p>
              )}

              {!result.preCut && !result.isPlain && (
                <p className="border-l-2 border-signal bg-raise px-3 py-2.5 text-xs text-dim">
                  <span className="text-signal">Uneven backdrop.</span> Fast mode only removes
                  background connected to the edge, so parts of this one will stay. The model path
                  that handles it is not wired up yet.
                </p>
              )}

              <PipelineTrace stages={result.stages} />
              <EnhanceControls options={enhanceOptions} onChange={handleEnhanceChange} />
              <Controls
                background={background}
                onBackground={setBackground}
                onDownloadPng={() => download('image/png')}
                onDownloadJpg={() => download('image/jpeg')}
                onReset={reset}
              />
            </div>
          )}
        </main>

        <footer className="border-t border-line px-4 py-3">
          <p className="readout text-xs text-faint">
            Your image never leaves your device. Every pixel above was processed in this browser —
            no upload, no server, no account.
          </p>
        </footer>
      </div>
    </div>
  );
}
