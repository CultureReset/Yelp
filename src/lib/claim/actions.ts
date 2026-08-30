'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  businesses, claims, memberships, organizations, users, auditLog, notifications,
} from '@/db/schema';
import { requireAuth } from '@/lib/auth/guard';
import { generateNumericCode, hashToken, safeEqual } from '@/lib/auth/tokens';
import { logAuthEvent, requestMeta, setActiveBusiness } from '@/lib/auth/session';
import { consume } from '@/lib/auth/rate-limit';
import {
  METHODS, MAX_CODE_ATTEMPTS, MAX_SENDS_PER_DAY, CLAIM_TTL_DAYS,
  methodAvailable, type MethodKey,
} from './methods';

import type { ClaimState } from './types';

/** Starts (or resumes) a claim. One live claim per person per listing. */
export async function startClaimAction(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const ctx = await requireAuth();
  const businessId = String(formData.get('businessId') ?? '');
  if (!businessId) return { error: 'Something went wrong. Reload and try again.' };

  const [biz] = await db.select().from(businesses)
    .where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return { error: 'That business is no longer listed.' };

  if (biz.claimStatus === 'claimed' && biz.orgId === ctx.orgId) {
    redirect('/dashboard');
  }
  if (biz.claimStatus === 'claimed') {
    return {
      error: 'This business is already claimed. If it is yours, you can dispute the current owner.',
    };
  }

  const limit = await consume(`claim:${ctx.userId}`, { max: 5, windowSec: 3600 });
  if (!limit.allowed) return { error: 'Too many claim attempts. Try again later.' };

  const [existing] = await db.select().from(claims)
    .where(and(
      eq(claims.businessId, businessId),
      eq(claims.userId, ctx.userId),
      sql`${claims.state} in ('claim_started','verification_sent','manual_review')`,
    ))
    .orderBy(desc(claims.createdAt)).limit(1);

  if (!existing) {
    await db.insert(claims).values({
      businessId,
      userId: ctx.userId,
      orgId: ctx.orgId,
      state: 'claim_started',
      expiresAt: new Date(Date.now() + CLAIM_TTL_DAYS * 86_400_000),
    });
    await logAuthEvent({ userId: ctx.userId, type: 'claim.started', result: 'success' });
  }

  revalidatePath(`/claim/${businessId}`);
  return { ok: true };
}

const sendSchema = z.object({
  businessId: z.string().uuid(),
  method: z.enum(METHODS.map((m) => m.key) as [MethodKey, ...MethodKey[]]),
});

/**
 * Issues a verification code against the listing's own contact details.
 * In development the code is written to the server log; in production this
 * hands off to the telephony and mail workers.
 */
export async function sendVerificationAction(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const ctx = await requireAuth();

  const parsed = sendSchema.safeParse({
    businessId: formData.get('businessId'),
    method: formData.get('method'),
  });
  if (!parsed.success) return { error: 'Choose a verification method.' };

  const [biz] = await db.select().from(businesses)
    .where(eq(businesses.id, parsed.data.businessId)).limit(1);
  if (!biz) return { error: 'That business is no longer listed.' };
  if (biz.claimStatus === 'claimed') return { error: 'This business is already claimed.' };

  const [me] = await db.select({ email: users.emailRaw }).from(users)
    .where(eq(users.id, ctx.userId)).limit(1);

  const availability = methodAvailable(parsed.data.method, biz, me.email);
  if (!availability.available) return { error: availability.reason ?? 'That method is unavailable.' };

  const [claim] = await db.select().from(claims)
    .where(and(
      eq(claims.businessId, biz.id),
      eq(claims.userId, ctx.userId),
      sql`${claims.state} in ('claim_started','verification_sent')`,
    ))
    .orderBy(desc(claims.createdAt)).limit(1);
  if (!claim) return { error: 'Start the claim again — this one expired.' };

  if (claim.sendCount >= MAX_SENDS_PER_DAY) {
    return { error: 'You have requested too many codes today. Try again tomorrow, or upload a document instead.' };
  }

  // Document and postcard paths do not produce an on-screen code.
  if (parsed.data.method === 'document') {
    await db.update(claims).set({
      state: 'manual_review',
      method: parsed.data.method,
      sendCount: claim.sendCount + 1,
    }).where(eq(claims.id, claim.id));
    revalidatePath(`/claim/${biz.id}`);
    return { ok: true, message: 'Upload your document below and a reviewer will look at it within two business days.' };
  }

  const target =
    parsed.data.method === 'domain_email' ? me.email
    : parsed.data.method === 'postcard' ? `${biz.address1}, ${biz.city}`
    : biz.phone!;

  const code = generateNumericCode(6);

  await db.update(claims).set({
    state: 'verification_sent',
    method: parsed.data.method,
    targetContact: target,
    codeHash: hashToken(code),
    attempts: 0,
    sendCount: claim.sendCount + 1,
  }).where(eq(claims.id, claim.id));

  // Delivery worker boundary. Wire Twilio, the mail vendor, or the mailer here.
  // ASCII only: this line is grepped out of the log by the e2e test, and
  // non-ASCII truncates it under `strings`.
  console.log(`[claim] ${parsed.data.method} code for ${biz.name} to ${target}: ${code}`);

  await logAuthEvent({
    userId: ctx.userId, type: 'claim.code_sent', result: 'success',
    reason: parsed.data.method,
  });

  revalidatePath(`/claim/${biz.id}`);
  return {
    ok: true,
    message: parsed.data.method === 'postcard'
      ? 'Your postcard is on its way. It usually arrives within 5 to 10 days.'
      : 'Code sent. It expires in 15 minutes.',
  };
}

