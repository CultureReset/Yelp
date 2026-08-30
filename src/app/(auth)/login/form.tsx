'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type ActionState } from '@/lib/auth/actions';
import { Button, Field, Input, Alert } from '@/components/ui';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="bad">{state.error}</Alert>}

      <Field label="Email" name="email" error={state.fieldErrors?.email} required>
        <Input
          id="email" name="email" type="email" autoComplete="email"
          placeholder="you@business.com" required
          invalid={!!state.fieldErrors?.email}
        />
      </Field>

      <Field label="Password" name="password" error={state.fieldErrors?.password} required>
        <Input
          id="password" name="password" type="password" autoComplete="current-password"
          placeholder="Your password" required
          invalid={!!state.fieldErrors?.password}
        />
      </Field>

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-[13px] font-medium text-brand-700 hover:underline">
          Forgot your password?
        </Link>
      </div>

      <Submit />

      <div className="relative py-2 text-center">
        <span className="relative z-10 bg-white px-3 text-[12px] uppercase tracking-wider text-ink-400">
          or
        </span>
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-ink-200" />
      </div>

      <div className="grid gap-2">
        <Button type="button" variant="secondary" className="w-full" disabled>
          Continue with Google
        </Button>
        <Button type="button" variant="secondary" className="w-full" disabled>
          Continue with Apple
        </Button>
      </div>
      <p className="text-center text-[12px] text-ink-400">
        Single sign-on arrives in Phase 1. Use email for now.
      </p>
    </form>
  );
}
