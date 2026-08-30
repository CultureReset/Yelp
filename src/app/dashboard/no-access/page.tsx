import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/guard';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/permissions';
import { Card, LinkButton, Alert } from '@/components/ui';

export const metadata: Metadata = { title: 'No access' };

const KIND_COPY: Record<string, { title: string; body: string }> = {
  forbidden: {
    title: 'Your role does not include this section',
    body: 'Ask an account owner or admin to change your role if you need it.',
  },
  out_of_scope: {
    title: 'That location is not in your access scope',
    body: 'You have access to some locations in this organization, but not this one.',
  },
  step_up_required: {
    title: 'Confirm your password to continue',
    body: 'This action changes something sensitive, so we ask again if it has been more than 15 minutes.',
  },
};

export default async function NoAccessPage({
  searchParams,
}: { searchParams: Promise<{ permission?: string; kind?: string }> }) {
  const ctx = await requireAuth();
  const { permission, kind } = await searchParams;
  const copy = KIND_COPY[kind ?? 'forbidden'] ?? KIND_COPY.forbidden;

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card>
        <h1 className="text-lg font-bold tracking-tight text-ink-900">{copy.title}</h1>
        <p className="mt-2 text-[14px] text-ink-600">{copy.body}</p>

        <div className="mt-5 rounded-md bg-ink-100 p-3.5">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-500">
            Your access
          </p>
          <p className="mt-1 text-[14px] font-medium text-ink-900">{ROLE_LABELS[ctx.role]}</p>
          <p className="mt-0.5 text-[13px] text-ink-600">{ROLE_DESCRIPTIONS[ctx.role]}</p>
          {permission && (
            <p className="mt-2 font-mono text-[12px] text-ink-500">
              Missing permission: {permission}
            </p>
          )}
        </div>

        {kind === 'step_up_required' && (
          <div className="mt-4">
            <Alert tone="info">
              Re-authentication is required for billing changes, user management,
              ownership transfer, and changes to your business name, address, or phone.
            </Alert>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <LinkButton href="/dashboard">Back to Home</LinkButton>
          <LinkButton href="/dashboard/settings/users" variant="secondary">
            See who can change this
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
