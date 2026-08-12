'use client';

const PRESETS: { label: string; value: string | null }[] = [
  { label: 'None', value: null },
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
  const custom = background !== null && !PRESETS.some((p) => p.value === background);

  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-t border-line pt-4">
      <div>
        <span className="tag">Backdrop</span>
        <div className="mt-2.5 flex items-center gap-px bg-line">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onBackground(preset.value)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                background === preset.value
                  ? 'bg-signal text-ink'
                  : 'bg-panel text-dim hover:bg-raise hover:text-text'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <label
            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
              custom ? 'bg-signal text-ink' : 'bg-panel text-dim hover:bg-raise hover:text-text'
            }`}
          >
            Pick
            <input
              type="color"
              value={background ?? '#ffffff'}
              onChange={(e) => onBackground(e.target.value)}
              className="h-3.5 w-3.5 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDownloadPng}
          className="bg-signal px-4 py-2 text-xs font-medium text-ink transition-opacity hover:opacity-85"
        >
          Download PNG
        </button>
        <button
          type="button"
          onClick={onDownloadJpg}
          disabled={!background}
          title={background ? undefined : 'JPG has no transparency — choose a backdrop first'}
          className="border border-line-2 px-4 py-2 text-xs text-dim transition-colors hover:border-faint hover:text-text disabled:cursor-not-allowed disabled:border-line disabled:text-faint"
        >
          Download JPG
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-2 text-xs text-faint transition-colors hover:text-text"
        >
          New image
        </button>
      </div>
    </div>
  );
}
