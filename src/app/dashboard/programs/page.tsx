import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { can } from '@/lib/permissions';
import { db } from '@/db/client';
import { sessions, programs, adCampaigns, adSpendDaily, entitlements } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { getActiveBusiness } from '@/lib/business/context';
import { Card, EmptyState, Badge, Button } from '@/components/ui';

export const metadata: Metadata = { title: 'Programs' };

function money(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

const PROGRAM_LABEL: Record<string, { name: string; blurb: string }> = {
  ads: { name: 'Advertising', blurb: 'Cost-per-click placements in search results and on competitor pages.' },
  upgrade_profile: { name: 'Enhanced profile', blurb: 'Call-to-action button, photo slideshow, logo, and business highlights.' },
  remove_competitor_ads: { name: 'Remove competitor ads', blurb: 'Clears competitor placements from your business page.' },
  verified_license: { name: 'Verified license', blurb: 'A verified badge for licensed trades.' },
  deals: { name: 'Deals & gift certificates', blurb: 'Prepaid offers customers buy up front.' },
  reservations: { name: 'Reservations', blurb: 'Table inventory, guest notifications, and no-show tracking.' },
  appointments: { name: 'Appointments', blurb: 'Bookable services with staff calendars and reminders.' },
  job_postings: { name: 'Job postings', blurb: 'Hiring listings with an applications inbox.' },
};

const AVAILABLE = ['verified_license', 'reservations', 'appointments', 'job_postings'];

/** Days elapsed in the current calendar month, and days remaining. */
function monthPacing() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  const total = end.getDate();
  return { elapsed, total, remaining: total - elapsed, start };
}

