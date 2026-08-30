import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';

export default async function Root() {
  redirect((await getAuthContext()) ? '/dashboard' : '/login');
}
