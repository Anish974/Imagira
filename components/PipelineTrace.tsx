'use client';

/**
 * The signature element. Every stage of the run, with the time it actually took,
 * drawn to scale. These are real measurements taken during processing — not a
 * loading animation dressed up as one.
 */

export interface Stage {
  label: string;
  ms: number;
}

export default function PipelineTrace({
  stages,
  running,
}: {
  stages: Stage[];
  /** true while the run is in flight, before any timings exist */
  running?: boolean;
}) {
  const total = stages.reduce((sum, s) => sum + s.ms, 0);
  const slowest = stages.reduce((max, s) => Math.max(max, s.ms), 0);

  return (
    <section className="border-t border-line pt-4">
      <div className="flex items-baseline justify-between">
        <span className="tag">Pipeline</span>
        {!running && (
          <span className="readout text-xs text-dim">
            {total.toFixed(1)}
            <span className="text-faint"> ms total</span>
          </span>
        )}
      </div>

      <ol className="mt-3 space-y-1.5">
        {stages.map((stage, i) => (
          <li key={stage.label} className="flex items-center gap-3">
            <span className="readout w-4 shrink-0 text-[10px] text-faint">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="w-32 shrink-0 truncate text-xs text-dim">{stage.label}</span>

            <span className="relative h-[3px] flex-1 bg-line">
              {!running && (
                <span
                  className="trace-bar absolute inset-y-0 left-0 bg-signal"
                  style={{
                    width: `${slowest > 0 ? (stage.ms / slowest) * 100 : 0}%`,
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              )}
              {running && <span className="blink absolute inset-y-0 left-0 w-1/4 bg-signal-dim" />}
            </span>

            <span className="readout w-16 shrink-0 text-right text-xs text-text">
              {running ? <span className="text-faint">—</span> : `${stage.ms.toFixed(1)}`}
              {!running && <span className="text-faint"> ms</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
