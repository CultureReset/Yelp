'use client';

import { useTransition } from 'react';
import { cancelPendingEditAction } from '@/lib/listing/actions';
import { FIELD_LABELS } from '@/lib/listing/routing';
import { Button, Badge } from '@/components/ui';

export function PendingEdits({
  edits,
}: {
  edits: Array<{ id: string; patch: Record<string, unknown>; reason: string | null; createdAt: string }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-lg border border-warn-500/30 bg-warn-50 p-4">
      <div className="flex items-center gap-2">
        <Badge tone="warn">In review</Badge>
        <h2 className="text-[14px] font-semibold text-ink-900">
          {edits.length} change{edits.length === 1 ? '' : 's'} waiting on a moderator
        </h2>
      </div>
      <ul className="mt-3 space-y-3">
        {edits.map((e) => (
          <li key={e.id} className="rounded-md border border-warn-500/20 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <ul className="space-y-1">
                  {Object.entries(e.patch).map(([field, value]) => (
                    <li key={field} className="text-[13px]">
                      <span className="font-medium text-ink-800">
                        {FIELD_LABELS[field] ?? field}
                      </span>
                      <span className="text-ink-500"> → </span>
                      <span className="text-ink-900">
                        {value === null || value === '' ? 'cleared' : String(value)}
                      </span>
                    </li>
                  ))}
                </ul>
                {e.reason && <p className="mt-1.5 text-[12.5px] text-ink-500">{e.reason}</p>}
                <p className="mt-1 text-[12px] text-ink-400">
                  Submitted {new Date(e.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm" variant="ghost" disabled={pending}
                onClick={() => startTransition(() => { void cancelPendingEditAction(e.id); })}
              >
                Cancel this change
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
