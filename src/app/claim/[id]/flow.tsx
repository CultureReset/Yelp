'use client';

import { useState, useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import clsx from 'clsx';
import {
  startClaimAction, sendVerificationAction, verifyClaimAction, disputeClaimAction,
} from '@/lib/claim/actions';
import type { ClaimState } from '@/lib/claim/types';
import { Button, Input, Textarea, Alert, Badge, Field } from '@/components/ui';

interface MethodView {
  key: string;
  label: string;
  blurb: string;
  strength: string;
  available: boolean;
  reason: string | null;
  target: string | null;
}

function Submit({ children, busy }: { children: React.ReactNode; busy: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? busy : children}</Button>;
}

export function ClaimFlow({
  businessId, mode, methods, state, sendsLeft, attemptsUsed = 0, defaultOpen,
}: {
  businessId: string;
  mode: 'claim' | 'dispute';
  methods: MethodView[];
  state: string | null;
  sendsLeft: number;
  attemptsUsed?: number;
  defaultOpen: boolean;
}) {
  const [started, setStarted] = useState(
    state === 'claim_started' || state === 'verification_sent' || state === 'manual_review',
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(defaultOpen);

  const [startState, startFormAction] = useActionState<ClaimState, FormData>(startClaimAction, {});
  const [sendState, sendAction] = useActionState<ClaimState, FormData>(sendVerificationAction, {});
  const [verifyState, verifyAction] = useActionState<ClaimState, FormData>(verifyClaimAction, {});
  const [disputeState, disputeAction] = useActionState<ClaimState, FormData>(disputeClaimAction, {});

  const codeSent = sendState.ok && chosen !== 'postcard' && chosen !== 'document';
  const awaitingCode = state === 'verification_sent' || codeSent;

  useEffect(() => { if (sendState.ok) setStarted(true); }, [sendState.ok]);
  useEffect(() => { if (startState.ok) setStarted(true); }, [startState.ok]);

  /* ------------------------------------------------------------- dispute */
  if (mode === 'dispute') {
    if (disputeState.ok) {
      return <Alert tone="good" title="Dispute received">{disputeState.message}</Alert>;
    }
    return disputing ? (
      <form action={disputeAction} className="space-y-3 rounded-lg border border-ink-200 bg-white p-4">
        <input type="hidden" name="businessId" value={businessId} />
        <h2 className="text-[15px] font-semibold text-ink-900">Tell us why this is yours</h2>
        {disputeState.error && <Alert tone="bad">{disputeState.error}</Alert>}
        <Field label="What is your connection to this business?" name="detail" required>
          <Textarea
            id="detail" name="detail" required
            placeholder="I have owned and operated this business since 2011. The current claimant is a former employee."
          />
        </Field>
        <p className="text-[12.5px] text-ink-500">
          A reviewer weighs evidence from both sides. Paying for advertising
          has no bearing on the outcome.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDisputing(false)}>Cancel</Button>
          <Submit busy="Sending…">Submit dispute</Submit>
        </div>
      </form>
    ) : (
      <div className="rounded-lg border border-ink-200 bg-white p-4">
        <Button onClick={() => setDisputing(true)}>This business is mine</Button>
      </div>
    );
  }

  /* ---------------------------------------------------- manual review end */
  if (state === 'manual_review') {
    return (
      <Alert tone="warn" title="A reviewer is looking at this">
        We could not verify you automatically, so a person is checking. That
        usually takes up to two business days, and we will email you either way.
      </Alert>
    );
  }

  /* ------------------------------------------------------------ step one */
  if (!started) {
    return (
      <div className="rounded-lg border border-ink-200 bg-white p-5">
        <h2 className="text-[16px] font-semibold text-ink-900">Is this your business?</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-600">
          Claiming gives you control of the details and lets you reply to
          customers in this business&apos;s name. We verify first.
        </p>
        {startState.error && <div className="mt-3"><Alert tone="bad">{startState.error}</Alert></div>}
        <form action={startFormAction} className="mt-4">
          <input type="hidden" name="businessId" value={businessId} />
          <Submit busy="Starting…">Yes, this is my business</Submit>
        </form>
      </div>
    );
  }

  /* ------------------------------------------------------------ step two */
  return (
    <div className="space-y-4">
      {!awaitingCode && (
        <form action={sendAction} className="rounded-lg border border-ink-200 bg-white p-5">
          <input type="hidden" name="businessId" value={businessId} />
          <h2 className="text-[16px] font-semibold text-ink-900">How should we verify you?</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-600">
            Each option uses a contact detail already on the listing. That is
            what makes it proof.
          </p>

          {sendState.error && <div className="mt-3"><Alert tone="bad">{sendState.error}</Alert></div>}
          {sendState.ok && sendState.message && (
            <div className="mt-3"><Alert tone="good">{sendState.message}</Alert></div>
          )}

          <ul className="mt-4 space-y-2">
            {methods.map((m) => (
              <li key={m.key}>
                <label
                  className={clsx(
                    'flex gap-3 rounded-md border p-3 transition-colors',
                    m.available
                      ? 'cursor-pointer border-ink-200 hover:border-brand-300 hover:bg-brand-50/40'
                      : 'cursor-not-allowed border-ink-100 bg-ink-50 opacity-70',
                  )}
                >
                  <input
                    type="radio" name="method" value={m.key} required
                    disabled={!m.available}
                    onChange={() => setChosen(m.key)}
                    className="mt-1 h-4 w-4 shrink-0 accent-brand-700"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-ink-900">{m.label}</span>
                      <Badge tone={m.available ? 'neutral' : 'neutral'}>{m.strength}</Badge>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-500">{m.blurb}</span>
                    {m.available && m.target && (
                      <span className="tnum mt-1 block text-[13px] font-medium text-ink-800">
                        {m.target}
                      </span>
                    )}
                    {!m.available && m.reason && (
                      <span className="mt-1 block text-[12.5px] text-ink-500">{m.reason}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-ink-500">
              {sendsLeft} code request{sendsLeft === 1 ? '' : 's'} left today
            </p>
            <Submit busy="Sending…">Send verification</Submit>
          </div>
        </form>
      )}

      {awaitingCode && (
        <form action={verifyAction} className="rounded-lg border border-ink-200 bg-white p-5">
          <input type="hidden" name="businessId" value={businessId} />
          <h2 className="text-[16px] font-semibold text-ink-900">Enter the 6-digit code</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-600">
            {sendState.message ?? 'We sent a code to the contact details on the listing.'}
          </p>

          {verifyState.error && <div className="mt-3"><Alert tone="bad">{verifyState.error}</Alert></div>}

          <div className="mt-4 max-w-[220px]">
            <label htmlFor="code" className="sr-only">Verification code</label>
            <Input
              id="code" name="code" inputMode="numeric" autoComplete="one-time-code"
              pattern="\d{6}" maxLength={6} required autoFocus
              placeholder="123456"
              className="tnum text-center text-lg tracking-[0.3em]"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-ink-500">
              {attemptsUsed > 0 && `${5 - attemptsUsed} attempt(s) left. `}
              Codes expire after 15 minutes.
            </p>
            <Submit busy="Checking…">Verify</Submit>
          </div>
        </form>
      )}
    </div>
  );
}
