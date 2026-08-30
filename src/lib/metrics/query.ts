import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { metricsDaily } from '@/db/schema';
import { METRIC_DEFINITIONS } from './definitions';
import type { Metric } from '@/components/metrics';

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export type Rollup = typeof metricsDaily.$inferSelect;

/**
 * Reads pre-aggregated rollups only. A page load must never scan raw events —
 * it works on test data and falls over on a business with a million views.
 */
export async function getRollups(
  businessId: string,
  from: Date,
  to: Date,
): Promise<Rollup[]> {
  return db
    .select()
    .from(metricsDaily)
    .where(and(
      eq(metricsDaily.businessId, businessId),
      gte(metricsDaily.day, dayKey(from)),
      lte(metricsDaily.day, dayKey(to)),
    ))
    .orderBy(metricsDaily.day);
}

const SUMMABLE = [
  'pageViews', 'uniqueVisitors', 'calls', 'directions', 'websiteClicks',
  'messages', 'quoteRequests', 'menuViews', 'photoViews', 'bookmarks',
  'shares', 'orderClicks', 'reservationClicks',
] as const;

type Summable = (typeof SUMMABLE)[number];

export function sumField(rows: Rollup[], field: Summable): number {
  return rows.reduce((acc, r) => acc + (r[field] ?? 0), 0);
}

/** Customer leads = the seven action metrics, summed. Defined once. */
export function sumLeads(rows: Rollup[]): number {
  return rows.reduce((acc, r) =>
    acc + r.calls + r.directions + r.websiteClicks + r.messages
        + r.quoteRequests + r.orderClicks + r.reservationClicks, 0);
}

export function seriesOf(rows: Rollup[], field: Summable): number[] {
  return rows.map((r) => r[field] ?? 0);
}

export function leadSeries(rows: Rollup[]): number[] {
  return rows.map((r) =>
    r.calls + r.directions + r.websiteClicks + r.messages
    + r.quoteRequests + r.orderClicks + r.reservationClicks);
}

/** The Home snapshot: last 30 days against the previous 30. */
export async function getSnapshot(businessId: string): Promise<{
  metrics: Metric[];
  freshness: Date | null;
}> {
  const [current, previous] = await Promise.all([
    getRollups(businessId, daysAgo(29), daysAgo(0)),
    getRollups(businessId, daysAgo(59), daysAgo(30)),
  ]);

  const metrics: Metric[] = [
    {
      key: 'pageViews',
      label: 'Page views',
      value: sumField(current, 'pageViews'),
      previous: sumField(previous, 'pageViews'),
      series: seriesOf(current, 'pageViews'),
      definition: METRIC_DEFINITIONS.pageViews,
    },
    {
      key: 'customerLeads',
      label: 'Customer leads',
      value: sumLeads(current),
      previous: sumLeads(previous),
      series: leadSeries(current),
      definition: METRIC_DEFINITIONS.customerLeads,
    },
    {
      key: 'calls',
      label: 'Calls',
      value: sumField(current, 'calls'),
      previous: sumField(previous, 'calls'),
      series: seriesOf(current, 'calls'),
      definition: METRIC_DEFINITIONS.calls,
    },
    {
      key: 'directions',
      label: 'Direction requests',
      value: sumField(current, 'directions'),
      previous: sumField(previous, 'directions'),
      series: seriesOf(current, 'directions'),
      definition: METRIC_DEFINITIONS.directions,
    },
    {
      key: 'websiteClicks',
      label: 'Website clicks',
      value: sumField(current, 'websiteClicks'),
      previous: sumField(previous, 'websiteClicks'),
      series: seriesOf(current, 'websiteClicks'),
      definition: METRIC_DEFINITIONS.websiteClicks,
    },
  ];

  const latest = current[current.length - 1];
  return { metrics, freshness: latest?.computedAt ?? null };
}
