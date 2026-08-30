import { requireAuth } from '@/lib/auth/guard';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { NAV } from '@/lib/nav';
import { listBusinesses, getActiveBusiness, getAttentionCounts } from '@/lib/business/context';
import { Topbar } from '@/components/shell/topbar';
import { Sidebar } from '@/components/shell/sidebar';
import { getAuthContext } from '@/lib/auth/session';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();

  const [session] = await db
    .select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);

  const all = await listBusinesses(ctx);
  const active = await getActiveBusiness(ctx, session?.activeBusinessId);

  const counts = active
    ? await getAttentionCounts(active.id)
    : { unrepliedReviews: 0, unreadLeads: 0, pendingEdits: 0, notifications: 0 };

  // The nav only shows what this role can actually reach.
  const navItems = NAV.filter((item) => can(ctx, item.permission, active?.id));

  return (
    <div className="min-h-screen">
      <Topbar
        businesses={all}
        activeBusiness={active}
        userName={`${ctx.firstName} ${ctx.lastName}`.trim()}
        orgName={ctx.orgName}
        roleLabel={ROLE_LABELS[ctx.role]}
        navItems={navItems}
        counts={counts}
        publicHref={active ? `/biz/${active.slug}` : null}
        notificationCount={counts.notifications}
      />

      <div className="lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="hidden border-r border-ink-200 bg-white lg:block">
          <div className="sticky top-14">
            <Sidebar items={navItems} counts={counts} />
          </div>
        </aside>
        <main className="min-w-0 px-4 pb-24 pt-5 sm:px-6 sm:pb-6 sm:pt-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