export default async function ProgramsPage() {
  const ctx = await requirePermission('ads.read');

  const [session] = await db.select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);
  const active = await getActiveBusiness(ctx, session?.activeBusinessId);
  if (!active) {
    return <Card><EmptyState title="No business selected" description="Claim a business first." /></Card>;
  }

  const pacing = monthPacing();
  const monthStart = pacing.start.toISOString().slice(0, 10);

  const [progs, campaigns, spend, ents] = await Promise.all([
    db.select().from(programs).where(eq(programs.businessId, active.id)).orderBy(desc(programs.startedAt)),
    db.select().from(adCampaigns).where(eq(adCampaigns.businessId, active.id)).orderBy(desc(adCampaigns.startedAt)),
    db.select().from(adSpendDaily)
      .where(and(eq(adSpendDaily.businessId, active.id), gte(adSpendDaily.day, monthStart)))
      .orderBy(adSpendDaily.day),
    db.select().from(entitlements)
      .where(and(eq(entitlements.businessId, active.id), eq(entitlements.active, true))),
  ]);

  const totals = spend.reduce(
    (a, r) => ({
      impressions: a.impressions + r.impressions,
      clicks: a.clicks + r.clicks,
      leads: a.leads + r.leads,
      spend: a.spend + r.spendCents,
      invalid: a.invalid + r.invalidClicks,
    }),
    { impressions: 0, clicks: 0, leads: 0, spend: 0, invalid: 0 },
  );

  const activeCampaign = campaigns.find((c) => c.status === 'active');
  const budget = activeCampaign?.budgetCents ?? 0;
  const pacedShare = budget > 0 ? Math.round((totals.spend / budget) * 100) : 0;
  const expectedShare = Math.round((pacing.elapsed / pacing.total) * 100);
  const projected = pacing.elapsed > 0
    ? Math.round((totals.spend / pacing.elapsed) * pacing.total)
    : 0;

  const canWrite = can(ctx, 'ads.write', active.id);
  const activeKinds = new Set(progs.filter((p) => p.status === 'active').map((p) => p.kind));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Programs</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-500">
          Advertising, profile upgrades, and growth tools. Every program shows
          its price, its performance, and how to cancel.
        </p>
      </header>

      {activeCampaign && (
        <Card
          title={activeCampaign.name}
          description={`${money(budget)} monthly budget · ${activeCampaign.objective} · ${activeCampaign.geoRadiusMi}-mile radius`}
          action={
            <div className="flex gap-2">
              <Badge tone="good">Active</Badge>
              {canWrite && <Button size="sm" variant="secondary" disabled>Edit</Button>}
            </div>
          }
        >
          {/* Pacing first: owners cancel when a bill surprises them. */}
          <div className="rounded-md bg-ink-100 p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium text-ink-900">
                Budget pacing &mdash; day {pacing.elapsed} of {pacing.total}
              </p>
              <p className="tnum text-[13px] text-ink-600">
                {money(totals.spend)} of {money(budget)}
              </p>
            </div>
            <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-ink-200">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${Math.min(100, pacedShare)}%` }}
                role="progressbar"
                aria-valuenow={pacedShare}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Budget spent this month"
              />
              <span
                aria-hidden="true"
                title="Where an even spend would be today"
                className="absolute top-0 h-full w-0.5 bg-ink-900"
                style={{ left: `${Math.min(100, expectedShare)}%` }}
              />
            </div>
            <p className="mt-2 text-[12.5px] text-ink-600">
              {pacedShare > expectedShare + 8
                ? `Spending faster than an even pace. At this rate you will reach ${money(projected)} by month end.`
                : pacedShare < expectedShare - 8
                ? `Spending slower than an even pace. Projected ${money(projected)} by month end.`
                : `On pace. Projected ${money(projected)} by month end.`}
              {' '}The marker shows where an even spend would be today.
            </p>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ['Impressions', totals.impressions.toLocaleString()],
              ['Clicks', totals.clicks.toLocaleString()],
              ['Click rate', totals.impressions ? `${((totals.clicks / totals.impressions) * 100).toFixed(1)}%` : '—'],
              ['Avg. cost per click', totals.clicks ? money(Math.round(totals.spend / totals.clicks)) : '—'],
              ['Cost per lead', totals.leads ? money(Math.round(totals.spend / totals.leads)) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-ink-200 p-3">
                <dt className="text-[12px] text-ink-500">{label}</dt>
                <dd className="tnum mt-0.5 text-[17px] font-bold text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>

          {totals.invalid > 0 && (
            <p className="mt-3 rounded bg-good-50 px-3 py-2 text-[12.5px] text-good-700">
              {totals.invalid} invalid click{totals.invalid === 1 ? '' : 's'} filtered
              this month and not charged to you.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
            <span className="text-[12.5px] text-ink-500">Targeting:</span>
            {activeCampaign.keywordTargets?.map((k) => (
              <Badge key={k} tone="neutral">{k}</Badge>
            ))}
          </div>
        </Card>
      )}

      <Card title="Your programs" description="What you are subscribed to right now.">
        {progs.length === 0 ? (
          <EmptyState title="No active programs" description="Browse the options below to get started." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {progs.map((p) => {
              const meta = PROGRAM_LABEL[p.kind] ?? { name: p.kind, blurb: '' };
              return (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium text-ink-900">{meta.name}</p>
                      {p.status === 'active' && <Badge tone="good">Active</Badge>}
                      {p.status === 'paused' && <Badge tone="warn">Paused</Badge>}
                      {p.status === 'cancelled' && <Badge tone="neutral">Cancelled</Badge>}
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-500">{meta.blurb}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-[13.5px] font-medium text-ink-900">
                      {p.priceCents ? `${money(p.priceCents)}/mo` : 'Usage-based'}
                    </p>
                    {can(ctx, 'program.cancel', active.id) && p.status === 'active' && (
                      <Button size="sm" variant="ghost" disabled>Cancel</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {ents.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
            <span className="text-[12.5px] text-ink-500">Features switched on:</span>
            {ents.map((e) => (
              <Badge key={e.id} tone="brand">{e.feature.replace(/_/g, ' ')}</Badge>
            ))}
          </div>
        )}
      </Card>

      <Card title="Available to add" description="Priced before you commit, cancellable from this page.">
        <ul className="grid gap-3 sm:grid-cols-2">
          {AVAILABLE.filter((k) => !activeKinds.has(k)).map((kind) => {
            const meta = PROGRAM_LABEL[kind];
            return (
              <li key={kind} className="rounded-md border border-ink-200 p-3.5">
                <p className="text-[14px] font-medium text-ink-900">{meta.name}</p>
                <p className="mt-0.5 text-[13px] text-ink-500">{meta.blurb}</p>
                <div className="mt-3">
                  <Button size="sm" variant="secondary" disabled>Learn more</Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="rounded-md border-l-2 border-ink-300 bg-ink-100 px-4 py-3 text-[13px] text-ink-700">
        Advertising affects where your ads appear. It does not affect your star
        rating, which reviews are recommended, or where you rank in ordinary
        search results.
      </div>
    </div>
  );
}
