import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { rateLimits } from '@/db/schema';

export interface LimitResult { allowed: boolean; retryAfterSec?: number }

/**
 * Per-account exponential backoff. A per-IP sliding window and a global
 * anomaly detector run alongside this in production — the per-account limiter
 * never sees credential stuffing (many accounts, one IP, one attempt each).
 */
export async function consume(
  key: string,
  opts: { max: number; windowSec: number; backoff?: boolean } = { max: 5, windowSec: 900 },
): Promise<LimitResult> {
  const now = new Date();
  const [existing] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((existing.blockedUntil.getTime() - now.getTime()) / 1000),
    };
  }

  const windowExpired =
    !existing || now.getTime() - existing.windowStart.getTime() > opts.windowSec * 1000;

  if (windowExpired) {
    await db.insert(rateLimits)
      .values({ key, count: 1, windowStart: now, blockedUntil: null })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: 1, windowStart: now, blockedUntil: null },
      });
    return { allowed: true };
  }

  const next = existing.count + 1;
  if (next > opts.max) {
    const over = next - opts.max;
    const delaySec = opts.backoff === false
      ? opts.windowSec
      : Math.min(2 ** over * 30, 3600);
    const blockedUntil = new Date(now.getTime() + delaySec * 1000);
    await db.update(rateLimits)
      .set({ count: next, blockedUntil })
      .where(eq(rateLimits.key, key));
    return { allowed: false, retryAfterSec: delaySec };
  }

  await db.update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1` })
    .where(eq(rateLimits.key, key));
  return { allowed: true };
}

export async function reset(key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
