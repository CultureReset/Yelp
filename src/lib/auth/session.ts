import { cookies, headers } from 'next/headers';
import { eq, and, isNull, gt, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { sessions, users, memberships, organizations, authEvents } from '@/db/schema';
import { generateToken, hashToken } from './tokens';
import {
  buildPermissions, type AuthContext,
} from '@/lib/permissions';
import type { Role } from '@/lib/permissions';

const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'ybiz_session';
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
const IDLE_MS = 14 * 24 * 60 * 60 * 1000;      // 14 days

export async function requestMeta() {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  return {
    ip: fwd?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent') ?? null,
  };
}

export async function createSession(userId: string, opts: { mfaSatisfied?: boolean } = {}) {
  const { raw, hash } = generateToken();
  const { ip, userAgent } = await requestMeta();
  const now = new Date();

  const [row] = await db.insert(sessions).values({
    userId,
    tokenHash: hash,
    ip,
    userAgent,
    mfaSatisfiedAt: opts.mfaSatisfied ? now : null,
    reauthAt: now,
    expiresAt: new Date(now.getTime() + ABSOLUTE_MS),
  }).returning();

  const jar = await cookies();
  jar.set(COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });

  return row;
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    await db.update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(raw)));
  }
  jar.delete(COOKIE);
}

/** Sign out everywhere. Called on password change and on user removal. */
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  const conds = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  await db.update(sessions).set({ revokedAt: new Date() }).where(
    exceptSessionId
      ? and(...conds, sql`${sessions.id} <> ${exceptSessionId}`)
      : and(...conds),
  );
}

export async function markReauthenticated(sessionId: string) {
  await db.update(sessions).set({ reauthAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function setActiveBusiness(sessionId: string, businessId: string) {
  await db.update(sessions)
    .set({ activeBusinessId: businessId })
    .where(eq(sessions.id, sessionId));
}

/**
 * Resolves the cookie to a full AuthContext, or null. Every server component
 * and every action goes through this — nothing reads the cookie directly.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const now = new Date();
  const rows = await db
    .select({
      session: sessions,
      user: users,
      membership: memberships,
      org: organizations,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .leftJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(and(
      eq(sessions.tokenHash, hashToken(raw)),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now),
    ))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.user.status !== 'active' || row.user.deletedAt) return null;

  // Idle timeout
  if (now.getTime() - row.session.lastSeenAt.getTime() > IDLE_MS) {
    await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, row.session.id));
    return null;
  }

  // Throttled last-seen write — once a minute is plenty.
  if (now.getTime() - row.session.lastSeenAt.getTime() > 60_000) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.session.id));
  }

  if (!row.membership || !row.org) return null;   // user exists but has no org yet

  const role = row.membership.role as Role;
  return {
    userId: row.user.id,
    email: row.user.email,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    sessionId: row.session.id,
    orgId: row.org.id,
    orgName: row.org.name,
    role,
    locationScope: row.membership.locationScope ?? 'all',
    permissions: buildPermissions(role),
    mfaSatisfiedAt: row.session.mfaSatisfiedAt,
    reauthAt: row.session.reauthAt,
    impersonatorId: null,
  };
}

export async function logAuthEvent(input: {
  userId?: string | null;
  email?: string | null;
  type: string;
  result: 'success' | 'failure';
  reason?: string;
}) {
  const { ip, userAgent } = await requestMeta();
  await db.insert(authEvents).values({
    userId: input.userId ?? null,
    email: input.email ?? null,
    type: input.type,
    result: input.result,
    reason: input.reason ?? null,
    ip,
    userAgent,
  });
}
