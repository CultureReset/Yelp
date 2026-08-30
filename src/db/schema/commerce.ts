import {
  pgTable, uuid, text, timestamp, boolean, integer, bigint,
  jsonb, date, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { businesses } from './listing';
import { organizations, users } from './identity';

/** Anything the business subscribes to or buys. */
export const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  // ads | upgrade_profile | remove_competitor_ads | verified_license | deals |
  // reservations | waitlist | appointments | job_postings
  status: text('status').notNull().default('pending'),  // active | paused | pending | cancelled
  priceCents: integer('price_cents'),
  billingPeriod: text('billing_period'),                // monthly | annual | usage
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelEffectiveAt: timestamp('cancel_effective_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('programs_biz_idx').on(t.businessId),
  index('programs_org_idx').on(t.orgId, t.status),
]);

/** What is switched on right now, and why. Drives feature gates. */
export const entitlements = pgTable('entitlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').references(() => programs.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),                   // cta_button | slideshow | logo | highlights | no_competitor_ads
  active: boolean('active').notNull().default(true),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  reason: text('reason'),
}, (t) => [index('entitlements_biz_idx').on(t.businessId, t.feature)]);

export const adCampaigns = pgTable('ad_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  objective: text('objective').notNull(),               // calls | website | leads | visits
  budgetCents: integer('budget_cents').notNull(),
  budgetPeriod: text('budget_period').notNull().default('monthly'),
  bidStrategy: text('bid_strategy').notNull().default('auto'), // auto | manual_cpc
  maxCpcCents: integer('max_cpc_cents'),
  geoMode: text('geo_mode').notNull().default('radius'), // radius | places
  geoRadiusMi: integer('geo_radius_mi'),
  geoPlaces: text('geo_places').array(),
  categoryTargets: uuid('category_targets').array(),
  keywordTargets: text('keyword_targets').array(),
  negativeKeywords: text('negative_keywords').array(),
  schedule: jsonb('schedule').$type<Record<string, [string, string][]>>(),  // dayparting
  creative: jsonb('creative').$type<{ photoId?: string; headline?: string; body?: string; cta?: string }>(),
  status: text('status').notNull().default('draft'),    // draft | active | paused | ended
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('ad_campaigns_biz_idx').on(t.businessId, t.status)]);

export const adSpendDaily = pgTable('ad_spend_daily', {
  campaignId: uuid('campaign_id').notNull().references(() => adCampaigns.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id').notNull(),
  day: text('day').notNull(),
  impressions: bigint('impressions', { mode: 'number' }).notNull().default(0),
  clicks: bigint('clicks', { mode: 'number' }).notNull().default(0),
  leads: bigint('leads', { mode: 'number' }).notNull().default(0),
  spendCents: bigint('spend_cents', { mode: 'number' }).notNull().default(0),
  invalidClicks: bigint('invalid_clicks', { mode: 'number' }).notNull().default(0),
}, (t) => [uniqueIndex('ad_spend_daily_pk').on(t.campaignId, t.day)]);

/** Append-only. Corrections are new entries, never updates. */
export const spendLedger = pgTable('spend_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  businessId: uuid('business_id').notNull(),
  campaignId: uuid('campaign_id'),
  kind: text('kind').notNull(),                         // click | subscription | credit | adjustment | refund
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('USD'),
  idempotencyKey: text('idempotency_key').notNull(),
  invoiceId: uuid('invoice_id'),
  note: text('note'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('spend_ledger_idem_uq').on(t.idempotencyKey),
  index('spend_ledger_org_idx').on(t.orgId, t.occurredAt),
]);

export const paymentMethods = pgTable('payment_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),            // token at the payment provider; never raw PAN
  kind: text('kind').notNull(),                         // card | ach
  brand: text('brand'),
  last4: text('last4'),
  expMonth: integer('exp_month'),
  expYear: integer('exp_year'),
  isDefault: boolean('is_default').notNull().default(false),
  addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp('removed_at', { withTimezone: true }),
}, (t) => [index('payment_methods_org_idx').on(t.orgId)]);

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  number: text('number').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull().default(0),
  taxCents: bigint('tax_cents', { mode: 'number' }).notNull().default(0),
  creditCents: bigint('credit_cents', { mode: 'number' }).notNull().default(0),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull().default('draft'),    // draft | open | paid | past_due | void | refunded
  providerInvoiceId: text('provider_invoice_id'),
  pdfKey: text('pdf_key'),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  attemptCount: integer('attempt_count').notNull().default(0),
}, (t) => [
  uniqueIndex('invoices_number_uq').on(t.number),
  index('invoices_org_idx').on(t.orgId, t.periodStart),
]);

export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id'),
  businessName: text('business_name'),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitCents: bigint('unit_cents', { mode: 'number' }).notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  programKind: text('program_kind'),
}, (t) => [index('invoice_lines_invoice_idx').on(t.invoiceId)]);

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),                         // deal | gift_certificate | check_in_offer
  title: text('title').notNull(),
  terms: text('terms').notNull(),
  priceCents: integer('price_cents'),
  /** Face value and promotional value are separate: in many US states the
   *  face value legally cannot expire even when the promotional value does. */
  faceValueCents: integer('face_value_cents'),
  promoValueCents: integer('promo_value_cents'),
  quantityTotal: integer('quantity_total'),
  quantitySold: integer('quantity_sold').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  promoExpiresAt: timestamp('promo_expires_at', { withTimezone: true }),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('deals_biz_idx').on(t.businessId, t.status)]);

export const dealRedemptions = pgTable('deal_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  purchasedBy: uuid('purchased_by'),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  payoutId: uuid('payout_id'),
}, (t) => [uniqueIndex('deal_redemptions_code_uq').on(t.code)]);

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  prefix: text('prefix').notNull(),                     // shown in the UI for identification
  scopes: text('scopes').array().notNull(),
  locationScope: uuid('location_scope').array(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('api_keys_hash_uq').on(t.keyHash),
  index('api_keys_org_idx').on(t.orgId),
]);
