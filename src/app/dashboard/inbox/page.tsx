import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { requirePermission } from '@/lib/auth/guard';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getActiveBusiness } from '@/lib/business/context';
import {
  listConversations, getResponseStats, getStatusCounts, type InboxFilters,
} from '@/lib/inbox/queries';
import { Card, EmptyState, Badge } from '@/components/ui';

export const metadata: Metadata = { title: 'Inbox' };

type SP = Promise<Record<string, string | undefined>>;

function ago(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const KIND_LABEL: Record<string, string> = {
  quote_request: 'Quote request',
  message: 'Message',
  appointment: 'Appointment',
};

export default async function InboxPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requirePermission('inbox.read');
  const sp = await searchParams;

  const [session] = await db.select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);
  const active = await getActiveBusiness(ctx, session?.activeBusinessId);
  if (!active) {
    return <Card><EmptyState title="No business selected" description="Claim a business first." /></Card>;
  }

  const filters: InboxFilters = {
    unread: sp.filter === 'unread' || undefined,
    unanswered: sp.filter === 'unanswered' || undefined,
    status: (['open', 'won', 'lost', 'closed', 'spam'] as const).find((v) => v === sp.status),
  };

  const [convos, stats, counts] = await Promise.all([
    listConversations(active.id, filters),
    getResponseStats(active.id),
    getStatusCounts(active.id),
  ]);

  const pills: Array<{ label: string; href: string; on: boolean }> = [
    { label: 'All', href: '/dashboard/inbox', on: !sp.filter && !sp.status },
    { label: 'Unread', href: '/dashboard/inbox?filter=unread', on: sp.filter === 'unread' },
    { label: 'Unanswered', href: '/dashboard/inbox?filter=unanswered', on: sp.filter === 'unanswered' },
    { label: `Open (${counts.open})`, href: '/dashboard/inbox?status=open', on: sp.status === 'open' },
    { label: `Won (${counts.won})`, href: '/dashboard/inbox?status=won', on: sp.status === 'won' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Inbox</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-500">
          Quote requests and messages from customers.
        </p>
      </header>

      {/* Response stats are a public surface, so they carry their definition inline. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[12.5px] text-ink-500">Response rate</p>
          <p className="tnum mt-1 text-2xl font-bold text-ink-900">
            {stats.rate === null ? 'No data' : `${stats.rate}%`}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Replied within 24 hours, trailing 30 days
          </p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-ink-500">Median response time</p>
          <p className="tnum mt-1 text-2xl font-bold text-ink-900">
            {stats.medianMinutes === null ? 'No data'
              : stats.medianMinutes < 60 ? `${stats.medianMinutes}m`
              : `${Math.round(stats.medianMinutes / 60)}h`}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-500">Median, not average</p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-ink-500">Shown publicly</p>
          <p className="mt-1.5 text-[13px] text-ink-700">
            Both numbers appear on your business page. Replying faster is the
            biggest lever you control here.
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => (
          <Link
            key={pill.label}
            href={pill.href}
            aria-current={pill.on ? 'true' : undefined}
            className={clsx(
              'rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors',
              pill.on
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900',
            )}
          >
            {pill.label}
          </Link>
        ))}
      </div>

      {convos.length === 0 ? (
        <Card>
          <EmptyState
            title="No conversations here"
            description="When a customer messages you or sends a quote request, it lands in this inbox."
          />
        </Card>
      ) : (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-200 bg-white">
          {convos.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/inbox/${c.id}`}
                className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-ink-50"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-200 text-[13px] font-semibold text-ink-700"
                >
                  {c.consumerName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={clsx(
                      'text-[14px] text-ink-900',
                      c.unreadForBusiness > 0 ? 'font-bold' : 'font-medium',
                    )}>
                      {c.consumerName}
                    </span>
                    <Badge tone={c.kind === 'quote_request' ? 'brand' : 'neutral'}>
                      {KIND_LABEL[c.kind] ?? c.kind}
                    </Badge>
                    {c.status === 'won' && <Badge tone="good">Won</Badge>}
                    {c.status === 'lost' && <Badge tone="neutral">Lost</Badge>}
                    {!c.firstResponseAt && <Badge tone="bad">No reply yet</Badge>}
                    {c.fanoutSize && c.fanoutSize > 1 ? (
                      <span className="text-[12px] text-ink-500">
                        also sent to {c.fanoutSize - 1} other{c.fanoutSize === 2 ? '' : 's'}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-500">
                    {c.consumerCity}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[12px] text-ink-500">{ago(c.lastMessageAt)}</span>
                  {c.unreadForBusiness > 0 && (
                    <span className="tnum mt-1 inline-block rounded-full bg-brand-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      {c.unreadForBusiness}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
