import { Card, Badge } from '@/components/ui';

export interface Slot {
  name: string;
  status: 'built' | 'next' | 'planned';
  detail: string;
  fields?: string[];
}

/**
 * Renders a section's specified slots with honest build status. Sections move
 * from this to real UI as each phase lands; the slot list is the contract.
 */
export function SectionScaffold({
  title, purpose, slots, note,
}: { title: string; purpose: string; slots: Slot[]; note?: string }) {
  const tone = { built: 'good', next: 'brand', planned: 'neutral' } as const;
  const label = { built: 'Built', next: 'Next up', planned: 'Planned' } as const;
  const built = slots.filter((s) => s.status === 'built').length;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-ink-900">{title}</h1>
          <Badge tone={built === slots.length ? 'good' : 'neutral'}>
            {built} of {slots.length} slots built
          </Badge>
        </div>
        <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-500">{purpose}</p>
      </header>

      {note && (
        <div className="rounded-md border-l-2 border-brand-600 bg-brand-50/50 px-4 py-3 text-[13px] text-ink-700">
          {note}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => (
          <li key={slot.name}>
            <Card className="h-full">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[14.5px] font-semibold text-ink-900">{slot.name}</h2>
                <Badge tone={tone[slot.status]}>{label[slot.status]}</Badge>
              </div>
              <p className="mt-1.5 text-[13px] text-ink-600">{slot.detail}</p>
              {slot.fields && (
                <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
                  {slot.fields.map((f) => (
                    <li key={f}
                        className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-600">
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
