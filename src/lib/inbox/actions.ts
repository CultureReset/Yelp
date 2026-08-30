'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { conversations, messages, messageTemplates, auditLog } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guard';
import { authorize, PermissionError } from '@/lib/permissions';

export interface InboxState { error?: string; ok?: boolean }

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, 'Write a message before sending.').max(5000),
  templateId: z.string().uuid().optional(),
});

export async function sendMessageAction(
  _prev: InboxState,
  formData: FormData,
): Promise<InboxState> {
  const ctx = await requireAuth();

  const parsed = sendSchema.safeParse({
    conversationId: formData.get('conversationId'),
    body: formData.get('body'),
    templateId: formData.get('templateId') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [convo] = await db.select().from(conversations)
    .where(eq(conversations.id, parsed.data.conversationId)).limit(1);
  if (!convo) return { error: 'That conversation no longer exists.' };

  try {
    authorize(ctx, 'inbox.write', convo.businessId);
  } catch (e) {
    if (e instanceof PermissionError) return { error: e.message };
    throw e;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(messages).values({
      conversationId: convo.id,
      senderType: 'business',
      senderId: ctx.userId,
      senderName: ctx.firstName,
      body: parsed.data.body,
    });

    await tx.update(conversations).set({
      lastMessageAt: now,
      unreadForBusiness: 0,
      // First response time is set once and never moved — it is what the
      // public response-time badge is computed from.
      firstResponseAt: convo.firstResponseAt ?? now,
    }).where(eq(conversations.id, convo.id));

    if (parsed.data.templateId) {
      await tx.update(messageTemplates)
        .set({ useCount: sql`${messageTemplates.useCount} + 1` })
        .where(eq(messageTemplates.id, parsed.data.templateId));
    }

    await tx.insert(auditLog).values({
      orgId: ctx.orgId,
      businessId: convo.businessId,
      actorId: ctx.userId,
      action: 'message.sent',
      targetType: 'conversation',
      targetId: convo.id,
    });
  });

  revalidatePath('/dashboard/inbox');
  revalidatePath(`/dashboard/inbox/${convo.id}`);
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function markReadAction(conversationId: string) {
  const ctx = await requireAuth();
  const [convo] = await db.select().from(conversations)
    .where(eq(conversations.id, conversationId)).limit(1);
  if (!convo) return;
  authorize(ctx, 'inbox.read', convo.businessId);

  if (convo.unreadForBusiness > 0) {
    await db.update(conversations)
      .set({ unreadForBusiness: 0 })
      .where(eq(conversations.id, conversationId));
    revalidatePath('/dashboard/inbox');
  }
}

const STATUSES = ['open', 'won', 'lost', 'closed', 'spam'] as const;

/** Won/lost feeds lead attribution and cost-per-lead reporting. */
export async function setConversationStatusAction(
  conversationId: string,
  status: string,
): Promise<InboxState> {
  const ctx = await requireAuth();
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return { error: 'Unknown status.' };
  }

  const [convo] = await db.select().from(conversations)
    .where(eq(conversations.id, conversationId)).limit(1);
  if (!convo) return { error: 'That conversation no longer exists.' };

  try {
    authorize(ctx, 'inbox.write', convo.businessId);
  } catch (e) {
    if (e instanceof PermissionError) return { error: e.message };
    throw e;
  }

  await db.transaction(async (tx) => {
    await tx.update(conversations).set({ status })
      .where(eq(conversations.id, conversationId));
    await tx.insert(auditLog).values({
      orgId: ctx.orgId, businessId: convo.businessId, actorId: ctx.userId,
      action: 'conversation.status.changed',
      targetType: 'conversation', targetId: conversationId,
      before: convo.status, after: status,
    });
  });

  revalidatePath('/dashboard/inbox');
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  return { ok: true };
}
