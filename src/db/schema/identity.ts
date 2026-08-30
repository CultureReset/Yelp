import {
  pgTable, uuid, text, timestamp, boolean, integer, inet,
  index, uniqueIndex, customType,
} from 'drizzle-orm/pg-core';

/** citext-equivalent: we normalize in application code and enforce a unique index. */
const citext = customType<{ data: string }>({ dataType: () => 'text' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: citext('email').notNull(),
  emailRaw: text('email_raw').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  passwordHash: text('password_hash'),               // null for SSO-only accounts
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
  avatarKey: text('avatar_key'),
  locale: text('locale').notNull().default('en-US'),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  mfaEnforced: boolean('mfa_enforced').notNull().default(false),
  status: text('status').notNull().default('active'), // active | suspended | closed
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [uniqueIndex('users_email_uq').on(t.email)]);

/** Passkeys, TOTP secrets, and OAuth links all live here. */
export const authCredentials = pgTable('auth_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),                       // totp | webauthn | oauth_google | oauth_apple
  secretEnc: text('secret_enc'),                      // envelope-encrypted at rest
  publicKey: text('public_key'),
  providerSubject: text('provider_subject'),
  label: text('label'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('auth_credentials_user_idx').on(t.userId),
  uniqueIndex('auth_credentials_provider_uq').on(t.kind, t.providerSubject),
]);

/** Single-use recovery codes, stored hashed. */
export const recoveryCodes = pgTable('recovery_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('recovery_codes_user_idx').on(t.userId)]);

/**
 * Opaque server-side sessions, not stateless JWTs — removing a teammate has to
 * revoke their access immediately, which a signed token cannot do.
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),            // never store the raw token
  activeOrgId: uuid('active_org_id'),
  activeBusinessId: uuid('active_business_id'),
  ip: inet('ip'),
  userAgent: text('user_agent'),
  city: text('city'),
  mfaSatisfiedAt: timestamp('mfa_satisfied_at', { withTimezone: true }),
  reauthAt: timestamp('reauth_at', { withTimezone: true }), // drives step-up auth
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('sessions_token_uq').on(t.tokenHash),
  index('sessions_user_idx').on(t.userId),
]);

/** Email verification, password reset, and magic-link tokens. */
export const authTokens = pgTable('auth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),                       // verify_email | reset_password | magic_link | change_email
  tokenHash: text('token_hash').notNull(),
  payload: text('payload'),                           // e.g. the requested new email
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('auth_tokens_hash_uq').on(t.tokenHash),
  index('auth_tokens_user_kind_idx').on(t.userId, t.kind),
]);

/** Append-only. Doubles as a security tool and a support tool. */
export const authEvents = pgTable('auth_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: text('email'),
  type: text('type').notNull(),                       // login | login_failed | logout | signup | reset_requested ...
  result: text('result').notNull(),                   // success | failure
  reason: text('reason'),
  ip: inet('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('auth_events_user_idx').on(t.userId, t.createdAt),
  index('auth_events_email_idx').on(t.email, t.createdAt),
]);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('single'),     // single | multi | agency
  legalName: text('legal_name'),
  taxId: text('tax_id'),
  billingEmail: text('billing_email'),
  billingCustomerId: text('billing_customer_id'),     // payment provider customer
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

/** The edge between a person and an organization. Carries the role. */
export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),                       // see src/lib/permissions
  locationScope: uuid('location_scope').array(),      // null = every location in the org
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('memberships_user_org_uq').on(t.userId, t.orgId),
  index('memberships_org_idx').on(t.orgId),
]);

/** Pending invitations. Token is bound to the invited address. */
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: citext('email').notNull(),
  role: text('role').notNull(),
  locationScope: uuid('location_scope').array(),
  tokenHash: text('token_hash').notNull(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('invitations_token_uq').on(t.tokenHash),
  index('invitations_org_idx').on(t.orgId),
]);

/** Per-user, per-event-type, per-channel. Not per-business. */
export const notificationPrefs = pgTable('notification_prefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),            // review.created | lead.created | invoice.failed ...
  email: boolean('email').notNull().default(true),
  push: boolean('push').notNull().default(true),
  sms: boolean('sms').notNull().default(false),
  inApp: boolean('in_app').notNull().default(true),
}, (t) => [uniqueIndex('notification_prefs_uq').on(t.userId, t.eventType)]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  href: text('href'),                                 // deep link into context, never a dead end
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)]);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id'),
  businessId: uuid('business_id'),
  actorId: uuid('actor_id'),
  actorType: text('actor_type').notNull().default('user'), // user | system | support | partner
  impersonatorId: uuid('impersonator_id'),
  action: text('action').notNull(),                   // 'business.hours.updated'
  targetType: text('target_type'),
  targetId: uuid('target_id'),
  before: text('before'),
  after: text('after'),
  ip: inet('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('audit_log_business_idx').on(t.businessId, t.createdAt),
  index('audit_log_org_idx').on(t.orgId, t.createdAt),
]);

/** Generic counter for login attempts, verification retries, invite sends. */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
});
