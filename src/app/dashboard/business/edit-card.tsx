'use client';

import { useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitBusinessEditAction, type EditState } from '@/lib/listing/actions';
import { Button, Field, Input, Textarea, Alert, Badge } from '@/components/ui';

export interface EditField {
  name: string;
  label: string;
  value: string | number | null;
  type: 'text' | 'textarea' | 'number' | 'tel' | 'url' | 'email' | 'select';
  hint?: string;
  required?: boolean;
  /** Marks a field that always routes to human review. */
  moderated?: boolean;
  options?: { value: string; label: string }[];
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

export function EditCard({
  businessId, card, title, description, fields, canEdit,
  readOnly = [], readOnlyReason, footer,
}: {
  businessId: string;
  card: string;
  title: string;
  description: string;
  fields: EditField[];
  canEdit: boolean;
  identityWarning?: string;
  readOnly?: string[];
  readOnlyReason?: string;
  footer?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<EditState, FormData>(submitBusinessEditAction, {});

  const moderatedFields = fields.filter((f) => f.moderated).map((f) => f.label);

  return (
    <section className="rounded-lg border border-ink-200 bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
          <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </header>

      <div className="px-5 py-4">
        {state.ok && state.message && (
          <div className="mb-4">
            <Alert tone={state.status === 'pending' ? 'warn' : 'good'}
                   title={state.status === 'pending' ? 'Submitted for review' : 'Saved'}>
              {state.message}
            </Alert>
          </div>
        )}
        {state.error && <div className="mb-4"><Alert tone="bad">{state.error}</Alert></div>}
        {!canEdit && readOnlyReason && (
          <div className="mb-4"><Alert tone="info">{readOnlyReason}</Alert></div>
        )}

        {editing ? (
          <form action={action} className="space-y-4">
            <input type="hidden" name="businessId" value={businessId} />
            <input type="hidden" name="card" value={card} />

            {moderatedFields.length > 0 && (
              <Alert tone="warn" title="Some of these go to review">
                Changes to {moderatedFields.join(', ')} are checked by a person before
                they appear publicly. Everything else here publishes right away.
              </Alert>
            )}

            {fields.map((f) => {
              const locked = readOnly.includes(f.name);
              return (
                <Field
                  key={f.name} label={f.label} name={f.name}
                  hint={locked ? 'Your role cannot change this field.' : f.hint}
                  required={f.required}
                >
                  {f.type === 'textarea' ? (
                    <Textarea id={f.name} name={f.name} defaultValue={f.value ?? ''} disabled={locked} />
                  ) : f.type === 'select' ? (
                    <select
                      id={f.name} name={f.name} defaultValue={f.value ?? ''} disabled={locked}
                      className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900"
                    >
                      <option value="">Not set</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={f.name} name={f.name} type={f.type}
                      defaultValue={f.value ?? ''} disabled={locked} required={f.required}
                    />
                  )}
                </Field>
              );
            })}

            <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Save />
            </div>
          </form>
        ) : (
          <>
            <dl className="divide-y divide-ink-100">
              {fields.map((f) => {
                const display = f.type === 'select'
                  ? f.options?.find((o) => o.value === String(f.value))?.label ?? null
                  : f.value;
                return (
                  <div key={f.name} className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                    <dt className="flex items-center gap-1.5 text-[13px] text-ink-500">
                      {f.label}
                      {f.moderated && (
                        <span title="Reviewed before publishing" aria-label="Reviewed before publishing"
                              className="text-[11px] text-warn-700">⚑</span>
                      )}
                    </dt>
                    <dd className="text-[13.5px] text-ink-900">
                      {display ? (
                        <span className="whitespace-pre-wrap">{display}</span>
                      ) : (
                        <span className="text-ink-400">Not set</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {footer && <div className="mt-4">{footer}</div>}
          </>
        )}
      </div>
    </section>
  );
}
