import { hash, verify } from '@node-rs/argon2';
import { createHash } from 'node:crypto';

// Algorithm.Argon2id === 2. Inlined because @node-rs ships it as an ambient
// const enum, which isolatedModules cannot read.
const OPTS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain, OPTS);
  } catch {
    return false;
  }
}

/**
 * Composition rules reduce entropy in practice, so we check length and known
 * breaches instead. Uses the Have I Been Pwned k-anonymity range API: only the
 * first 5 characters of the SHA-1 leave this process, never the password.
 */
export async function isBreachedPassword(plain: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(plain).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;               // fail open — availability beats a hard block
    const body = await res.text();
    return body.split('\n').some((line) => line.split(':')[0]?.trim() === suffix);
  } catch {
    return false;
  }
}

export interface PasswordCheck { ok: boolean; reason?: string }

export async function checkPasswordStrength(plain: string): Promise<PasswordCheck> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (plain.length > 200) {
    return { ok: false, reason: 'That password is too long.' };
  }
  if (await isBreachedPassword(plain)) {
    return {
      ok: false,
      reason: 'This password has appeared in a known data breach. Choose a different one.',
    };
  }
  return { ok: true };
}
