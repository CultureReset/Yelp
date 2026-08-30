import clsx from 'clsx';

export interface Metric {
  key: string;
  label: string;
  value: number;
  previous: number;
  series: number[];
  definition: string;
}

function Sparkline({ series, positive }: { series: number[]; positive: boolean }) {
  if (series.length < 2) return null;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const w = 96, h = 28;
  const pts = series.map((v, i) => [
    (i / (series.length - 1)) * w,
    h - ((v - min) / range) * (h - 4) - 2,
  ] as const);

  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const stroke = positive ? 'var(--color-good-500)' : 'var(--color-ink-400)';
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <path d={area} fill={stroke} opacity="0.1" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.2" fill={stroke} />
    </svg>
  );
}

/** Delta uses semantic color plus an arrow glyph — never color alone. */
function Delta({ value, previous }: { value: number; previous: number }) {
  if (previous === 0) {
    return <span className="text-[12px] text-ink-400">No prior data</span>;
  }
  const pct = ((value - previous) / previous) * 100;
  const flat = Math.abs(pct) < 1;
  const up = pct > 0;

  return (
    <span className={clsx(
      'tnum inline-flex items-center gap-0.5 text-[12px] font-medium',
      flat ? 'text-ink-500' : up ? 'text-good-700' : 'text-bad-700',
    )}>
      <span aria-hidden="true">{flat ? '→' : up ? '↑' : '↓'}</span>
      {flat ? 'Flat' : `${Math.abs(pct).toFixed(0)}%`}
      <span className="sr-only">
        {flat ? 'unchanged' : up ? 'increase' : 'decrease'} versus the previous period
      </span>
    </span>
  );
}

export function MetricTile({ metric }: { metric: Metric }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-ink-500" title={metric.definition}>
          {metric.label}
        </p>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div>
          <p className="tnum text-2xl font-bold leading-none text-ink-900">
            {metric.value.toLocaleString()}
          </p>
          <div className="mt-1.5">
            <Delta value={metric.value} previous={metric.previous} />
          </div>
        </div>
        <Sparkline series={metric.series} positive={metric.value >= metric.previous} />
      </div>
    </div>
  );
}
