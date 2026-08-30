import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { db } from '@/db/client';
import { notifications } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Card, EmptyState, Badge } from '@/components/ui';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const ctx = await requireAuth();
  const rows = await db.select().from(notifications)
    .where(eq(notifications.userId, ctx.userId))
    .orderBy(desc(notifications.createdAt)).limit(50);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Notifications</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-500">
          Every notification links into context.{' '}
          <Link href="/dashboard/settings/notifications" className="font-medium text-brand-700 hover:underline">
            Change what you receive
          </Link>
        </p>
      </header>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Nothing yet" description="New reviews, messages, and account activity land here." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((n) => (
              <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                <Link href={n.href ?? '#'} className="group flex items-start gap-3">
                  {!n.readAt && (
                    <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                  )}
                  <span className={n.readAt ? 'ml-5' : ''}>
                    <span className="block text-[13.5px] font-medium text-ink-900 group-hover:text-brand-700">
                      {n.title}
                    </span>
                    {n.body && <span className="mt-0.5 block line-clamp-2 text-[13px] text-ink-500">{n.body}</span>}
                    <span className="mt-1 block text-[12px] text-ink-400">
                      {n.createdAt.toLocaleDateString()}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
