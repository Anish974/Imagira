'use client';

export default function Preview({
  beforeUrl,
  afterUrl,
  background,
  isEnhanced,
  isUpscaled,
}: {
  beforeUrl: string;
  afterUrl: string;
  /** null = transparent (show the checkerboard) */
  background: string | null;
  isEnhanced?: boolean;
  isUpscaled?: boolean;
}) {
  return (
    <div className="grid gap-px bg-line sm:grid-cols-2">
      <figure className="bg-panel p-3">
        <figcaption className="tag mb-3">Source</figcaption>
        <div className="flex h-[22rem] items-center justify-center overflow-hidden bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeUrl} alt="Original" className="max-h-full max-w-full object-contain" />
        </div>
      </figure>

      <figure className="bg-panel p-3">
        <figcaption className="tag mb-3 flex items-center justify-between">
          <span>Cutout</span>
          <span className="flex items-center gap-2">
            {isEnhanced && <span className="text-signal">enhanced</span>}
            {isUpscaled && <span className="text-signal">2&times;</span>}
          </span>
        </figcaption>
        <div
          className={`flex h-[22rem] items-center justify-center overflow-hidden ${
            background ? '' : 'checkerboard'
          }`}
          style={background ? { backgroundColor: background } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterUrl}
            alt="Background removed"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </figure>
    </div>
  );
}
