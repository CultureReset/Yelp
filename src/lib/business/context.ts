import { eq, and, isNull, inArray, sql, desc, count } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  businesses, reviews, reviewReplies, conversations,
  businessEdits, notifications,
} from '@/db/schema';
import type { AuthContext } from '@/lib/permissions';

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  status: string;
  claimStatus: string;
  ratingAvg: number | null;
  reviewCount: number;
  photoCount: number;
}

/**
 * Every listing read goes through here so org and location scope are applied
 * in one place. No page builds its own `where` clause.
 */
export async function listBusinesses(ctx: AuthContext): Promise<BusinessSummary[]> {
  const conds = [eq(businesses.orgId, ctx.orgId), isNull(businesses.deletedAt)];
  if (ctx.locationScope !== 'all') {
    if (ctx.locationScope.length === 0) return [];
    conds.push(inArray(businesses.id, ctx.locationScope));
  }

  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      city: businesses.city,
      state: businesses.state,
      status: businesses.status,
      claimStatus: businesses.claimStatus,
      ratingAvg: businesses.ratingAvg,
      reviewCount: businesses.reviewCount,
      photoCount: businesses.photoCount,
    })
    .from(businesses)
    .where(and(...conds))
    .orderBy(businesses.name);

  return rows.map((r) => ({ ...r, ratingAvg: r.ratingAvg ? Number(r.ratingAvg) : null }));
}

export async function getActiveBusiness(
  ctx: AuthContext,
  preferredId?: string | null,
): Promise<BusinessSummary | null> {
  const all = await listBusinesses(ctx);
  if (all.length === 0) return null;
  if (preferredId) {
    const match = all.find((b) => b.id === preferredId);
    if (match) return match;
  }
  return all[0];
}

/** Counts for the nav badges and the Home attention row. */
export async function getAttentionCounts(businessId: string) {
  const [unrepliedRows, unreadRows, pendingRows, notifRows] = await Promise.all([
    db.select({ n: count() })
      .from(reviews)
      .leftJoin(reviewReplies, and(
        eq(reviewReplies.reviewId, reviews.id),
        isNull(reviewReplies.deletedAt),
      ))
      .where(and(
        eq(reviews.businessId, businessId),
        eq(reviews.visibility, 'recommended'),
        isNull(reviewReplies.id),
      )),
    db.select({ n: count() })
      .from(conversations)
      .where(and(
        eq(conversations.businessId, businessId),
        sql`${conversations.unreadForBusiness} > 0`,
        isNull(conversations.archivedAt),
      )),
    db.select({ n: count() })
      .from(businessEdits)
      .where(and(
        eq(businessEdits.businessId, businessId),
        eq(businessEdits.status, 'pending'),
      )),
    db.select({ n: count() })
      .from(notifications)
      .where(and(
        eq(notifications.businessId, businessId),
        isNull(notifications.readAt),
      )),
  ]);

  return {
    unrepliedReviews: unrepliedRows[0]?.n ?? 0,
    unreadLeads: unreadRows[0]?.n ?? 0,
    pendingEdits: pendingRows[0]?.n ?? 0,
    notifications: notifRows[0]?.n ?? 0,
  };
}

/** Oldest unreplied review, used for the "oldest waiting" attention card. */
export async function getOldestUnrepliedReview(businessId: string) {
  const rows = await db
    .select({ id: reviews.id, createdAt: reviews.createdAt, rating: reviews.rating })
    .from(reviews)
    .leftJoin(reviewReplies, and(
      eq(reviewReplies.reviewId, reviews.id),
      isNull(reviewReplies.deletedAt),
    ))
    .where(and(
      eq(reviews.businessId, businessId),
      eq(reviews.visibility, 'recommended'),
      isNull(reviewReplies.id),
    ))
    .orderBy(reviews.createdAt)
    .limit(1);
  return rows[0] ?? null;
}

export async function getRecentActivity(businessId: string, limit = 12) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.businessId, businessId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
