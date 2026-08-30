import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';
import { SignupForm } from './form';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignupPage() {
  if (await getAuthContext()) redirect('/dashboard');

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">Create your account</h1>
      <p className="mt-1.5 text-[14px] text-ink-500">
        Free to claim and manage your business.
      </p>

      <div className="mt-7">
        <SignupForm />
      </div>

      <p className="mt-6 text-center text-[13.5px] text-ink-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
