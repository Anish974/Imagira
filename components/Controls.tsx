'use client';

const PRESETS: { label: string; value: string | null }[] = [
  { label: 'Transparent', value: null },
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
];

export default function Controls({
  background,
  onBackground,
  onDownloadPng,
  onDownloadJpg,
  onReset,
}: {
  background: string | null;
  onBackground: (value: string | null) => void;
  onDownloadPng: () => void;
  onDownloadJpg: () => void;
  onReset: () => void;
}) {
  const custom = background && !PRESETS.some((p) => p.value === background);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onBackground(preset.value)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              background === preset.value
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <label
          className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors ${
            custom ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          Custom
          <input
            type="color"
            value={background ?? '#ffffff'}
            onChange={(e) => onBackground(e.target.value)}
            className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onDownloadPng}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Download PNG
      </button>

      <button
        type="button"
        onClick={onDownloadJpg}
        disabled={!background}
        title={background ? undefined : 'Pick a solid background first — JPG has no transparency'}
        className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Download JPG
      </button>

      <button
        type="button"
        onClick={onReset}
        className="ml-auto text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-800"
      >
        New image
      </button>
    </div>
  );
}
