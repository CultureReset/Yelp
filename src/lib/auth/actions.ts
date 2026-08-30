'use server';

import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users, organizations, memberships, authTokens } from '@/db/schema';
import { hashPassword, verifyPassword, checkPasswordStrength } from './password';
import { generateToken, hashToken } from './tokens';
import {
  createSession, destroySession, revokeAllSessions,
  getAuthContext, logAuthEvent, markReauthenticated,
} from './session';
import { consume, reset } from './rate-limit';

export interface ActionState { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string }

const normalizeEmail = (e: string) => e.trim().toLowerCase();

/* ------------------------------------------------------------------ signup */

const signupSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string(),
  businessName: z.string().trim().min(1, 'Enter your business name.'),
  acceptTerms: z.literal('on', { errorMap: () => ({ message: 'You must accept the terms to continue.' }) }),
});

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
    businessName: formData.get('businessName'),
    acceptTerms: formData.get('acceptTerms'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { fieldErrors };
  }

  const { firstName, lastName, password, businessName } = parsed.data;
  const emailRaw = parsed.data.email.trim();
  const email = normalizeEmail(emailRaw);

  const strength = await checkPasswordStrength(password);
  if (!strength.ok) return { fieldErrors: { password: strength.reason! } };

  const limit = await consume(`signup:${email}`, { max: 5, windowSec: 3600 });
  if (!limit.allowed) return { error: 'Too many attempts. Try again shortly.' };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    // Do not confirm that the address is registered.
    await logAuthEvent({ email, type: 'signup', result: 'failure', reason: 'duplicate_email' });
    return { fieldErrors: { email: 'That email cannot be used. Try signing in instead.' } };
  }

  const passwordHash = await hashPassword(password);

  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email, emailRaw, firstName, lastName, passwordHash,
    }).returning({ id: users.id });

    const [org] = await tx.insert(organizations).values({
      name: businessName, billingEmail: emailRaw,
    }).returning({ id: organizations.id });

    await tx.insert(memberships).values({
      userId: user.id, orgId: org.id, role: 'owner', acceptedAt: new Date(),
    });

    return user.id;
  });

  // Email verification is required before publishing, but not before browsing —
  // blocking at the door tanks activation.
  const { hash } = generateToken();
  await db.insert(authTokens).values({
    userId, kind: 'verify_email', tokenHash: hash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await createSession(userId);
  await logAuthEvent({ userId, email, type: 'signup', result: 'success' });
  redirect('/dashboard');
}

/* ------------------------------------------------------------------- login */

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }

  const email = normalizeEmail(parsed.data.email);

  const limit = await consume(`login:${email}`, { max: 5, windowSec: 900, backoff: true });
  if (!limit.allowed) {
    await logAuthEvent({ email, type: 'login', result: 'failure', reason: 'rate_limited' });
    return { error: `Too many attempts. Try again in ${Math.ceil((limit.retryAfterSec ?? 60) / 60)} minute(s).` };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Same generic message and comparable timing whether or not the account exists.
  const generic = { error: 'That email and password combination is not correct.' };
  if (!user?.passwordHash) {
    await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', parsed.data.password);
    await logAuthEvent({ email, type: 'login', result: 'failure', reason: 'no_account' });
    return generic;
  }

  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) {
    await logAuthEvent({ userId: user.id, email, type: 'login', result: 'failure', reason: 'bad_password' });
    return generic;
  }

  if (user.status !== 'active' || user.deletedAt) {
    await logAuthEvent({ userId: user.id, email, type: 'login', result: 'failure', reason: 'inactive' });
    return { error: 'This account is not active. Contact support.' };
  }

  await reset(`login:${email}`);
  await createSession(user.id);
  await logAuthEvent({ userId: user.id, email, type: 'login', result: 'success' });
  redirect('/dashboard');
}

/* ------------------------------------------------------------------ logout */

export async function logoutAction() {
  const ctx = await getAuthContext();
  await destroySession();
  if (ctx) await logAuthEvent({ userId: ctx.userId, email: ctx.email, type: 'logout', result: 'success' });
  redirect('/login');
}

/* --------------------------------------------------------- password reset */

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  if (!email.includes('@')) return { fieldErrors: { email: 'Enter a valid email address.' } };

  await consume(`reset:${email}`, { max: 3, windowSec: 3600 });

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (user) {
    const { hash } = generateToken();
    await db.insert(authTokens).values({
      userId: user.id, kind: 'reset_password', tokenHash: hash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    // Delivery happens in the notification worker.
  }

  await logAuthEvent({ email, type: 'reset_requested', result: 'success' });
  // Never reveal whether the address has an account.
  return { ok: true, message: "If that address has an account, we've sent a reset link. It expires in 30 minutes." };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');

  const strength = await checkPasswordStrength(password);
  if (!strength.ok) return { fieldErrors: { password: strength.reason! } };

  const [token] = await db.select().from(authTokens).where(and(
    eq(authTokens.tokenHash, hashToken(raw)),
    eq(authTokens.kind, 'reset_password'),
  )).limit(1);

  if (!token || token.consumedAt || token.expiresAt < new Date()) {
    return { error: 'That reset link has expired or already been used. Request a new one.' };
  }

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, token.userId));
    await tx.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, token.id));
  });

  // Using a reset link invalidates every existing session.
  await revokeAllSessions(token.userId);
  await logAuthEvent({ userId: token.userId, type: 'password_reset', result: 'success' });
  redirect('/login?reset=1');
}

/* ------------------------------------------------------------- step-up auth */

export async function reauthenticateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');

  const password = String(formData.get('password') ?? '');
  const [user] = await db.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    await logAuthEvent({ userId: ctx.userId, type: 'reauth', result: 'failure' });
    return { error: 'That password is not correct.' };
  }

  await markReauthenticated(ctx.sessionId);
  await logAuthEvent({ userId: ctx.userId, type: 'reauth', result: 'success' });
  return { ok: true, message: 'Confirmed.' };
}
