/**
 * Permissions are strings; roles are bundles of them.
 * Always check can(ctx, 'review.reply', businessId) — never `role === 'admin'`.
 * Role definitions change; call sites should not.
 */

export const PERMISSIONS = [
  'business.read',
  'business.edit',            // descriptive + operational fields
  'business.edit_identity',   // name, address, phone, website, categories
  'hours.edit',
  'media.write',
  'menu.write',
  'review.reply',
  'review.report',
  'review.appeal',
  'inbox.read',
  'inbox.write',
  'inbox.settings',
  'ads.read',
  'ads.write',
  'ads.budget',
  'deals.write',
  'analytics.read',
  'analytics.export',
  'billing.read',
  'billing.write',
  'program.cancel',
  'users.read',
  'users.write',
  'users.roles',
  'org.locations',
  'org.transfer',
  'org.close',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  'owner', 'admin', 'billing', 'location_manager',
  'marketing', 'responder', 'analyst',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  billing: 'Billing',
  location_manager: 'Location manager',
  marketing: 'Marketing',
  responder: 'Responder',
  analyst: 'Analyst',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Full control, including ownership transfer and closing the account.',
  admin: 'Everything except transferring ownership or closing the account.',
  billing: 'Invoices, payment methods, and budgets. No listing or review access.',
  location_manager: 'Runs the day-to-day for specific locations.',
  marketing: 'Photos, menu, descriptions, campaigns. No identity fields, no billing.',
  responder: 'Replies to reviews and messages only.',
  analyst: 'Read-only reporting.',
};

/**
 * The authoritative matrix. docs/05-permissions.md documents the `◐` limited
 * cases, which are enforced as extra guards rather than as separate grants:
 *   - location_manager may PROPOSE an identity change (business.edit_identity)
 *     but requiresApproval() routes it to an Admin before it reaches moderation.
 *   - marketing gets business.edit but not business.edit_identity.
 *   - admin gets billing.write but cannot remove the last payment method.
 */
const MATRIX: Record<Role, Permission[]> = {
  owner: [...PERMISSIONS],

  admin: PERMISSIONS.filter((p) => p !== 'org.transfer' && p !== 'org.close'),

  billing: [
    'business.read', 'analytics.read', 'analytics.export',
    'ads.read', 'ads.budget',
    'billing.read', 'billing.write', 'program.cancel',
  ],

  location_manager: [
    'business.read', 'business.edit', 'business.edit_identity', 'hours.edit',
    'media.write', 'menu.write',
    'review.reply', 'review.report', 'review.appeal',
    'inbox.read', 'inbox.write', 'inbox.settings',
    'ads.read', 'ads.write', 'deals.write',
    'analytics.read', 'analytics.export',
    'users.read', 'users.write',
  ],

  marketing: [
    'business.read', 'business.edit',
    'media.write', 'menu.write',
    'review.reply', 'review.report',
    'inbox.read', 'inbox.write', 'inbox.settings',
    'ads.read', 'ads.write', 'ads.budget', 'deals.write',
    'analytics.read', 'analytics.export',
  ],

  responder: [
    'business.read',
    'review.reply', 'review.report',
    'inbox.read', 'inbox.write',
  ],

  analyst: [
    'business.read', 'analytics.read', 'analytics.export',
  ],
};

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> =
  ROLES.reduce((acc, role) => {
    acc[role] = new Set(MATRIX[role]);
    return acc;
  }, {} as Record<Role, ReadonlySet<Permission>>);

/**
 * Actions that need re-authentication within the last 15 minutes regardless
 * of role. These are where account takeover becomes profitable.
 */
export const STEP_UP_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'billing.write',
  'business.edit_identity',
  'users.write',
  'users.roles',
  'org.transfer',
  'org.close',
]);

export const STEP_UP_WINDOW_MS = 15 * 60 * 1000;

/** Roles that must have MFA enrolled — where the money and the risk live. */
export const MFA_REQUIRED_ROLES: ReadonlySet<Role> = new Set<Role>([
  'owner', 'admin', 'billing',
]);

/**
 * A Location Manager may propose an identity change, but an Admin or Owner
 * has to approve it before it reaches the moderation queue.
 */
export function requiresInternalApproval(role: Role, permission: Permission): boolean {
  return role === 'location_manager' && permission === 'business.edit_identity';
}
