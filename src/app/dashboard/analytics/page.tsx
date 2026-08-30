import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { requirePermission } from '@/lib/auth/guard';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getActiveBusiness } from '@/lib/business/context';
import {
  getRollups, sumField, sumLeads, seriesOf, leadSeries, daysAgo,
} from '@/lib/metrics/query';
import { METRIC_DEFINITIONS } from '@/lib/metrics/definitions';
import { Card, EmptyState, Button } from '@/components/ui';

export const metadata: Metadata = { title: 'Analytics' };

type SP = Promise<{ range?: string }>;

const RANGES = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '60', label: 'Last 60 days', days: 60 },
];

function delta(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Line chart with a faint grid and an emphasized endpoint. */
function Chart({ series, labels }: { series: number[]; labels: string[] }) {
  if (series.length < 2) return null;
  const w = 720, h = 180, padL = 40, padB = 22, padT = 10;
  const max = Math.max(...series, 1);
  const min = 0;
  const plotW = w - padL - 8;
  const plotH = h - padB - padT;

  const x = (i: number) => padL + (i / (series.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - ((v - min) / (max - min || 1)) * plotH;

  const line = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1).toFixed(1)},${padT + plotH} L${padL},${padT + plotH} Z`;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full min-w-[520px]" role="img"
           aria-label={`Trend from ${labels[0]} to ${labels[labels.length - 1]}, peak ${max}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - 8} y1={y(t)} y2={y(t)}
                  stroke="var(--color-ink-200)" strokeWidth="1" strokeDasharray="2 3" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end"
                  className="tnum" fontSize="10" fill="var(--color-ink-400)">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--color-brand-600)" opacity="0.08" />
        <path d={line} fill="none" stroke="var(--color-brand-600)" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="3.2" fill="var(--color-brand-600)" />
        <text x={padL} y={h - 6} fontSize="10" fill="var(--color-ink-400)">{labels[0]}</text>
        <text x={w - 8} y={h - 6} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
          {labels[labels.length - 1]}
        </text>
      </svg>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requirePermission('analytics.read');
  const { range } = await searchParams;
  const chosen = RANGES.find((r) => r.key === range) ?? RANGES[1];

  const [session] = await db.select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);
  const active = await getActiveBusiness(ctx, session?.activeBusinessId);
  if (!active) {
    return <Card><EmptyState title="No business selected" description="Claim a business first." /></Card>;
  }

  const n = chosen.days;
  const [current, previous] = await Promise.all([
    getRollups(active.id, daysAgo(n - 1), daysAgo(0)),
    getRollups(active.id, daysAgo(n * 2 - 1), daysAgo(n)),
  ]);

  if (current.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No data for this period yet"
          description="Analytics appear once your page starts receiving visits."
        />
      </Card>
    );
  }

  const views = sumField(current, 'pageViews');
  const leads = sumLeads(current);

  const actions = [
    { key: 'calls', label: 'Calls', def: METRIC_DEFINITIONS.calls },
    { key: 'directions', label: 'Direction requests', def: METRIC_DEFINITIONS.directions },
    { key: 'websiteClicks', label: 'Website clicks', def: METRIC_DEFINITIONS.websiteClicks },
    { key: 'messages', label: 'Messages', def: METRIC_DEFINITIONS.messages },
    { key: 'menuViews', label: 'Menu views', def: METRIC_DEFINITIONS.menuViews },
    { key: 'photoViews', label: 'Photo views', def: METRIC_DEFINITIONS.photoViews },
    { key: 'bookmarks', label: 'Saves', def: METRIC_DEFINITIONS.bookmarks },
    { key: 'orderClicks', label: 'Order clicks', def: 'Taps on your online ordering link.' },
  ] as const;

  const sources = current[current.length - 1]?.sourceBreakdown ?? {};
  const SOURCE_LABEL: Record<string, string> = {
    organic_search: 'Search on this platform',
    external_search: 'Google and other search engines',
    ads: 'Your ads',
    direct: 'Direct and saved',
  };

  const labels = current.map((r) => new Date(r.day + 'T00:00:00Z')
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const freshness = current[current.length - 1]?.computedAt;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">Analytics</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-500">
            {active.name}
            {freshness && ` · data through ${freshness.toLocaleDateString()}`}
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled>Export CSV</Button>
      </header>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/dashboard/analytics?range=${r.key}`}
            aria-current={r.key === chosen.key ? 'true' : undefined}
            className={clsx(
              'rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors',
              r.key === chosen.key
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900',
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <Card
        title="Page views"
        description={METRIC_DEFINITIONS.pageViews}
        action={
          <div className="text-right">
            <p className="tnum text-2xl font-bold text-ink-900">{views.toLocaleString()}</p>
            {(() => {
              const d = delta(views, sumField(previous, 'pageViews'));
              return d === null ? null : (
                <p className={clsx('tnum text-[12px] font-medium', d >= 0 ? 'text-good-700' : 'text-bad-700')}>
                  <span aria-hidden="true">{d >= 0 ? '↑' : '↓'}</span> {Math.abs(d).toFixed(0)}% vs previous {n} days
                </p>
              );
            })()}
          </div>
        }
      >
        <Chart series={seriesOf(current, 'pageViews')} labels={labels} />
      </Card>

      <Card
        title="Customer leads"
        description={METRIC_DEFINITIONS.customerLeads}
        action={
          <div className="text-right">
            <p className="tnum text-2xl font-bold text-ink-900">{leads.toLocaleString()}</p>
            {(() => {
              const d = delta(leads, sumLeads(previous));
              return d === null ? null : (
                <p className={clsx('tnum text-[12px] font-medium', d >= 0 ? 'text-good-700' : 'text-bad-700')}>
                  <span aria-hidden="true">{d >= 0 ? '↑' : '↓'}</span> {Math.abs(d).toFixed(0)}%
                </p>
              );
            })()}
          </div>
        }
      >
        <Chart series={leadSeries(current)} labels={labels} />
      </Card>

      <Card
        title="Customer actions"
        description="Each action with its conversion rate against page views."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[13.5px]">
            <thead>
              <tr className="border-b border-ink-200 text-[11.5px] uppercase tracking-wider text-ink-500">
                <th className="py-2 pr-3 text-left font-semibold">Action</th>
                <th className="py-2 px-3 text-right font-semibold">Count</th>
                <th className="py-2 px-3 text-right font-semibold">Per 100</th>
                <th className="py-2 pl-3 text-right font-semibold">Change</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
                const cur = sumField(current, a.key);
                const prev = sumField(previous, a.key);
                const d = delta(cur, prev);
                return (
                  <tr key={a.key} className="border-b border-ink-100 last:border-0">
                    <td className="py-2.5 pr-3 text-ink-900" title={a.def}>{a.label}</td>
                    <td className="tnum py-2.5 px-3 text-right font-medium text-ink-900">
                      {cur.toLocaleString()}
                    </td>
                    <td className="tnum py-2.5 px-3 text-right text-ink-600">
                      {views ? ((cur / views) * 100).toFixed(1) : '—'}
                    </td>
                    <td className={clsx(
                      'tnum py-2.5 pl-3 text-right font-medium',
                      d === null ? 'text-ink-400' : d >= 0 ? 'text-good-700' : 'text-bad-700',
                    )}>
                      {d === null ? 'No prior' : (
                        <>
                          <span aria-hidden="true">{d >= 0 ? '↑' : '↓'}</span>{' '}
                          {Math.abs(d).toFixed(0)}%
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Where visitors came from" description="Share of page views by source.">
        <ul className="space-y-2.5">
          {Object.entries(sources).map(([key, pct]) => (
            <li key={key} className="sm:flex sm:items-center sm:gap-3">
              <span className="block text-[13px] text-ink-700 sm:w-56 sm:shrink-0">
                {SOURCE_LABEL[key] ?? key}
              </span>
              <span className="mt-1 flex items-center gap-3 sm:mt-0 sm:flex-1">
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                </span>
                <span className="tnum w-10 text-right text-[13px] text-ink-600">{pct}%</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="rounded-md border-l-2 border-ink-300 bg-ink-100 px-4 py-3 text-[13px] text-ink-700">
        Numbers exclude visits from people on your own team and traffic we
        identify as automated. When we improve that filtering, historical
        figures can shift slightly &mdash; we stamp each day with the filter
        version so the change is explainable rather than mysterious.
      </div>
    </div>
  );
}
