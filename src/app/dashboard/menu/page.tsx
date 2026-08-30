import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { db } from '@/db/client';
import { sessions, menuSections, menuItems, services } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getActiveBusiness } from '@/lib/business/context';
import { Card, EmptyState, Badge, Button } from '@/components/ui';

export const metadata: Metadata = { title: 'Menu & services' };

function money(cents: number | null) {
  if (cents === null) return null;
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  });
}

function priceRange(low: number | null, high: number | null, unit: string | null) {
  if (low === null && high === null) return 'Quote only';
  const suffix = unit === 'hourly' ? ' / hour' : unit === 'per_sqft' ? ' / sq ft' : '';
  if (low !== null && high !== null && low !== high) return `${money(low)} – ${money(high)}${suffix}`;
  return `${money(low ?? high)}${suffix}`;
}

const DIETARY_LABEL: Record<string, string> = {
  vegan: 'Vegan', vegetarian: 'Vegetarian', gluten_free: 'Gluten-free',
  halal: 'Halal', kosher: 'Kosher',
};

export default async function MenuPage() {
  const ctx = await requirePermission('menu.write');

  const [session] = await db.select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);
  const active = await getActiveBusiness(ctx, session?.activeBusinessId);
  if (!active) {
    return <Card><EmptyState title="No business selected" description="Claim a business first." /></Card>;
  }

  const [sections, items, svcs] = await Promise.all([
    db.select().from(menuSections)
      .where(eq(menuSections.businessId, active.id))
      .orderBy(menuSections.sortOrder),
    db.select().from(menuItems)
      .where(eq(menuItems.businessId, active.id))
      .orderBy(menuItems.sortOrder),
    db.select().from(services)
      .where(and(eq(services.businessId, active.id), eq(services.isActive, true)))
      .orderBy(services.sortOrder),
  ]);

  const bySection = new Map<string, typeof items>();
  for (const it of items) {
    const list = bySection.get(it.sectionId) ?? [];
    list.push(it);
    bySection.set(it.sectionId, list);
  }

  const hasPartnerFeed = sections.some((s) => s.source === 'partner');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">Menu &amp; services</h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-500">
            What you sell. Services feed quote matching; menu items show on your
            public page.
          </p>
        </div>
        <Button size="sm" disabled title="Item editor lands next">Add item</Button>
      </header>

      {hasPartnerFeed && (
        <div className="rounded-md border-l-2 border-warn-500 bg-warn-50 px-4 py-3 text-[13px] text-ink-700">
          <p className="font-semibold text-ink-900">Some sections come from your POS</p>
          <p className="mt-0.5">
            Sections marked &ldquo;From POS&rdquo; are managed by your point-of-sale
            integration and are read-only here. Editing them in the dashboard
            would be overwritten at the next sync, so we block it rather than
            let your change disappear overnight.
          </p>
        </div>
      )}

      <Card
        title="Services"
        description="Used to match you to quote requests. Price bands are shown to customers as ranges."
        action={<Button size="sm" variant="secondary" disabled>Add service</Button>}
      >
        {svcs.length === 0 ? (
          <EmptyState
            title="No services listed"
            description="Businesses that list services receive noticeably more quote requests."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {svcs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink-900">{s.name}</p>
                  {s.description && (
                    <p className="mt-0.5 text-[13px] text-ink-500">{s.description}</p>
                  )}
                  {s.durationMin && (
                    <p className="mt-0.5 text-[12.5px] text-ink-400">
                      About {s.durationMin >= 60 ? `${s.durationMin / 60} hours` : `${s.durationMin} min`}
                    </p>
                  )}
                </div>
                <p className="tnum shrink-0 text-[13.5px] font-medium text-ink-900">
                  {priceRange(s.priceLowCents, s.priceHighCents, s.priceUnit)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {sections.map((section) => {
        const secItems = bySection.get(section.id) ?? [];
        return (
          <Card
            key={section.id}
            title={section.name}
            description={section.description ?? undefined}
            action={
              section.source === 'partner'
                ? <Badge tone="warn">From POS &middot; read-only</Badge>
                : <Button size="sm" variant="secondary" disabled>Add item</Button>
            }
          >
            {secItems.length === 0 ? (
              <EmptyState title="No items in this section" description="Add your first item to this section." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {secItems.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-medium text-ink-900">{item.name}</p>
                        {item.isPopular && <Badge tone="brand">Popular</Badge>}
                        {item.dietaryTags?.map((t) => (
                          <Badge key={t} tone="good">{DIETARY_LABEL[t] ?? t}</Badge>
                        ))}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 text-[13px] text-ink-500">{item.description}</p>
                      )}
                    </div>
                    <p className="tnum shrink-0 text-[13.5px] font-medium text-ink-900">
                      {money(item.priceCents) ?? '—'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {section.source === 'partner' && (
              <p className="mt-3 border-t border-ink-100 pt-3 text-[12.5px] text-ink-500">
                &ldquo;Popular&rdquo; is derived from what customers actually
                view and order. It is not something you set.
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
