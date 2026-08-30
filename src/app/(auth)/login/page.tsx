import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';
import { LoginForm } from './form';
import { Alert } from '@/components/ui';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ reset?: string }> }) {
  if (await getAuthContext()) redirect('/dashboard');
  const { reset } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">Sign in</h1>
      <p className="mt-1.5 text-[14px] text-ink-500">
        Manage your listing, reviews, and messages.
      </p>

      {reset && (
        <div className="mt-5">
          <Alert tone="good">Password updated. Sign in with your new password.</Alert>
        </div>
      )}

      <div className="mt-7">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-[13.5px] text-ink-500">
        New here?{' '}
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
