'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { businesses, businessEdits, auditLog } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guard';
import { authorize, PermissionError, requiresInternalApproval } from '@/lib/permissions';
import { requestMeta } from '@/lib/auth/session';
import { classifyFields, routeEdit } from './routing';
import { applyApprovedEdit } from './publish';

export interface EditState {
  error?: string;
  ok?: boolean;
  status?: 'auto_approved' | 'pending';
  message?: string;
}

const CARD_FIELDS: Record<string, string[]> = {
  basics: ['name', 'description', 'specialties', 'history', 'priceTier', 'yearEstablished'],
  contact: ['phone', 'website', 'publicEmail', 'menuUrl', 'orderUrl', 'reservationUrl'],
  location: ['address1', 'address2', 'city', 'state', 'postalCode'],
  owner: ['ownerName', 'ownerBio'],
  access: ['parkingNotes', 'transitNotes', 'accessibilityNotes'],
};

/**
 * Submits a proposal. Never writes to `businesses` directly — the routing
 * decision determines whether the publish worker applies it now or a
 * moderator sees it first.
 */
export async function submitBusinessEditAction(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const ctx = await requireAuth();

  const businessId = String(formData.get('businessId') ?? '');
  const card = String(formData.get('card') ?? '');
  const fields = CARD_FIELDS[card];
  if (!businessId || !fields) return { error: 'Something went wrong. Reload and try again.' };

  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz || biz.orgId !== ctx.orgId) return { error: 'That business is not available to you.' };

  // Build the patch from only the fields that actually changed.
  const patch: Record<string, unknown> = {};
  for (const f of fields) {
    if (!formData.has(f)) continue;
    const raw = formData.get(f);
    const next = raw === null || raw === '' ? null
      : f === 'priceTier' || f === 'yearEstablished' ? Number(raw)
      : String(raw).trim();
    const current = (biz as Record<string, unknown>)[f] ?? null;
    const normalizedCurrent = typeof current === 'number' ? current : current ?? null;
    if (next !== normalizedCurrent) patch[f] = next;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, message: 'Nothing to save — no changes were made.' };
  }

  const fieldClass = classifyFields(Object.keys(patch));
  const permission = fieldClass === 'identity' ? 'business.edit_identity' : 'business.edit';

  try {
    authorize(ctx, permission, businessId);
  } catch (e) {
    if (e instanceof PermissionError) {
      return {
        error: e.kind === 'step_up_required'
          ? 'For your security, confirm your password before changing this.'
          : e.message,
      };
    }
    throw e;
  }

  const daysSinceClaim = biz.claimedAt
    ? Math.floor((Date.now() - biz.claimedAt.getTime()) / 86_400_000)
    : null;

  let decision = routeEdit({
    fieldClass,
    source: 'owner',
    ownerVerified: biz.claimStatus === 'claimed',
    daysSinceClaim,
    patch,
  });

  // A Location Manager may propose an identity change, but an Admin or Owner
  // has to sign off before it reaches the moderation queue.
  if (requiresInternalApproval(ctx.role, permission)) {
    decision = {
      status: 'pending',
      reason: 'Sent to an account admin for approval before it goes to review.',
      riskScore: decision.riskScore,
    };
  }

  const { ip, userAgent } = await requestMeta();

  const [edit] = await db.insert(businessEdits).values({
    businessId,
    submittedBy: ctx.userId,
    source: 'owner',
    patch,
    fieldClass,
    status: decision.status,
    riskScore: String(decision.riskScore),
    routedReason: decision.reason,
  }).returning();

  await db.insert(auditLog).values({
    orgId: ctx.orgId,
    businessId,
    actorId: ctx.userId,
    action: 'business.edit.submitted',
    targetType: 'business_edit',
    targetId: edit.id,
    after: JSON.stringify(patch),
    ip,
    userAgent,
  });

  if (decision.status === 'auto_approved') {
    await applyApprovedEdit(edit.id);
  }

  revalidatePath('/dashboard/business');
  revalidatePath('/dashboard');

  return {
    ok: true,
    status: decision.status,
    message: decision.status === 'auto_approved'
      ? 'Saved and live on your public page.'
      : decision.reason,
  };
}

export async function cancelPendingEditAction(editId: string) {
  const ctx = await requireAuth();
  const [edit] = await db.select().from(businessEdits)
    .where(and(eq(businessEdits.id, editId), eq(businessEdits.status, 'pending')))
    .limit(1);
  if (!edit) return;

  const [biz] = await db.select({ orgId: businesses.orgId }).from(businesses)
    .where(eq(businesses.id, edit.businessId)).limit(1);
  if (biz?.orgId !== ctx.orgId) return;

  authorize(ctx, 'business.edit', edit.businessId);
  await db.update(businessEdits)
    .set({ status: 'cancelled', reviewedAt: new Date() })
    .where(eq(businessEdits.id, editId));

  revalidatePath('/dashboard/business');
}
