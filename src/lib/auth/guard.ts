import { redirect } from 'next/navigation';
import { getAuthContext } from './session';
import {
  authorize, PermissionError, type AuthContext, type Permission,
} from '@/lib/permissions';

/** Every authenticated page starts with this. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  return ctx;
}

/**
 * Route guard. A page that touches business data declares the permission it
 * needs; a route with no declaration fails closed in review.
 *
 * Denial renders an explanatory page rather than throwing — a 500 with a
 * stack trace is failing closed, but it tells the user nothing and looks
 * like an outage.
 */
export async function requirePermission(
  permission: Permission,
  businessId?: string | null,
): Promise<AuthContext> {
  const ctx = await requireAuth();
  try {
    authorize(ctx, permission, businessId);
  } catch (e) {
    if (e instanceof PermissionError) {
      const params = new URLSearchParams({ permission, kind: e.kind });
      redirect(`/dashboard/no-access?${params}`);
    }
    throw e;
  }
  return ctx;
}
