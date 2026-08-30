import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, setActiveBusiness } from '@/lib/auth/session';
import { listBusinesses } from '@/lib/business/context';

/** Location switcher target. Verifies the location is actually in scope. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.redirect(new URL('/login', req.url));

  const { id } = await params;
  const allowed = await listBusinesses(ctx);
  if (!allowed.some((b) => b.id === id)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  await setActiveBusiness(ctx.sessionId, id);
  const back = req.headers.get('referer') ?? '/dashboard';
  return NextResponse.redirect(new URL(back, req.url), { status: 303 });
}
