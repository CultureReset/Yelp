import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { requirePermission } from '@/lib/auth/guard';
import { db } from '@/db/client';
import { sessions, media } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { getActiveBusiness } from '@/lib/business/context';
import { Card, EmptyState, Badge, Button } from '@/components/ui';

export const metadata: Metadata = { title: 'Photos & videos' };

type SP = Promise<{ source?: string }>;

const TAG_LABEL: Record<string, string> = {
  food: 'Food', drink: 'Drink', menu: 'Menu', interior: 'Interior',
  exterior: 'Exterior', team: 'Team', work: 'Work samples',
};

/**
 * Placeholder tile. Real uploads render from the CDN; the seed has no binary
 * assets, so we draw a deterministic swatch from the storage key instead of
 * shipping stock images that would misrepresent the business.
 */
function Tile({ seed, label }: { seed: string; label: string }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return (
    <div
      aria-hidden="true"
      className="flex aspect-[4/3] items-center justify-center rounded-t-md text-[11px] font-medium uppercase tracking-wider text-white/85"
      style={{ background: `linear-gradient(140deg, hsl(${h} 45% 42%), hsl(${(h + 40) % 360} 40% 30%))` }}
    >
      {label}
    </div>
  );
}

export default async function PhotosPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requirePermission('media.write');
  const { source } = await searchParams;

  const [session] = await db.select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);
  const active = await getActiveBusiness(ctx, session?.activeBusinessId);
  if (!active) {
    return <Card><EmptyState title="No business selected" description="Claim a business first." /></Card>;
  }

  const which = source === 'consumer' ? 'consumer' : 'owner';
  const [items, all] = await Promise.all([
    db.select().from(media)
      .where(and(
        eq(media.businessId, active.id),
        eq(media.source, which),
        isNull(media.deletedAt),
      ))
      .orderBy(media.sortOrder, desc(media.createdAt)),
    db.select({ source: media.source }).from(media)
      .where(and(eq(media.businessId, active.id), isNull(media.deletedAt))),
  ]);

  const ownerCount = all.filter((m) => m.source === 'owner').length;
  const consumerCount = all.filter((m) => m.source === 'consumer').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">Photos &amp; videos</h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-500">
            Your photos and customer photos are governed differently, so they
            stay in separate tabs. Location data is stripped from every upload.
          </p>
        </div>
        <Button size="sm" disabled title="Upload pipeline lands with media storage">
          Upload photos
        </Button>
      </header>

      {/* Owner and customer media must never be visually merged. */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/photos"
          aria-current={which === 'owner' ? 'true' : undefined}
          className={clsx(
            'rounded-full border px-3 py-1 text-[12.5px] font-medium',
            which === 'owner'
              ? 'border-brand-700 bg-brand-700 text-white'
              : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
          )}
        >
          Your photos ({ownerCount})
        </Link>
        <Link
          href="/dashboard/photos?source=consumer"
          aria-current={which === 'consumer' ? 'true' : undefined}
          className={clsx(
            'rounded-full border px-3 py-1 text-[12.5px] font-medium',
            which === 'consumer'
              ? 'border-brand-700 bg-brand-700 text-white'
              : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
          )}
        >
          Customer photos ({consumerCount})
        </Link>
      </div>

      {which === 'consumer' && (
        <div className="rounded-md border-l-2 border-brand-600 bg-brand-50/50 px-4 py-3 text-[13px] text-ink-700">
          Customers own the photos they upload. You can report one that breaks
          our content guidelines, but you cannot delete or reorder them.
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title={which === 'owner' ? 'No photos yet' : 'No customer photos yet'}
            description={which === 'owner'
              ? 'Businesses with at least five photos get noticeably more page views. Start with your food, your space, and your team.'
              : 'Photos your customers upload will appear here.'}
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-md border border-ink-200 bg-white">
              <Tile seed={m.storageKey} label={TAG_LABEL[m.tags?.[0] ?? ''] ?? 'Photo'} />
              <div className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {m.isCover && <Badge tone="brand">Cover photo</Badge>}
                  {m.moderationStatus === 'pending' && <Badge tone="warn">In review</Badge>}
                  {m.moderationStatus === 'rejected' && <Badge tone="bad">Rejected</Badge>}
                  {m.tags?.map((t) => (
                    <Badge key={t} tone="neutral">{TAG_LABEL[t] ?? t}</Badge>
                  ))}
                </div>

                {m.caption ? (
                  <p className="text-[13px] text-ink-800">{m.caption}</p>
                ) : (
                  <p className="text-[13px] text-ink-400">No caption</p>
                )}

                {m.moderationReason && (
                  <p className="rounded bg-bad-50 px-2 py-1.5 text-[12px] text-bad-700">
                    {m.moderationReason}
                  </p>
                )}

                <div className="flex items-center justify-between border-t border-ink-100 pt-2 text-[12px] text-ink-500">
                  <span>
                    {which === 'consumer' ? m.uploaderName : `${m.viewCount.toLocaleString()} views`}
                  </span>
                  <span className="tnum">{m.width}&times;{m.height}</span>
                </div>

                <div className="flex gap-1.5">
                  {which === 'owner' ? (
                    <>
                      <Button size="sm" variant="secondary" disabled>Edit</Button>
                      <Button size="sm" variant="ghost" disabled>Delete</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" disabled>Report</Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
