import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from './form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">Reset your password</h1>
      <p className="mt-1.5 text-[14px] text-ink-500">
        We&apos;ll email you a link. It expires in 30 minutes and can be used once.
      </p>
      <div className="mt-7">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-[13.5px] text-ink-500">
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
