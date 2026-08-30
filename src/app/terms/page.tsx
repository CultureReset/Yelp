import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">Terms of Service</h1>
      <p className="mt-3 text-[15px] text-ink-600">
        This document has not been written yet. It needs a lawyer, not a
        placeholder — the sections below are what it has to cover, and shipping
        without them is what creates the exposure.
      </p>
      <ul className="mt-5 space-y-2 text-[14.5px] text-ink-600">
        {[
          'Who may open an account, and on whose behalf',
          'What businesses may and may not do about reviews',
          'How advertising is priced, billed, and cancelled',
          'What data we collect, why, and how long we keep it',
          'How to export or delete your data',
          'How disputes and moderation decisions are handled',
          'Governing law and how the terms may change',
        ].map((s) => (
          <li key={s} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
            {s}
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">
          Back to sign up
        </Link>
      </p>
    </div>
  );
}
