'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { reviews, reviewReplies, reviewReports, replyDrafts, auditLog } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guard';
import { authorize, PermissionError } from '@/lib/permissions';
import { requestMeta } from '@/lib/auth/session';

import { MAX_REPLY_LENGTH, REPORT_REASONS, type ReplyState } from './constants';

const replySchema = z.object({
  reviewId: z.string().uuid(),
  body: z.string().trim().min(1, 'Write a reply before publishing.').max(MAX_REPLY_LENGTH),
});

/** One public reply per review. Editable, but never a delete of the review. */
export async function replyToReviewAction(
  _prev: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const ctx = await requireAuth();

  const parsed = replySchema.safeParse({
    reviewId: formData.get('reviewId'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [review] = await db.select().from(reviews)
    .where(eq(reviews.id, parsed.data.reviewId)).limit(1);
  if (!review) return { error: 'That review no longer exists.' };

  try {
    authorize(ctx, 'review.reply', review.businessId);
  } catch (e) {
    if (e instanceof PermissionError) return { error: e.message };
    throw e;
  }

  const [existing] = await db.select().from(reviewReplies)
    .where(and(
      eq(reviewReplies.reviewId, review.id),
      isNull(reviewReplies.deletedAt),
    )).limit(1);

  const { ip, userAgent } = await requestMeta();

  await db.transaction(async (tx) => {
    if (existing) {
      await tx.update(reviewReplies)
        .set({ body: parsed.data.body, editedAt: new Date() })
        .where(eq(reviewReplies.id, existing.id));
    } else {
      await tx.insert(reviewReplies).values({
        reviewId: review.id,
        businessId: review.businessId,
        authorId: ctx.userId,
        body: parsed.data.body,
        visibility: 'public',
      });
    }

    await tx.delete(replyDrafts).where(and(
      eq(replyDrafts.reviewId, review.id),
      eq(replyDrafts.userId, ctx.userId),
    ));

    await tx.insert(auditLog).values({
      orgId: ctx.orgId,
      businessId: review.businessId,
      actorId: ctx.userId,
      action: existing ? 'review.reply.edited' : 'review.reply.published',
      targetType: 'review',
      targetId: review.id,
      after: parsed.data.body.slice(0, 500),
      ip,
      userAgent,
    });
  });

  revalidatePath('/dashboard/reviews');
  revalidatePath('/dashboard');
  return { ok: true };
}

/** Autosave — owners write long replies and lose them otherwise. */
export async function saveReplyDraftAction(reviewId: string, body: string) {
  const ctx = await requireAuth();
  const [review] = await db.select({ businessId: reviews.businessId })
    .from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!review) return;
  authorize(ctx, 'review.reply', review.businessId);

  if (!body.trim()) {
    await db.delete(replyDrafts).where(and(
      eq(replyDrafts.reviewId, reviewId),
      eq(replyDrafts.userId, ctx.userId),
    ));
    return;
  }

  const [existing] = await db.select({ id: replyDrafts.id }).from(replyDrafts)
    .where(and(eq(replyDrafts.reviewId, reviewId), eq(replyDrafts.userId, ctx.userId)))
    .limit(1);

  if (existing) {
    await db.update(replyDrafts)
      .set({ body, updatedAt: new Date() })
      .where(eq(replyDrafts.id, existing.id));
  } else {
    await db.insert(replyDrafts).values({ reviewId, userId: ctx.userId, body });
  }
}

const reportSchema = z.object({
  reviewId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS.map((r) => r.value) as [string, ...string[]]),
  detail: z.string().trim().max(2000).optional(),
});

export async function reportReviewAction(
  _prev: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const ctx = await requireAuth();

  const parsed = reportSchema.safeParse({
    reviewId: formData.get('reviewId'),
    reason: formData.get('reason'),
    detail: formData.get('detail') || undefined,
  });
  if (!parsed.success) return { error: 'Choose a reason for the report.' };

  const [review] = await db.select().from(reviews)
    .where(eq(reviews.id, parsed.data.reviewId)).limit(1);
  if (!review) return { error: 'That review no longer exists.' };

  try {
    authorize(ctx, 'review.report', review.businessId);
  } catch (e) {
    if (e instanceof PermissionError) return { error: e.message };
    throw e;
  }

  const [dupe] = await db.select({ id: reviewReports.id }).from(reviewReports)
    .where(and(
      eq(reviewReports.reviewId, review.id),
      eq(reviewReports.status, 'open'),
    )).limit(1);
  if (dupe) return { error: 'You already have an open report on this review.' };

  await db.insert(reviewReports).values({
    reviewId: review.id,
    businessId: review.businessId,
    reportedBy: ctx.userId,
    reason: parsed.data.reason,
    detail: parsed.data.detail ?? null,
  });

  revalidatePath('/dashboard/reviews');
  return { ok: true };
}
