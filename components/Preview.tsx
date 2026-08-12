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
    <div className="grid gap-4 sm:grid-cols-2">
      <figure className="space-y-2">
        <div className="flex h-[22rem] items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeUrl} alt="Original" className="max-h-full max-w-full object-contain" />
        </div>
        <figcaption className="text-xs uppercase tracking-wide text-neutral-400">Before</figcaption>
      </figure>

      <figure className="space-y-2">
        <div
          className={`relative flex h-[22rem] items-center justify-center overflow-hidden rounded-lg border border-neutral-200 ${
            background ? '' : 'checkerboard'
          }`}
          style={background ? { backgroundColor: background } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterUrl} alt="Background removed" className="max-h-full max-w-full object-contain" />

          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none">
            {isEnhanced && (
              <span className="rounded-full bg-amber-500/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                ✨ HD Enhanced
              </span>
            )}
            {isUpscaled && (
              <span className="rounded-full bg-blue-600/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                2x Upscaled
              </span>
            )}
          </div>
        </div>
        <figcaption className="flex items-center justify-between text-xs uppercase tracking-wide text-neutral-400">
          <span>After</span>
          {(isEnhanced || isUpscaled) && (
            <span className="normal-case text-amber-700 font-medium">Quality Enhanced</span>
          )}
        </figcaption>
      </figure>
    </div>
  );
}

