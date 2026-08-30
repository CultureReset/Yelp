import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { businesses, businessEdits, auditLog } from '@/db/schema';

/**
 * The ONLY writer to the published `businesses` row.
 *
 * Everything else proposes an edit. `businesses` is a projection of the
 * approved edit log — treat it as a cache, not as the source of truth.
 * Direct writes elsewhere are a code-review failure.
 */
export async function applyApprovedEdit(editId: string): Promise<void> {
  const [edit] = await db.select().from(businessEdits)
    .where(eq(businessEdits.id, editId)).limit(1);
  if (!edit) throw new Error(`Edit ${editId} not found`);
  if (edit.status !== 'approved' && edit.status !== 'auto_approved') {
    throw new Error(`Edit ${editId} is ${edit.status}, refusing to apply`);
  }
  if (edit.appliedAt) return;   // idempotent

  const [before] = await db.select().from(businesses)
    .where(eq(businesses.id, edit.businessId)).limit(1);
  if (!before) throw new Error(`Business ${edit.businessId} not found`);

  // Column-level patch. Relations (hours, attributes, categories) are handled
  // by their own appliers; this covers the scalar fields on `businesses`.
  const columns = new Set(Object.keys(businesses));
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(edit.patch)) {
    if (columns.has(k)) update[k] = v;
  }

  if (Object.keys(update).length > 0) {
    update.updatedAt = new Date();
    await db.update(businesses).set(update).where(eq(businesses.id, edit.businessId));
  }

  await db.transaction(async (tx) => {
    await tx.update(businessEdits)
      .set({ appliedAt: new Date() })
      .where(eq(businessEdits.id, editId));

    await tx.insert(auditLog).values({
      orgId: before.orgId,
      businessId: edit.businessId,
      actorId: edit.submittedBy,
      actorType: edit.source === 'internal' ? 'support' : 'user',
      action: 'business.edit.applied',
      targetType: 'business_edit',
      targetId: editId,
      before: JSON.stringify(
        Object.fromEntries(
          Object.keys(update).map((k) => [k, (before as Record<string, unknown>)[k]]),
        ),
      ),
      after: JSON.stringify(update),
    });
  });
}
