'use client';

import { useState } from 'react';
import type { EnhanceOptions } from '@/lib/enhance';

export default function EnhanceControls({
  options,
  onChange,
}: {
  options: EnhanceOptions;
  onChange: (options: EnhanceOptions) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const toggleEnhance = () => {
    onChange({
      ...options,
      enabled: !options.enabled,
    });
  };

  const toggleUpscale = () => {
    onChange({
      ...options,
      upscale2x: !options.upscale2x,
    });
  };

  const updateField = (key: keyof EnhanceOptions, value: number | boolean) => {
    onChange({
      ...options,
      [key]: value,
    });
  };

  const resetEnhancements = () => {
    onChange({
      enabled: true,
      sharpen: 35,
      defringe: 40,
      contrast: 10,
      brightness: 0,
      upscale2x: options.upscale2x,
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleEnhance}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              options.enabled
                ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            <span>✨</span>
            <span>{options.enabled ? 'Enhanced HD Active' : 'Enhance Image (HD)'}</span>
          </button>

          <button
            type="button"
            onClick={toggleUpscale}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              options.upscale2x
                ? 'bg-blue-600 text-white shadow-xs'
                : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
            title="Double image dimensions with HD edge refinement"
          >
            2x HD Upscale
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2"
        >
          {showDetails ? 'Hide Tuning Controls ▲' : 'Fine-Tune Settings ▼'}
        </button>
      </div>

      {showDetails && (
        <div className="space-y-4 pt-3 border-t border-neutral-100 text-sm">
          {!options.enabled && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2.5 py-1.5">
              Turn on <strong>Enhance Image</strong> above to activate sharpening, de-fringing, and clarity controls.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Sharpen Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-neutral-700">
                <label htmlFor="sharpen-range">Sharpen Detail</label>
                <span>{options.sharpen}%</span>
              </div>
              <input
                id="sharpen-range"
                type="range"
                min="0"
                max="100"
                value={options.sharpen}
                disabled={!options.enabled}
                onChange={(e) => updateField('sharpen', Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900 disabled:opacity-40"
              />
            </div>

            {/* Edge De-fringe Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-neutral-700">
                <label htmlFor="defringe-range">Edge De-fringe</label>
                <span>{options.defringe}%</span>
              </div>
              <input
                id="defringe-range"
                type="range"
                min="0"
                max="100"
                value={options.defringe}
                disabled={!options.enabled}
                onChange={(e) => updateField('defringe', Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900 disabled:opacity-40"
              />
            </div>

            {/* Contrast / Clarity Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-neutral-700">
                <label htmlFor="contrast-range">Contrast / Clarity</label>
                <span>{options.contrast > 0 ? `+${options.contrast}` : options.contrast}</span>
              </div>
              <input
                id="contrast-range"
                type="range"
                min="-50"
                max="50"
                value={options.contrast}
                disabled={!options.enabled}
                onChange={(e) => updateField('contrast', Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900 disabled:opacity-40"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetEnhancements}
              disabled={!options.enabled}
              className="text-xs text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
