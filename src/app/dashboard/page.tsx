import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/lib/permissions';
import { db } from '@/db/client';
import { sessions, businesses, businessHours, services } from '@/db/schema';
import { eq, and, count, ne } from 'drizzle-orm';
import {
  getActiveBusiness, getAttentionCounts,
  getOldestUnrepliedReview, getRecentActivity,
} from '@/lib/business/context';
import { getSnapshot } from '@/lib/metrics/query';
import { MetricTile } from '@/components/metrics';
import { Card, Badge, Stars, EmptyState, LinkButton } from '@/components/ui';

export const metadata: Metadata = { title: 'Home' };

function relativeDays(from: Date): string {
  const days = Math.floor((Date.now() - from.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** Scored checklist. Shows the reason, not just a percentage. */
function completeness(
  biz: typeof businesses.$inferSelect,
  hasHours: boolean,
  hasServices: boolean,
) {
  const items = [
    { label: 'Add business hours',       href: '/dashboard/business#hours',      done: hasHours },
    { label: 'Write a description',      href: '/dashboard/business#basics',     done: !!biz.description },
    { label: 'Add a phone number',       href: '/dashboard/business#contact',    done: !!biz.phone },
    { label: 'Add your website',         href: '/dashboard/business#contact',    done: !!biz.website },
    { label: 'Upload at least 5 photos', href: '/dashboard/photos',              done: biz.photoCount >= 5 },
    { label: 'Set your price range',     href: '/dashboard/business#basics',     done: !!biz.priceTier },
    { label: 'List your services',       href: '/dashboard/menu',                done: hasServices },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, pct: Math.round((done / items.length) * 100) };
}

export default async function HomePage() {
  const ctx = await requireAuth();

  const [session] = await db
    .select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);

  const active = await getActiveBusiness(ctx, session?.activeBusinessId);

  if (!active) {
    return (
      <Card>
        <EmptyState
          title="No business yet"
          description="Claim a listing that already exists, or add your business if it isn't listed."
          action={<LinkButton href="/claim">Claim your business</LinkButton>}
        />
      </Card>
    );
  }

  const [full] = await db.select().from(businesses).where(eq(businesses.id, active.id)).limit(1);
  const [counts, snapshot, oldest, activity, hourRows, serviceRows] = await Promise.all([
    getAttentionCounts(active.id),
    getSnapshot(active.id),
    getOldestUnrepliedReview(active.id),
    getRecentActivity(active.id),
    db.select({ n: count() }).from(businessHours).where(and(
      eq(businessHours.businessId, active.id),
      ne(businessHours.isClosed, true),
    )),
    db.select({ n: count() }).from(services).where(and(
      eq(services.businessId, active.id),
      eq(services.isActive, true),
    )),
  ]);

  const profile = completeness(full, (hourRows[0]?.n ?? 0) > 0, (serviceRows[0]?.n ?? 0) > 0);

  // Only actionable cards render. The row collapses rather than showing zeroes.
  const attention = [
    counts.unrepliedReviews > 0 && {
      href: '/dashboard/reviews?filter=unreplied',
      title: `${counts.unrepliedReviews} review${counts.unrepliedReviews === 1 ? '' : 's'} without a reply`,
      detail: oldest ? `Oldest has been waiting ${relativeDays(oldest.createdAt)}.` : null,
      tone: 'warn' as const,
    },
    counts.unreadLeads > 0 && {
      href: '/dashboard/inbox?filter=unread',
      title: `${counts.unreadLeads} unread message${counts.unreadLeads === 1 ? '' : 's'}`,
      detail: 'Response time shows on your public page.',
      tone: 'bad' as const,
    },
    counts.pendingEdits > 0 && {
      href: '/dashboard/business',
      title: `${counts.pendingEdits} edit${counts.pendingEdits === 1 ? '' : 's'} in review`,
      detail: 'We’ll email you when a decision is made.',
      tone: 'neutral' as const,
    },
  ].filter(Boolean) as Array<{ href: string; title: string; detail: string | null; tone: 'warn' | 'bad' | 'neutral' }>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink-900">{full.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {full.ratingAvg
              ? <Stars rating={Number(full.ratingAvg)} />
              : <span className="text-[13px] text-ink-500">No reviews yet</span>}
            <span className="text-[13px] text-ink-500">
              {full.reviewCount.toLocaleString()} review{full.reviewCount === 1 ? '' : 's'}
            </span>
            {full.claimStatus === 'claimed'
              ? <Badge tone="good">✓ Verified</Badge>
              : <Badge tone="warn">Unverified</Badge>}
            {full.status === 'closed_temp' && <Badge tone="warn">Temporarily closed</Badge>}
          </div>
        </div>
        <a
          href={`/biz/${full.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium text-brand-700 hover:underline"
        >
          View my public page ↗
        </a>
      </header>

      {attention.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attention.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="block rounded-lg border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <Badge tone={a.tone}>Needs attention</Badge>
                <p className="mt-2 text-[14px] font-semibold text-ink-900">{a.title}</p>
                {a.detail && <p className="mt-0.5 text-[12.5px] text-ink-500">{a.detail}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {can(ctx, 'analytics.read', active.id) && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink-900">Last 30 days</h2>
            <p className="text-[12px] text-ink-500">
              {snapshot.freshness
                ? `Through ${snapshot.freshness.toLocaleDateString()}`
                : 'No data yet'}
              {' · vs previous 30 days'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.metrics.map((m) => <MetricTile key={m.key} metric={m} />)}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card title="Recent activity" description="Reviews, photos, questions, and messages.">
          {activity.length === 0 ? (
            <EmptyState
              title="Nothing yet"
              description="Customer activity on your page will appear here."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {activity.map((a) => (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={a.href ?? '#'} className="group block">
                    <p className="text-[13.5px] font-medium text-ink-900 group-hover:text-brand-700">
                      {a.title}
                    </p>
                    {a.body && <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-500">{a.body}</p>}
                    <p className="mt-1 text-[12px] text-ink-400">
                      {a.createdAt.toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Profile strength">
          <div className="flex items-baseline gap-2">
            <span className="tnum text-2xl font-bold text-ink-900">{profile.pct}%</span>
            <span className="text-[12.5px] text-ink-500">
              {profile.done} of {profile.total} done
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${profile.pct}%` }}
              role="progressbar"
              aria-valuenow={profile.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completeness"
            />
          </div>
          <ul className="mt-4 space-y-2">
            {profile.items.filter((i) => !i.done).map((i) => (
              <li key={i.label}>
                <Link href={i.href} className="flex items-center gap-2 text-[13px] text-ink-600 hover:text-brand-700">
                  <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border border-ink-300" />
                  {i.label}
                </Link>
              </li>
            ))}
            {profile.items.filter((i) => i.done).map((i) => (
              <li key={i.label} className="flex items-center gap-2 text-[13px] text-ink-400">
                <span aria-hidden="true" className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-good-500 text-[9px] text-white">✓</span>
                <span className="line-through">{i.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
