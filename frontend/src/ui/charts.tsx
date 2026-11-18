import { cn, formatNumber } from '@/lib/format';

/**
 * Charts are drawn by hand in the page's own inks rather than with a chart
 * library: three shapes cover everything shown here, and they stay legible as
 * plain HTML tables to assistive technology.
 */

/** Labelled horizontal bars. `mark` draws a threshold line, e.g. the pass mark. */
export function BarList({
  rows,
  max = 100,
  mark,
  suffix = '%',
  tone,
}: {
  rows: { label: string; value: number; note?: string }[];
  max?: number;
  mark?: number;
  suffix?: string;
  /** Returns the fill for a value; defaults to ink. */
  tone?: (value: number) => 'ink' | 'red' | 'tick' | 'pen';
}) {
  const fill = { ink: 'bg-ink', red: 'bg-red', tick: 'bg-tick', pen: 'bg-pen' };
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-base">
            <span className="min-w-0 truncate text-ink">{row.label}</span>
            <span className="nums shrink-0 font-semibold text-ink">
              {formatNumber(Math.round(row.value * 10) / 10)}
              {suffix}
              {row.note && <span className="ml-2 font-normal text-ink-3">{row.note}</span>}
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-rule-2">
            <div
              className={cn('h-full rounded-full', fill[tone?.(row.value) ?? 'ink'])}
              style={{ width: `${Math.min(100, Math.max(0, (row.value / max) * 100))}%` }}
            />
            {mark != null && (
              <span className="absolute -top-1 h-4 w-px bg-ink-3" style={{ left: `${(mark / max) * 100}%` }} aria-hidden />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars for a distribution, e.g. how many candidates fell in each score band. */
export function Histogram({
  buckets,
  highlightFrom,
  height = 140,
}: {
  buckets: { label: string; count: number }[];
  /** Index from which bars are drawn in ink (at or above the pass mark); the rest are red. */
  highlightFrom?: number;
  height?: number;
}) {
  const peak = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label="Score distribution">
        {buckets.map((bucket, index) => (
          <div key={bucket.label} className="flex h-full flex-1 flex-col justify-end" title={`${bucket.label}: ${bucket.count}`}>
            {bucket.count > 0 && <span className="nums mb-1 text-center text-xs text-ink-2">{bucket.count}</span>}
            <div
              className={cn('rounded-t-sm', highlightFrom != null && index < highlightFrom ? 'bg-red/75' : 'bg-ink')}
              style={{ height: `${(bucket.count / peak) * 100}%`, minHeight: bucket.count ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 border-t border-ink pt-1">
        {buckets.map((bucket) => (
          <span key={bucket.label} className="nums flex-1 text-center text-xs text-ink-3">
            {bucket.label.split('-')[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A line over time. Days with no data are skipped rather than drawn as zero. */
export function TrendLine({
  points,
  max = 100,
  mark,
  height = 150,
}: {
  points: { label: string; value: number | null }[];
  max?: number;
  mark?: number;
  height?: number;
}) {
  const W = 600;
  const H = height;
  const pad = { top: 8, right: 4, bottom: 4, left: 4 };
  const plotted = points.map((p, i) => ({ ...p, i })).filter((p): p is { label: string; value: number; i: number } => p.value != null);
  const x = (i: number) => pad.left + (points.length <= 1 ? 0.5 : i / (points.length - 1)) * (W - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - v / max) * (H - pad.top - pad.bottom);
  const path = plotted.map((p, n) => `${n ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  if (!plotted.length) return <p className="py-8 text-base text-ink-3">No results in this period.</p>;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img" aria-label="Trend">
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={0} x2={W} y1={y(max * t)} y2={y(max * t)} className="stroke-rule-2" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {mark != null && (
          <line x1={0} x2={W} y1={y(mark)} y2={y(mark)} className="stroke-ink-3" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        )}
        <path d={path} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-ink-3">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </div>
  );
}
