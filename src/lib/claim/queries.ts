import { eq, and, or, ilike, isNull, sql, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { businesses, claims } from '@/db/schema';

export async function searchUnclaimed(q: string, limit = 12) {
  const term = `%${q.trim()}%`;
  return db.select({
    id: businesses.id,
    name: businesses.name,
    address1: businesses.address1,
    city: businesses.city,
    state: businesses.state,
    phone: businesses.phone,
    claimStatus: businesses.claimStatus,
    ratingAvg: businesses.ratingAvg,
    reviewCount: businesses.reviewCount,
  })
    .from(businesses)
    .where(and(
      isNull(businesses.deletedAt),
      sql`${businesses.status} <> 'removed'`,
      or(
        ilike(businesses.name, term),
        ilike(businesses.city, term),
        ilike(businesses.address1, term),
      ),
    ))
    .orderBy(desc(businesses.reviewCount))
    .limit(limit);
}

export async function getClaimContext(businessId: string, userId: string) {
  const [biz] = await db.select().from(businesses)
    .where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return null;

  const [claim] = await db.select().from(claims)
    .where(and(eq(claims.businessId, businessId), eq(claims.userId, userId)))
    .orderBy(desc(claims.createdAt)).limit(1);

  return { biz, claim: claim ?? null };
}
