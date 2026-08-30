import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { can } from '@/lib/permissions';
import { db } from '@/db/client';
import { sessions, businesses, businessEdits, businessHours } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getActiveBusiness } from '@/lib/business/context';
import { EditCard } from './edit-card';
import { PendingEdits } from './pending-edits';
import { Card, EmptyState, Badge } from '@/components/ui';

export const metadata: Metadata = { title: 'Business information' };

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default async function BusinessInfoPage() {
  const ctx = await requirePermission('business.read');

  const [session] = await db
    .select({ activeBusinessId: sessions.activeBusinessId })
    .from(sessions).where(eq(sessions.id, ctx.sessionId)).limit(1);
  const active = await getActiveBusiness(ctx, session?.activeBusinessId);

  if (!active) {
    return <Card><EmptyState title="No business selected" description="Claim a business first." /></Card>;
  }

  const [biz] = await db.select().from(businesses).where(eq(businesses.id, active.id)).limit(1);
  const [pending, hours] = await Promise.all([
    db.select().from(businessEdits)
      .where(and(eq(businessEdits.businessId, active.id), eq(businessEdits.status, 'pending')))
      .orderBy(desc(businessEdits.createdAt)),
    db.select().from(businessHours)
      .where(eq(businessHours.businessId, active.id))
      .orderBy(businessHours.dayOfWeek, businessHours.opens),
  ]);

  const canEdit = can(ctx, 'business.edit', active.id);
  const canEditIdentity = can(ctx, 'business.edit_identity', active.id);

  const byDay = new Map<number, typeof hours>();
  for (const h of hours) {
    if (h.dayOfWeek === null) continue;
    const list = byDay.get(h.dayOfWeek) ?? [];
    list.push(h);
    byDay.set(h.dayOfWeek, list);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Business information</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-500">
          What customers see on your page. Changes to your name, address, phone,
          website, or categories are reviewed by a person before they publish —
          each card tells you which applies before you save.
        </p>
      </header>

      {pending.length > 0 && <PendingEdits edits={pending.map((e) => ({
        id: e.id,
        patch: e.patch,
        reason: e.routedReason,
        createdAt: e.createdAt.toISOString(),
      }))} />}

      <EditCard
        businessId={biz.id} card="basics" title="Basics"
        description="Your name, what you do, and how you describe it."
        canEdit={canEdit} identityWarning={canEditIdentity ? 'name' : undefined}
        readOnly={!canEditIdentity ? ['name'] : []}
        fields={[
          { name: 'name', label: 'Business name', value: biz.name, type: 'text', required: true,
            hint: 'Your real-world name. No taglines, slogans, or keywords.', moderated: true },
          { name: 'description', label: 'About the business', value: biz.description, type: 'textarea',
            hint: 'A short paragraph. What you serve, what makes you different.' },
          { name: 'specialties', label: 'Specialties', value: biz.specialties, type: 'textarea' },
          { name: 'history', label: 'History', value: biz.history, type: 'textarea' },
          { name: 'priceTier', label: 'Price range', value: biz.priceTier, type: 'select',
            options: [
              { value: '1', label: '$ — Inexpensive' },
              { value: '2', label: '$$ — Moderate' },
              { value: '3', label: '$$$ — Pricey' },
              { value: '4', label: '$$$$ — Splurge' },
            ] },
          { name: 'yearEstablished', label: 'Year established', value: biz.yearEstablished, type: 'number' },
        ]}
      />

      <EditCard
        businessId={biz.id} card="location" title="Location"
        description="Where customers find you. Every field here is reviewed before it publishes."
        canEdit={canEditIdentity}
        readOnlyReason={!canEditIdentity ? 'Your role can view but not change address details.' : undefined}
        fields={[
          { name: 'address1', label: 'Street address', value: biz.address1, type: 'text', moderated: true },
          { name: 'address2', label: 'Suite or floor', value: biz.address2, type: 'text', moderated: true },
          { name: 'city', label: 'City', value: biz.city, type: 'text', moderated: true },
          { name: 'state', label: 'State', value: biz.state, type: 'text', moderated: true },
          { name: 'postalCode', label: 'ZIP code', value: biz.postalCode, type: 'text', moderated: true },
        ]}
        footer={
          <div className="rounded-md bg-ink-100 p-3 text-[12.5px] text-ink-600">
            <p className="font-medium text-ink-800">Map pin</p>
            <p className="mt-0.5">
              Currently {biz.geoPrecision === 'owner_placed' ? 'placed by you' : `set from your address (${biz.geoPrecision ?? 'unknown'} accuracy)`}
              {' at '}
              <span className="tnum">{Number(biz.lat).toFixed(4)}, {Number(biz.lng).toFixed(4)}</span>.
              Drag-to-adjust arrives with the map component — geocoders get storefronts wrong often enough that this matters.
            </p>
          </div>
        }
      />

      <EditCard
        businessId={biz.id} card="contact" title="Contact & links"
        description="Phone and website changes are reviewed. Link fields publish immediately."
        canEdit={canEdit}
        fields={[
          { name: 'phone', label: 'Phone number', value: biz.phone, type: 'tel', moderated: true },
          { name: 'website', label: 'Website', value: biz.website, type: 'url', moderated: true },
          { name: 'publicEmail', label: 'Public email', value: biz.publicEmail, type: 'email' },
          { name: 'menuUrl', label: 'Menu link', value: biz.menuUrl, type: 'url' },
          { name: 'orderUrl', label: 'Online ordering link', value: biz.orderUrl, type: 'url' },
          { name: 'reservationUrl', label: 'Reservation link', value: biz.reservationUrl, type: 'url' },
        ]}
      />

      <Card
        title="Hours"
        description="Split shifts, overnight ranges, and holiday overrides are all supported."
        action={<Badge tone="neutral">Editor arrives in Phase 1</Badge>}
      >
        <dl className="divide-y divide-ink-100">
          {DAYS.map((day, i) => {
            const ranges = byDay.get(i) ?? [];
            return (
              <div key={day} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
                <dt className="text-[13.5px] font-medium text-ink-800">{day}</dt>
                <dd className="text-right text-[13.5px] text-ink-600">
                  {ranges.length === 0 || ranges.every((r) => r.isClosed) ? (
                    <span className="text-ink-400">Closed</span>
                  ) : (
                    ranges.filter((r) => !r.isClosed).map((r) => (
                      <span key={r.id} className="tnum block">
                        {fmtTime(r.opens)} – {fmtTime(r.closes)}
                        {r.label && <span className="ml-1.5 text-[12px] text-ink-400">{r.label}</span>}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>

      <EditCard
        businessId={biz.id} card="owner" title="Owner"
        description="Shown in the 'Meet the owner' section of your page."
        canEdit={canEdit}
        fields={[
          { name: 'ownerName', label: 'Owner name', value: biz.ownerName, type: 'text' },
          { name: 'ownerBio', label: 'Owner bio', value: biz.ownerBio, type: 'textarea' },
        ]}
      />

      <EditCard
        businessId={biz.id} card="access" title="Getting there"
        description="Parking, transit, and accessibility notes."
        canEdit={canEdit}
        fields={[
          { name: 'parkingNotes', label: 'Parking', value: biz.parkingNotes, type: 'textarea' },
          { name: 'transitNotes', label: 'Transit', value: biz.transitNotes, type: 'textarea' },
          { name: 'accessibilityNotes', label: 'Accessibility', value: biz.accessibilityNotes, type: 'textarea' },
        ]}
      />
    </div>
  );
}
