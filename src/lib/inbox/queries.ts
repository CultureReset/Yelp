import { eq, and, isNull, desc, sql, count, gte, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { conversations, messages, quoteRequests, messageTemplates, inboxSettings } from '@/db/schema';

export interface InboxFilters {
  status?: 'open' | 'won' | 'lost' | 'closed' | 'spam';
  unread?: boolean;
  unanswered?: boolean;
  kind?: 'quote_request' | 'message' | 'appointment';
}

export async function listConversations(businessId: string, f: InboxFilters = {}) {
  const conds = [eq(conversations.businessId, businessId), isNull(conversations.archivedAt)];
  if (f.status) conds.push(eq(conversations.status, f.status));
  if (f.kind) conds.push(eq(conversations.kind, f.kind));
  if (f.unread) conds.push(sql`${conversations.unreadForBusiness} > 0`);
  if (f.unanswered) conds.push(isNull(conversations.firstResponseAt));

  return db.select().from(conversations)
    .where(and(...conds))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getConversation(businessId: string, id: string) {
  const [convo] = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.businessId, businessId)))
    .limit(1);
  if (!convo) return null;

  const [msgs, quote] = await Promise.all([
    db.select().from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt),
    db.select().from(quoteRequests)
      .where(eq(quoteRequests.conversationId, id)).limit(1),
  ]);

  return { convo, messages: msgs, quote: quote[0] ?? null };
}

export async function getTemplates(businessId: string) {
  return db.select().from(messageTemplates)
    .where(eq(messageTemplates.businessId, businessId))
    .orderBy(desc(messageTemplates.useCount));
}

export async function getInboxSettings(businessId: string) {
  const [row] = await db.select().from(inboxSettings)
    .where(eq(inboxSettings.businessId, businessId)).limit(1);
  return row ?? null;
}

/**
 * Response rate and median response time, trailing 30 days, excluding spam.
 * These render publicly, so the definition lives here and nowhere else.
 * See docs/06-analytics.md.
 */
export async function getResponseStats(businessId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db.select({
    createdAt: conversations.createdAt,
    firstResponseAt: conversations.firstResponseAt,
  })
    .from(conversations)
    .where(and(
      eq(conversations.businessId, businessId),
      // Typed operators, not a raw sql template — the template passes a JS
      // Date straight to the driver, which cannot serialize it.
      gte(conversations.createdAt, since),
      ne(conversations.status, 'spam'),
    ));

  if (rows.length === 0) {
    return { eligible: 0, respondedWithin24h: 0, rate: null, medianMinutes: null };
  }

  const latencies: number[] = [];
  let within24h = 0;
  for (const r of rows) {
    if (!r.firstResponseAt) continue;
    const mins = (r.firstResponseAt.getTime() - r.createdAt.getTime()) / 60_000;
    latencies.push(mins);
    if (mins <= 24 * 60) within24h += 1;
  }

  latencies.sort((a, b) => a - b);
  const median = latencies.length
    ? latencies.length % 2
      ? latencies[(latencies.length - 1) / 2]
      : (latencies[latencies.length / 2 - 1] + latencies[latencies.length / 2]) / 2
    : null;

  return {
    eligible: rows.length,
    respondedWithin24h: within24h,
    rate: Math.round((within24h / rows.length) * 100),
    medianMinutes: median === null ? null : Math.round(median),
  };
}

export async function getStatusCounts(businessId: string) {
  const rows = await db.select({ status: conversations.status, n: count() })
    .from(conversations)
    .where(and(eq(conversations.businessId, businessId), isNull(conversations.archivedAt)))
    .groupBy(conversations.status);
  const out: Record<string, number> = { open: 0, won: 0, lost: 0, closed: 0, spam: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}
