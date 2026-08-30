'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signupAction, type ActionState } from '@/lib/auth/actions';
import { Button, Field, Input, Alert } from '@/components/ui';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating your account…' : 'Create account'}
    </Button>
  );
}

export function SignupForm() {
  const [state, action] = useActionState<ActionState, FormData>(signupAction, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="bad">{state.error}</Alert>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="firstName" error={state.fieldErrors?.firstName} required>
          <Input id="firstName" name="firstName" autoComplete="given-name" required
                 invalid={!!state.fieldErrors?.firstName} />
        </Field>
        <Field label="Last name" name="lastName" error={state.fieldErrors?.lastName} required>
          <Input id="lastName" name="lastName" autoComplete="family-name" required
                 invalid={!!state.fieldErrors?.lastName} />
        </Field>
      </div>

      <Field label="Business name" name="businessName" error={state.fieldErrors?.businessName}
             hint="You can add more locations later." required>
        <Input id="businessName" name="businessName" autoComplete="organization" required
               placeholder="Rosa's Taqueria" invalid={!!state.fieldErrors?.businessName} />
      </Field>

      <Field label="Work email" name="email" error={state.fieldErrors?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required
               placeholder="you@business.com" invalid={!!state.fieldErrors?.email} />
      </Field>

      <Field
        label="Password" name="password" error={state.fieldErrors?.password}
        hint="At least 12 characters. We check it against known breaches." required
      >
        <Input id="password" name="password" type="password" autoComplete="new-password"
               required minLength={12} invalid={!!state.fieldErrors?.password} />
      </Field>

      {/* Terms and marketing consent are separate on purpose — bundling them
          is not valid consent in several jurisdictions. */}
      <div className="space-y-2.5 pt-1">
        <label className="flex gap-2.5 text-[13px] text-ink-600">
          <input type="checkbox" name="acceptTerms" required
                 className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
          <span>
            I agree to the{' '}
            <Link href="/terms" className="font-medium text-brand-700 hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="font-medium text-brand-700 hover:underline">Privacy Policy</Link>.
          </span>
        </label>
        {state.fieldErrors?.acceptTerms && (
          <p role="alert" className="text-[12.5px] text-bad-700">{state.fieldErrors.acceptTerms}</p>
        )}
        <label className="flex gap-2.5 text-[13px] text-ink-600">
          <input type="checkbox" name="marketingConsent"
                 className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
          <span>Send me tips and product updates. Optional.</span>
        </label>
      </div>

      <Submit />
    </form>
  );
}
