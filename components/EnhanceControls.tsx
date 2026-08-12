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

  const sliders = [
    { key: 'sharpen' as const, label: 'Sharpen', min: 0, max: 100, suffix: '%' },
    { key: 'defringe' as const, label: 'De-fringe', min: 0, max: 100, suffix: '%' },
    { key: 'contrast' as const, label: 'Clarity', min: -50, max: 50, suffix: '', signed: true },
  ];

  return (
    <section className="border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-px bg-line">
          <button
            type="button"
            onClick={toggleEnhance}
            aria-pressed={options.enabled}
            className={`px-3 py-1.5 text-xs transition-colors ${
              options.enabled
                ? 'bg-signal text-ink'
                : 'bg-panel text-dim hover:bg-raise hover:text-text'
            }`}
          >
            Refine edges
          </button>
          <button
            type="button"
            onClick={toggleUpscale}
            aria-pressed={options.upscale2x}
            title="Double the output dimensions, then re-sharpen"
            className={`px-3 py-1.5 text-xs transition-colors ${
              options.upscale2x
                ? 'bg-signal text-ink'
                : 'bg-panel text-dim hover:bg-raise hover:text-text'
            }`}
          >
            Upscale 2&times;
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="tag transition-colors hover:text-text"
        >
          {showDetails ? 'Hide controls' : 'Tune'}
        </button>
      </div>

      {showDetails && (
        <div className="mt-5 space-y-5">
          {!options.enabled && (
            <p className="readout text-xs text-dim">
              Turn on <span className="text-signal">Refine edges</span> to use these.
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-3">
            {sliders.map((slider) => {
              const value = options[slider.key];
              return (
                <div key={slider.key} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor={`${slider.key}-range`} className="tag">
                      {slider.label}
                    </label>
                    <span className="readout text-xs text-text">
                      {slider.signed && value > 0 ? `+${value}` : value}
                      {slider.suffix}
                    </span>
                  </div>
                  <input
                    id={`${slider.key}-range`}
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    value={value}
                    disabled={!options.enabled}
                    onChange={(e) => updateField(slider.key, Number(e.target.value))}
                    className="w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetEnhancements}
              disabled={!options.enabled}
              className="tag transition-colors hover:text-text disabled:opacity-30"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
