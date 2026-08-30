import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/lib/permissions';
import { db } from '@/db/client';
import { sessions, replyDrafts } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getActiveBusiness } from '@/lib/business/context';
import { listReviews, getReviewInsights, type ReviewFilters } from '@/lib/reviews/queries';
import { ReviewCard } from './review-card';
import { Card, Badge, EmptyState, Alert } from '@/components/ui';
import clsx from 'clsx';

export const metadata: Metadata = { title: 'Reviews' };

type SP = Promise<Record<string, string | undefined>>;

function buildQuery(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const merged = { ...base, ...patch, page: undefined };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : '';
}

function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={clsx(
        'rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors',
        active
          ? 'border-brand-700 bg-brand-700 text-white'
          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900',
      )}
    >
      {children}
    </Link>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requireAuth();
  const sp = await searchParams;

  const [session] = await db
    .select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);
  const active = await getActiveBusiness(ctx, session?.activeBusinessId);

  if (!active) {
    return <Card><EmptyState title="No business selected" description="Claim a business to see its reviews." /></Card>;
  }

  const filters: ReviewFilters = {
    ratings: sp.rating ? sp.rating.split(',').map(Number).filter((n) => n >= 1 && n <= 5) : undefined,
    replied: sp.filter === 'unreplied' ? 'no' : sp.filter === 'replied' ? 'yes' : undefined,
    visibility: sp.visibility === 'not_recommended' ? 'not_recommended' : 'recommended',
    q: sp.q || undefined,
    sort: (sp.sort as ReviewFilters['sort']) ?? 'newest',
    page: sp.page ? Number(sp.page) : 1,
  };

  const [result, insights] = await Promise.all([
    listReviews(active.id, filters),
    getReviewInsights(active.id),
  ]);

  // Restore any in-progress replies for this user.
  const ids = result.rows.map((r) => r.review.id);
  const drafts = ids.length
    ? await db.select().from(replyDrafts).where(and(
        inArray(replyDrafts.reviewId, ids),
        eq(replyDrafts.userId, ctx.userId),
      ))
    : [];
  const draftMap = Object.fromEntries(drafts.map((d) => [d.reviewId, d.body]));

  const canReply = can(ctx, 'review.reply', active.id);
  const canReport = can(ctx, 'review.report', active.id);
  const maxBar = Math.max(...Object.values(insights.byRating), 1);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Reviews</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">
          Reply publicly or by direct message. Reviews are written by customers —
          businesses cannot edit or remove them.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((r) => (
              <div key={r} className="flex items-center gap-2.5">
                <span className="tnum w-3 text-[12.5px] text-ink-500">{r}</span>
                <span aria-hidden="true" className="text-[11px] text-brand-600">★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(insights.byRating[r] / maxBar) * 100}%` }}
                  />
                </div>
                <span className="tnum w-10 text-right text-[12.5px] text-ink-600">
                  {insights.byRating[r]}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-[12.5px] text-ink-500">Reply coverage</p>
          <p className="tnum mt-1 text-2xl font-bold text-ink-900">{insights.replyCoverage}%</p>
          <p className="mt-0.5 text-[12.5px] text-ink-500">
            {insights.replied} of {insights.total} replied
          </p>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill href={`/dashboard/reviews${buildQuery(sp, { filter: undefined })}`} active={!sp.filter}>
            All
          </FilterPill>
          <FilterPill href={`/dashboard/reviews${buildQuery(sp, { filter: 'unreplied' })}`} active={sp.filter === 'unreplied'}>
            Needs a reply
          </FilterPill>
          <FilterPill href={`/dashboard/reviews${buildQuery(sp, { filter: 'replied' })}`} active={sp.filter === 'replied'}>
            Replied
          </FilterPill>
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-ink-200" />
          {[5, 4, 3, 2, 1].map((r) => (
            <FilterPill
              key={r}
              href={`/dashboard/reviews${buildQuery(sp, { rating: sp.rating === String(r) ? undefined : String(r) })}`}
              active={sp.rating === String(r)}
            >
              {r} ★
            </FilterPill>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            href={`/dashboard/reviews${buildQuery(sp, { visibility: undefined })}`}
            active={filters.visibility === 'recommended'}
          >
            Recommended ({insights.total})
          </FilterPill>
          <FilterPill
            href={`/dashboard/reviews${buildQuery(sp, { visibility: 'not_recommended' })}`}
            active={filters.visibility === 'not_recommended'}
          >
            Not recommended ({insights.notRecommendedCount})
          </FilterPill>
        </div>
      </div>

      {filters.visibility === 'not_recommended' && (
        <Alert tone="info" title="Why some reviews are not recommended">
          Our software weighs reviewer history, review quality, and solicitation
          signals to decide which reviews are shown prominently. These reviews
          are still public, but they don&apos;t count toward your rating.
          No one — including our sales team — can change this classification.
        </Alert>
      )}

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No reviews match these filters"
            description="Try clearing a filter, or check the other recommendation tab."
          />
        </Card>
      ) : (
        <>
          <p className="text-[13px] text-ink-500">
            {result.total.toLocaleString()} review{result.total === 1 ? '' : 's'}
          </p>
          <ul className="space-y-3">
            {result.rows.map(({ review, reply }) => (
              <li key={review.id}>
                <ReviewCard
                  review={{
                    id: review.id,
                    authorName: review.authorName,
                    authorCity: review.authorCity,
                    authorReviewCount: review.authorReviewCount,
                    rating: review.rating,
                    body: review.body,
                    createdAt: review.createdAt.toISOString(),
                    helpfulCount: review.helpfulCount,
                    visibility: review.visibility,
                  }}
                  reply={reply ? {
                    body: reply.body,
                    createdAt: reply.createdAt.toISOString(),
                    editedAt: reply.editedAt?.toISOString() ?? null,
                  } : null}
                  draft={draftMap[review.id] ?? ''}
                  canReply={canReply}
                  canReport={canReport}
                />
              </li>
            ))}
          </ul>

          {result.pageCount > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Pagination">
              {result.page > 1 && (
                <Link
                  href={`/dashboard/reviews?${new URLSearchParams({ ...sp, page: String(result.page - 1) } as Record<string, string>)}`}
                  className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-[13px] hover:bg-ink-50"
                >
                  Previous
                </Link>
              )}
              <span className="tnum text-[13px] text-ink-500">
                Page {result.page} of {result.pageCount}
              </span>
              {result.page < result.pageCount && (
                <Link
                  href={`/dashboard/reviews?${new URLSearchParams({ ...sp, page: String(result.page + 1) } as Record<string, string>)}`}
                  className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-[13px] hover:bg-ink-50"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
