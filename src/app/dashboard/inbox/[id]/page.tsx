import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guard';
import { can } from '@/lib/permissions';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getActiveBusiness } from '@/lib/business/context';
import { getConversation, getTemplates } from '@/lib/inbox/queries';
import { Thread } from './thread';
import { Card, Badge } from '@/components/ui';

export const metadata: Metadata = { title: 'Conversation' };

function money(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default async function ConversationPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission('inbox.read');
  const { id } = await params;

  const [session] = await db.select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);
  const active = await getActiveBusiness(ctx, session?.activeBusinessId);
  if (!active) notFound();

  const data = await getConversation(active.id, id);
  if (!data) notFound();

  const templates = await getTemplates(active.id);

  const { convo, messages, quote } = data;

  return (
    <div className="space-y-4">
      <Link href="/dashboard/inbox" className="inline-block text-[13px] font-medium text-brand-700 hover:underline">
        &larr; Back to inbox
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <header className="rounded-lg border border-ink-200 bg-white px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-200 text-[14px] font-semibold text-ink-700"
                >
                  {convo.consumerName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-ink-900">{convo.consumerName}</p>
                  <p className="text-[12.5px] text-ink-500">{convo.consumerCity}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {convo.status === 'won' && <Badge tone="good">Won</Badge>}
                {convo.status === 'lost' && <Badge tone="neutral">Lost</Badge>}
                {convo.status === 'open' && <Badge tone="brand">Open</Badge>}
              </div>
            </div>
          </header>

          <Thread
            conversationId={convo.id}
            status={convo.status}
            canWrite={can(ctx, 'inbox.write', active.id)}
            businessName={active.name}
            customerName={convo.consumerName}
            messages={messages.map((m) => ({
              id: m.id,
              senderType: m.senderType,
              senderName: m.senderName,
              body: m.body,
              isAutomated: m.isAutomated,
              createdAt: m.createdAt.toISOString(),
            }))}
            templates={templates.map((t) => ({ id: t.id, name: t.name, body: t.body }))}
          />
        </div>

        <aside className="space-y-4">
          {quote && (
            <Card title="Quote request">
              <dl className="space-y-2.5">
                {quote.answers.map((a) => (
                  <div key={a.question}>
                    <dt className="text-[12px] uppercase tracking-wide text-ink-500">{a.question}</dt>
                    <dd className="text-[13.5px] text-ink-900">{a.answer}</dd>
                  </div>
                ))}
                {quote.budgetBand && (
                  <div>
                    <dt className="text-[12px] uppercase tracking-wide text-ink-500">Budget</dt>
                    <dd className="text-[13.5px] text-ink-900">{quote.budgetBand}</dd>
                  </div>
                )}
                {quote.desiredDate && (
                  <div>
                    <dt className="text-[12px] uppercase tracking-wide text-ink-500">Date wanted</dt>
                    <dd className="text-[13.5px] text-ink-900">{quote.desiredDate}</dd>
                  </div>
                )}
                {quote.locationText && (
                  <div>
                    <dt className="text-[12px] uppercase tracking-wide text-ink-500">Location</dt>
                    <dd className="text-[13.5px] text-ink-900">{quote.locationText}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          <Card title="This conversation">
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Started</dt>
                <dd className="text-ink-900">{convo.createdAt.toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">First reply</dt>
                <dd className="text-ink-900">
                  {convo.firstResponseAt
                    ? `${Math.round((convo.firstResponseAt.getTime() - convo.createdAt.getTime()) / 60000)} min`
                    : 'Not yet'}
                </dd>
              </div>
              {convo.fanoutSize && convo.fanoutSize > 1 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Also sent to</dt>
                  <dd className="text-ink-900">{convo.fanoutSize - 1} other businesses</dd>
                </div>
              ) : null}
            </dl>
            {convo.fanoutSize && convo.fanoutSize > 1 ? (
              <p className="mt-3 border-t border-ink-100 pt-3 text-[12.5px] text-ink-500">
                This customer contacted several businesses at once. The first
                useful reply usually wins the job.
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
