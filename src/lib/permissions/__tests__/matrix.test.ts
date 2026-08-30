import { describe, it, expect } from 'vitest';
import {
  ROLES, PERMISSIONS, ROLE_PERMISSIONS, MFA_REQUIRED_ROLES,
  type Role, type Permission,
} from '../roles';
import { buildPermissions, can, authorize, needsStepUp, type AuthContext } from '../context';

function ctx(role: Role, scope: string[] | 'all' = 'all', reauth = new Date()): AuthContext {
  return {
    userId: 'u1', email: 'a@b.co', firstName: 'A', lastName: 'B',
    sessionId: 's1', orgId: 'o1', orgName: 'Org',
    role, locationScope: scope,
    permissions: buildPermissions(role),
    mfaSatisfiedAt: new Date(), reauthAt: reauth, impersonatorId: null,
  };
}

/**
 * The expected matrix is checked in explicitly. When someone changes a role
 * definition, this diff shows exactly what they changed — which is the point.
 */
const EXPECTED: Record<Role, Partial<Record<Permission, boolean>>> = {
  owner:            { 'org.transfer': true,  'org.close': true,  'billing.write': true,  'review.reply': true },
  admin:            { 'org.transfer': false, 'org.close': false, 'billing.write': true,  'users.roles': true },
  billing:          { 'billing.write': true, 'review.reply': false, 'business.edit': false, 'ads.budget': true },
  location_manager: { 'business.edit_identity': true, 'billing.read': false, 'ads.budget': false },
  marketing:        { 'business.edit': true, 'business.edit_identity': false, 'billing.read': false },
  responder:        { 'review.reply': true, 'analytics.read': false, 'business.edit': false },
  analyst:          { 'analytics.read': true, 'review.reply': false, 'inbox.read': false },
};

describe('permission matrix', () => {
  it('matches the documented matrix', () => {
    for (const role of ROLES) {
      for (const [perm, expected] of Object.entries(EXPECTED[role])) {
        expect(
          ROLE_PERMISSIONS[role].has(perm as Permission),
          `${role} → ${perm}`,
        ).toBe(expected);
      }
    }
  });

  it('grants owner every permission', () => {
    expect(ROLE_PERMISSIONS.owner.size).toBe(PERMISSIONS.length);
  });

  it('never grants a permission outside the known set', () => {
    for (const role of ROLES) {
      for (const p of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(p);
      }
    }
  });

  it('requires MFA for every role that can touch money or users', () => {
    for (const role of ROLES) {
      const touchesMoney = ROLE_PERMISSIONS[role].has('billing.write');
      const touchesUsers = ROLE_PERMISSIONS[role].has('users.roles');
      if (touchesMoney || touchesUsers) {
        expect(MFA_REQUIRED_ROLES.has(role), `${role} should require MFA`).toBe(true);
      }
    }
  });
});

describe('location scoping', () => {
  it('allows in-scope locations', () => {
    expect(can(ctx('location_manager', ['biz-1']), 'review.reply', 'biz-1')).toBe(true);
  });

  it('denies out-of-scope locations even with the permission', () => {
    const c = ctx('location_manager', ['biz-1']);
    expect(c.permissions.has('review.reply')).toBe(true);
    expect(can(c, 'review.reply', 'biz-2')).toBe(false);
    expect(() => authorize(c, 'review.reply', 'biz-2')).toThrow(/access scope/);
  });

  it("treats 'all' as every location", () => {
    expect(can(ctx('admin', 'all'), 'review.reply', 'anything')).toBe(true);
  });
});

describe('step-up authentication', () => {
  const stale = new Date(Date.now() - 20 * 60 * 1000);

  it('demands re-auth for sensitive actions on a stale session', () => {
    expect(needsStepUp(ctx('owner', 'all', stale), 'billing.write')).toBe(true);
    expect(() => authorize(ctx('owner', 'all', stale), 'billing.write')).toThrow(/Confirm your password/);
  });

  it('leaves ordinary actions alone', () => {
    expect(needsStepUp(ctx('owner', 'all', stale), 'review.reply')).toBe(false);
  });

  it('passes when re-auth is fresh', () => {
    expect(needsStepUp(ctx('owner'), 'billing.write')).toBe(false);
  });
});
