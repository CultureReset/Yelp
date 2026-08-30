import { redirect } from 'next/navigation';

/** The Settings page is one scroll; sub-routes deep-link into their block. */
export default function Page() {
  redirect('/dashboard/settings#notifications');
}