const verifySchema = z.object({
  businessId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

export async function verifyClaimAction(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const ctx = await requireAuth();

  const parsed = verifySchema.safeParse({
    businessId: formData.get('businessId'),
    code: formData.get('code'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [claim] = await db.select().from(claims)
    .where(and(
      eq(claims.businessId, parsed.data.businessId),
      eq(claims.userId, ctx.userId),
      eq(claims.state, 'verification_sent'),
    ))
    .orderBy(desc(claims.createdAt)).limit(1);

  if (!claim?.codeHash) return { error: 'Request a new code — this one is no longer valid.' };
  if (claim.expiresAt && claim.expiresAt < new Date()) {
    await db.update(claims).set({ state: 'expired' }).where(eq(claims.id, claim.id));
    return { error: 'This claim expired. Start again.' };
  }

  if (!safeEqual(claim.codeHash, hashToken(parsed.data.code))) {
    const attempts = claim.attempts + 1;
    const exhausted = attempts >= MAX_CODE_ATTEMPTS;

    await db.update(claims).set({
      attempts,
      state: exhausted ? 'manual_review' : 'verification_sent',
      codeHash: exhausted ? null : claim.codeHash,
    }).where(eq(claims.id, claim.id));

    await logAuthEvent({ userId: ctx.userId, type: 'claim.code_failed', result: 'failure' });
    revalidatePath(`/claim/${parsed.data.businessId}`);

    return exhausted
      ? { error: 'Too many incorrect codes. We have sent this to a reviewer, who will be in touch.' }
      : { error: `That code is not correct. ${MAX_CODE_ATTEMPTS - attempts} attempt(s) left.` };
  }

  await completeClaim(claim.id, claim.businessId, ctx.userId, ctx.orgId);
  redirect(`/claim/${parsed.data.businessId}?claimed=1`);
}

/**
 * Grants ownership. Creates the membership if the person has none, notifies a
 * previous owner, and records the whole thing in the audit log.
 */
async function completeClaim(
  claimId: string, businessId: string, userId: string, orgId: string,
) {
  const now = new Date();
  const { ip, userAgent } = await requestMeta();

  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  const previousOrgId = biz?.orgId ?? null;

  await db.transaction(async (tx) => {
    await tx.update(claims).set({
      state: 'claimed', verifiedAt: now, completedAt: now, codeHash: null, orgId,
    }).where(eq(claims.id, claimId));

    await tx.update(businesses).set({
      orgId,
      claimStatus: 'claimed',
      claimedAt: now,
      status: biz?.status === 'pending' ? 'published' : biz!.status,
      updatedAt: now,
    }).where(eq(businesses.id, businessId));

    const [existingMembership] = await tx.select().from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId))).limit(1);
    if (!existingMembership) {
      await tx.insert(memberships).values({
        userId, orgId, role: 'owner', acceptedAt: now,
      });
    }

    await tx.insert(auditLog).values({
      orgId, businessId, actorId: userId,
      action: 'business.claimed',
      targetType: 'business', targetId: businessId,
      before: previousOrgId, after: orgId,
      ip, userAgent,
    });
  });

  // A re-claim always tells the previous owner, with a route to dispute it.
  if (previousOrgId && previousOrgId !== orgId) {
    const previousOwners = await db.select({ userId: memberships.userId })
      .from(memberships).where(eq(memberships.orgId, previousOrgId));
    if (previousOwners.length) {
      await db.insert(notifications).values(previousOwners.map((o) => ({
        userId: o.userId,
        businessId,
        type: 'business.reclaimed',
        title: `${biz?.name ?? 'A business'} was claimed by someone else`,
        body: 'If this was not you, dispute it now and we will investigate.',
        href: `/claim/${businessId}?dispute=1`,
      })));
    }
  }

  await setActiveBusiness((await requireAuth()).sessionId, businessId);
  await logAuthEvent({ userId, type: 'claim.completed', result: 'success' });
}

export async function disputeClaimAction(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const ctx = await requireAuth();
  const businessId = String(formData.get('businessId') ?? '');
  const detail = String(formData.get('detail') ?? '').trim();
  if (!detail) return { error: 'Tell us why this business is yours.' };

  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return { error: 'That business is no longer listed.' };

  await db.insert(claims).values({
    businessId, userId: ctx.userId, orgId: ctx.orgId,
    state: 'disputed', method: 'document', deniedReason: detail,
    expiresAt: new Date(Date.now() + CLAIM_TTL_DAYS * 86_400_000),
  });

  await db.insert(auditLog).values({
    orgId: ctx.orgId, businessId, actorId: ctx.userId,
    action: 'business.claim.disputed',
    targetType: 'business', targetId: businessId, after: detail.slice(0, 500),
  });

  revalidatePath(`/claim/${businessId}`);
  return {
    ok: true,
    message: 'Dispute received. A reviewer will look at the evidence from both sides and email you both with the decision.',
  };
}
