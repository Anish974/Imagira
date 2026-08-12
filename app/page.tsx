'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import Controls from '@/components/Controls';
import Dropzone from '@/components/Dropzone';
import EnhanceControls from '@/components/EnhanceControls';
import Preview from '@/components/Preview';
import { CONFIG } from '@/lib/config';
import { detectPlainBg } from '@/lib/detectPlainBg';
import { buildAlphaMask } from '@/lib/floodFill';
import {
  applyEnhancements,
  DEFAULT_ENHANCE_OPTIONS,
  type EnhanceOptions,
} from '@/lib/enhance';
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
  detectMs: number;
  fillMs: number;
  width: number;
  height: number;
  name: string;
}

type Status = 'empty' | 'processing' | 'result' | 'error';

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

    // Revoke previous afterUrl if exists
    if (urlsRef.current.length > 1) {
      URL.revokeObjectURL(urlsRef.current[1]);
      urlsRef.current[1] = afterUrl;
    } else {
      urlsRef.current.push(afterUrl);
    }

    setResult((prev) => (prev ? { ...prev, afterUrl } : null));
  }, []);

  const process = useCallback(
    async (file: File) => {
      urlsRef.current.forEach(URL.revokeObjectURL);
      urlsRef.current = [];
      setStatus('processing');
      setError('');

      try {
        const { imageData, width, height, objectUrl } = await loadImageData(file);

        const t0 = performance.now();
        const detection = detectPlainBg(imageData.data, width, height, CONFIG);
        const t1 = performance.now();
        const mask = buildAlphaMask(imageData.data, width, height, detection.bgLab, CONFIG);
        const t2 = performance.now();

        const cutout = toCanvas(applyAlphaMask(imageData, mask));
        cutoutRef.current = cutout;
        const initialOptions = DEFAULT_ENHANCE_OPTIONS;
        const enhanced = applyEnhancements(cutout, initialOptions);
        enhancedCanvasRef.current = enhanced;

        const afterUrl = await canvasToObjectUrl(enhanced);
        urlsRef.current = [objectUrl, afterUrl];

        setResult({
          beforeUrl: objectUrl,
          afterUrl,
          isPlain: detection.isPlain,
          ratio: detection.ratio,
          detectMs: t1 - t0,
          fillMs: t2 - t1,
          width,
          height,
          name: baseName(file.name),
        });
        setBackground(null);
        setEnhanceOptions(initialOptions);
        setStatus('result');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong reading that image.');
        setStatus('error');
      }
    },
    []
  );

  const handleEnhanceChange = (newOptions: EnhanceOptions) => {
    setEnhanceOptions(newOptions);
    updateEnhancedOutput(newOptions);
  };

  const download = (type: 'image/png' | 'image/jpeg') => {
    const finalCanvas = enhancedCanvasRef.current ?? cutoutRef.current;
    if (!finalCanvas || !result) return;
    // PNG stays transparent; JPG gets chosen background colour.
    const canvas = type === 'image/png' ? finalCanvas : compositeOnColour(finalCanvas, background ?? '#ffffff');
    const suffix = enhanceOptions.enabled ? '-enhanced' : '-cutout';
    downloadCanvas(canvas, type, `${result.name}${suffix}.${type === 'image/png' ? 'png' : 'jpg'}`);
  };

  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Background Remover</h1>
        <p className="text-sm text-neutral-500">
          Your image never leaves your device — all processing happens in your browser.
        </p>
      </header>

      {status === 'empty' && <Dropzone onFile={process} />}

      {status === 'processing' && (
        <div className="flex h-80 items-center justify-center rounded-lg border border-neutral-200 bg-white">
          <p className="text-sm text-neutral-500">Processing…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex h-80 flex-col items-center justify-center gap-4 rounded-lg border border-neutral-200 bg-white">
          <p className="text-sm text-neutral-700">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Try again
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
          <EnhanceControls options={enhanceOptions} onChange={handleEnhanceChange} />
          <Controls
            background={background}
            onBackground={setBackground}
            onDownloadPng={() => download('image/png')}
            onDownloadJpg={() => download('image/jpeg')}
            onReset={reset}
          />
          <p className="text-xs text-neutral-400">
            Fast mode · {result.width * (enhanceOptions.upscale2x ? 2 : 1)}×
            {result.height * (enhanceOptions.upscale2x ? 2 : 1)} px · detect{' '}
            {result.detectMs.toFixed(1)}ms · fill {result.fillMs.toFixed(1)}ms · border match{' '}
            {(result.ratio * 100).toFixed(0)}%
          </p>
          {!result.isPlain && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This background isn&apos;t uniform, so Fast mode may leave parts behind. AI mode is
              not wired up yet.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

