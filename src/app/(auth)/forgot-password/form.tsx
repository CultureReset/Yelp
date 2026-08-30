'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestPasswordResetAction, type ActionState } from '@/lib/auth/actions';
import { Button, Field, Input, Alert } from '@/components/ui';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Sending…' : 'Send reset link'}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestPasswordResetAction, {});

  if (state.ok) return <Alert tone="good" title="Check your email">{state.message}</Alert>;

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="bad">{state.error}</Alert>}
      <Field label="Email" name="email" error={state.fieldErrors?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required
               placeholder="you@business.com" invalid={!!state.fieldErrors?.email} />
      </Field>
      <Submit />
    </form>
  );
}
