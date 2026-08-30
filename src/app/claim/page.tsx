import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { searchUnclaimed } from '@/lib/claim/queries';
import { Card, EmptyState, Badge, Stars, Input, Button } from '@/components/ui';

export const metadata: Metadata = { title: 'Claim your business' };

export default async function ClaimSearchPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  await requireAuth();
  const { q } = await searchParams;
  const results = q ? await searchUnclaimed(q) : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Claim your business</h1>
        <p className="mt-1.5 text-[14.5px] text-ink-500">
          Find the listing that already exists. If it isn&apos;t here, you can add it.
        </p>
      </header>

      <form method="GET" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">Business name or city</label>
        <Input
          id="q" name="q" defaultValue={q ?? ''} autoFocus
          placeholder="Business name, street, or city"
        />
        <Button type="submit">Search</Button>
      </form>

      {q && (
        <div className="mt-6">
          {results.length === 0 ? (
            <Card>
              <EmptyState
                title={`Nothing matching “${q}”`}
                description="Check the spelling, try the street name, or add your business as a new listing."
                action={<Button variant="secondary" disabled>Add my business</Button>}
              />
            </Card>
          ) : (
            <>
              <p className="mb-3 text-[13px] text-ink-500">
                {results.length} result{results.length === 1 ? '' : 's'}
              </p>
              <ul className="space-y-2">
                {results.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/claim/${b.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-ink-900">{b.name}</p>
                        <p className="mt-0.5 text-[13px] text-ink-500">
                          {[b.address1, b.city, b.state].filter(Boolean).join(', ')}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {b.ratingAvg ? <Stars rating={Number(b.ratingAvg)} /> : null}
                          <span className="text-[12.5px] text-ink-500">
                            {b.reviewCount} review{b.reviewCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {b.claimStatus === 'claimed'
                          ? <Badge tone="neutral">Already claimed</Badge>
                          : <Badge tone="brand">Unclaimed</Badge>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-ink-200 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-ink-900">Why we verify</h2>
        <p className="mt-1 text-[13.5px] text-ink-600">
          Claiming a business gives you control of its hours, phone number, and
          the ability to reply to customers in its name. That is worth stealing,
          so we verify against the contact details already on the listing —
          never ones you type in.
        </p>
      </div>

      <p className="mt-6 text-center text-[13.5px] text-ink-500">
        <Link href="/dashboard" className="font-medium text-brand-700 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
