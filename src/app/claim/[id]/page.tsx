import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guard';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getClaimContext } from '@/lib/claim/queries';
import {
  METHODS, methodAvailable, targetPhone, targetEmailDomain, targetAddress,
  STATE_LABELS, MAX_SENDS_PER_DAY,
} from '@/lib/claim/methods';
import { ClaimFlow } from './flow';
import { Card, Badge, Stars, Alert, LinkButton } from '@/components/ui';

export const metadata: Metadata = { title: 'Claim this business' };

export default async function ClaimPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ claimed?: string; dispute?: string }>;
}) {
  const ctx = await requireAuth();
  const { id } = await params;
  const { claimed, dispute } = await searchParams;

  const data = await getClaimContext(id, ctx.userId);
  if (!data) notFound();
  const { biz, claim } = data;

  const [me] = await db.select({ email: users.emailRaw }).from(users)
    .where(eq(users.id, ctx.userId)).limit(1);

  // Success state — the claim already went through.
  if (claimed || (claim?.state === 'claimed' && biz.orgId === ctx.orgId)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <Card>
          <div className="text-center">
            <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-good-50 text-2xl text-good-700">✓</span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-ink-900">
              {biz.name} is yours
            </h1>
            <p className="mt-2 text-[14.5px] text-ink-600">
              You can now edit your details, reply to reviews, and answer messages.
            </p>
            <div className="mt-5">
              <LinkButton href="/dashboard">Go to your dashboard</LinkButton>
            </div>
          </div>
          <div className="mt-6 border-t border-ink-100 pt-4">
            <p className="text-[13px] text-ink-500">
              For the next 30 days, changes to your name, address, phone, and
              website are reviewed by a person before they publish. That is a
              deliberate speed bump against account takeover, and it lifts
              automatically.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const alreadyClaimedByOther = biz.claimStatus === 'claimed' && biz.orgId !== ctx.orgId;

  const methods = METHODS.map((m) => {
    const availability = methodAvailable(m.key, biz, me.email);
    const target =
      m.needs === 'phone' && biz.phone ? targetPhone(biz.phone)
      : m.needs === 'domain' && biz.websiteDomain ? targetEmailDomain(biz.websiteDomain)
      : m.needs === 'address' && biz.address1 ? targetAddress(biz.address1, biz.city)
      : null;
    return {
      key: m.key, label: m.label, blurb: m.blurb, strength: m.strength,
      available: availability.available, reason: availability.reason ?? null, target,
    };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/claim" className="text-[13px] font-medium text-brand-700 hover:underline">
        &larr; Search again
      </Link>

      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-ink-900">{biz.name}</h1>
            <p className="mt-1 text-[13.5px] text-ink-500">
              {[biz.address1, biz.city, biz.state, biz.postalCode].filter(Boolean).join(', ')}
            </p>
            {biz.phone && <p className="text-[13.5px] text-ink-500">{biz.phone}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {biz.ratingAvg ? <Stars rating={Number(biz.ratingAvg)} /> : null}
              <span className="text-[13px] text-ink-500">{biz.reviewCount} reviews</span>
            </div>
          </div>
          {claim && (
            <Badge tone={claim.state === 'manual_review' ? 'warn' : 'neutral'}>
              {STATE_LABELS[claim.state] ?? claim.state}
            </Badge>
          )}
        </div>
      </Card>

      {alreadyClaimedByOther ? (
        <div className="mt-4 space-y-4">
          <Alert tone="warn" title="Someone has already claimed this business">
            If this business is yours, tell us and a reviewer will look at the
            evidence from both sides. The current owner keeps access until a
            decision is made.
          </Alert>
          <ClaimFlow
            businessId={biz.id}
            mode="dispute"
            methods={methods}
            state={claim?.state ?? null}
            sendsLeft={0}
            defaultOpen={dispute === '1'}
          />
        </div>
      ) : (
        <div className="mt-4">
          <ClaimFlow
            businessId={biz.id}
            mode="claim"
            methods={methods}
            state={claim?.state ?? null}
            sendsLeft={Math.max(0, MAX_SENDS_PER_DAY - (claim?.sendCount ?? 0))}
            attemptsUsed={claim?.attempts ?? 0}
            defaultOpen={false}
          />
        </div>
      )}
    </div>
  );
}
