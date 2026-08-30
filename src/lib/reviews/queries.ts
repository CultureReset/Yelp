import { eq, and, isNull, desc, asc, inArray, sql, count, ilike, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { reviews, reviewReplies } from '@/db/schema';

export interface ReviewFilters {
  ratings?: number[];
  replied?: 'yes' | 'no';
  visibility?: 'recommended' | 'not_recommended';
  q?: string;
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
  page?: number;
  perPage?: number;
}

export interface ReviewRow {
  review: typeof reviews.$inferSelect;
  reply: typeof reviewReplies.$inferSelect | null;
}

export async function listReviews(businessId: string, f: ReviewFilters) {
  const perPage = f.perPage ?? 20;
  const page = Math.max(1, f.page ?? 1);

  const conds = [eq(reviews.businessId, businessId)];
  conds.push(eq(reviews.visibility, f.visibility ?? 'recommended'));
  if (f.ratings?.length) conds.push(inArray(reviews.rating, f.ratings));
  if (f.q) {
    const term = `%${f.q}%`;
    conds.push(or(ilike(reviews.body, term), ilike(reviews.authorName, term))!);
  }
  if (f.replied === 'no') conds.push(isNull(reviewReplies.id));
  if (f.replied === 'yes') conds.push(sql`${reviewReplies.id} is not null`);

  const order = {
    newest:  desc(reviews.createdAt),
    oldest:  asc(reviews.createdAt),
    highest: desc(reviews.rating),
    lowest:  asc(reviews.rating),
  }[f.sort ?? 'newest'];

  const join = and(eq(reviewReplies.reviewId, reviews.id), isNull(reviewReplies.deletedAt));

  const [rows, totalRows] = await Promise.all([
    db.select({ review: reviews, reply: reviewReplies })
      .from(reviews)
      .leftJoin(reviewReplies, join)
      .where(and(...conds))
      .orderBy(order)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ n: count() })
      .from(reviews)
      .leftJoin(reviewReplies, join)
      .where(and(...conds)),
  ]);

  return {
    rows: rows as ReviewRow[],
    total: totalRows[0]?.n ?? 0,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil((totalRows[0]?.n ?? 0) / perPage)),
  };
}

/** Rating distribution and reply coverage for the Insights tab. */
export async function getReviewInsights(businessId: string) {
  const join = and(eq(reviewReplies.reviewId, reviews.id), isNull(reviewReplies.deletedAt));

  const [dist, coverage, notRecommended] = await Promise.all([
    db.select({ rating: reviews.rating, n: count() })
      .from(reviews)
      .where(and(eq(reviews.businessId, businessId), eq(reviews.visibility, 'recommended')))
      .groupBy(reviews.rating),
    db.select({
      total: count(),
      replied: sql<number>`count(${reviewReplies.id})::int`,
    })
      .from(reviews)
      .leftJoin(reviewReplies, join)
      .where(and(eq(reviews.businessId, businessId), eq(reviews.visibility, 'recommended'))),
    db.select({ n: count() })
      .from(reviews)
      .where(and(eq(reviews.businessId, businessId), eq(reviews.visibility, 'not_recommended'))),
  ]);

  const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of dist) byRating[d.rating] = d.n;

  const total = coverage[0]?.total ?? 0;
  const replied = coverage[0]?.replied ?? 0;

  return {
    byRating,
    total,
    replied,
    replyCoverage: total > 0 ? Math.round((replied / total) * 100) : 0,
    notRecommendedCount: notRecommended[0]?.n ?? 0,
  };
}
