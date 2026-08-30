import {
  pgTable, uuid, text, timestamp, boolean, integer, smallint,
  numeric, jsonb, date, time, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './identity';

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  parentId: uuid('parent_id'),
  vertical: text('vertical').notNull(),   // restaurant | home_services | health | beauty | retail | auto | professional
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [uniqueIndex('categories_slug_uq').on(t.slug)]);

/**
 * Published listing state. This row is a PROJECTION — the only writer is the
 * publish worker in src/lib/listing/publish.ts. Everything else proposes an
 * edit. See docs/01-architecture.md.
 */
export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  aliasNames: text('alias_names').array(),
  status: text('status').notNull().default('pending'),        // pending | published | closed_temp | closed_perm | merged | removed
  mergedInto: uuid('merged_into'),
  claimStatus: text('claim_status').notNull().default('unclaimed'),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),

  // location
  address1: text('address1'),
  address2: text('address2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country').notNull().default('US'),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  geoPrecision: text('geo_precision'),                        // rooftop | interpolated | centroid | owner_placed
  neighborhood: text('neighborhood'),
  crossStreets: text('cross_streets'),
  isServiceArea: boolean('is_service_area').notNull().default(false),
  serviceAreaRadiusMi: integer('service_area_radius_mi'),
  serviceAreaPlaces: text('service_area_places').array(),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),

  // contact
  phone: text('phone'),
  phoneE164: text('phone_e164'),
  trackedPhone: text('tracked_phone'),                        // ad-call attribution number
  publicEmail: text('public_email'),
  website: text('website'),
  websiteDomain: text('website_domain'),
  menuUrl: text('menu_url'),
  orderUrl: text('order_url'),
  reservationUrl: text('reservation_url'),
  bookingUrl: text('booking_url'),
  giftCardUrl: text('gift_card_url'),
  socials: jsonb('socials').$type<Record<string, string>>().default({}),

  // classification & narrative
  priceTier: smallint('price_tier'),                          // 1-4
  yearEstablished: smallint('year_established'),
  description: text('description'),
  specialties: text('specialties'),
  history: text('history'),
  ownerBio: text('owner_bio'),
  ownerName: text('owner_name'),
  ownerPhotoKey: text('owner_photo_key'),
  languages: text('languages').array(),

  // access & parking
  parkingNotes: text('parking_notes'),
  transitNotes: text('transit_notes'),
  accessibilityNotes: text('accessibility_notes'),

  // trust
  licenseNumber: text('license_number'),
  licenseState: text('license_state'),
  licenseExpiresAt: date('license_expires_at'),
  licenseVerifiedAt: timestamp('license_verified_at', { withTimezone: true }),
  healthScore: text('health_score'),

  // denormalized counters, rebuilt by workers
  ratingAvg: numeric('rating_avg', { precision: 2, scale: 1 }),
  reviewCount: integer('review_count').notNull().default(0),
  photoCount: integer('photo_count').notNull().default(0),

  temporarilyClosedUntil: date('temporarily_closed_until'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('businesses_slug_uq').on(t.slug),
  index('businesses_org_idx').on(t.orgId),
  index('businesses_geo_idx').on(t.lat, t.lng),
  index('businesses_status_idx').on(t.status),
]);

export const businessCategories = pgTable('business_categories', {
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').notNull().default(false),
}, (t) => [
  uniqueIndex('business_categories_pk').on(t.businessId, t.categoryId),
  index('business_categories_cat_idx').on(t.categoryId),
]);

/**
 * Attributes are rows against a category-scoped schema, never columns.
 * Adding "accepts crypto" must not require a migration.
 */
export const attributeDefs = pgTable('attribute_defs', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),
  label: text('label').notNull(),
  groupLabel: text('group_label').notNull(),          // 'Amenities', 'Dining options', 'Payments'
  valueType: text('value_type').notNull(),            // bool | enum | multi_enum | int | text
  enumValues: jsonb('enum_values').$type<string[]>(),
  appliesToVerticals: text('applies_to_verticals').array(),  // null = universal
  consumerFilterable: boolean('consumer_filterable').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [uniqueIndex('attribute_defs_key_uq').on(t.key)]);

export const businessAttributes = pgTable('business_attributes', {
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  attributeId: uuid('attribute_id').notNull().references(() => attributeDefs.id, { onDelete: 'cascade' }),
  value: jsonb('value').notNull(),
  source: text('source').notNull().default('owner'),  // owner | user | partner | inferred
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('business_attributes_pk').on(t.businessId, t.attributeId)]);

/**
 * Supports split shifts (multiple rows per day), overnight ranges
 * (closes < opens), named sets (kitchen vs dining), and date-specific
 * holiday overrides. "Temporarily closed" is a business status, not 7 rows.
 */
export const businessHours = pgTable('business_hours', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  setName: text('set_name').notNull().default('default'),
  dayOfWeek: smallint('day_of_week'),                 // 0=Sun..6=Sat; null when specialDate is set
  specialDate: date('special_date'),
  opens: time('opens'),
  closes: time('closes'),
  isClosed: boolean('is_closed').notNull().default(false),
  is24h: boolean('is_24h').notNull().default(false),
  label: text('label'),
}, (t) => [
  index('business_hours_biz_idx').on(t.businessId, t.setName),
  index('business_hours_special_idx').on(t.businessId, t.specialDate),
]);

/**
 * Append-only proposal log. The source of truth for listing facts.
 * `patch` is an RFC 7386 merge patch of the fields being proposed.
 */
export const businessEdits = pgTable('business_edits', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
  source: text('source').notNull().default('owner'),  // owner | consumer | partner | internal
  patch: jsonb('patch').$type<Record<string, unknown>>().notNull(),
  fieldClass: text('field_class').notNull(),          // descriptive | operational | identity | media
  status: text('status').notNull().default('pending'),// pending | auto_approved | approved | rejected | superseded | cancelled
  riskScore: numeric('risk_score', { precision: 4, scale: 2 }),
  routedReason: text('routed_reason'),                // why it queued, shown to the owner
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectReason: text('reject_reason'),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('business_edits_biz_idx').on(t.businessId, t.createdAt),
  index('business_edits_pending_idx').on(t.status),
]);

/** Every claim attempt, method, and outcome. The evidence file for disputes. */
export const claims = pgTable('claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
  state: text('state').notNull().default('claim_started'),
  // claim_started | verification_sent | verified | manual_review | claimed | denied | disputed | expired
  method: text('method'),                             // phone_call | sms | domain_email | postcard | document | partner
  targetContact: text('target_contact'),              // the LISTING's contact, never claimant-supplied
  codeHash: text('code_hash'),
  attempts: integer('attempts').notNull().default(0),
  sendCount: integer('send_count').notNull().default(0),
  documentKeys: text('document_keys').array(),
  deniedReason: text('denied_reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('claims_business_idx').on(t.businessId, t.createdAt),
  index('claims_user_idx').on(t.userId),
]);

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  priceLowCents: integer('price_low_cents'),
  priceHighCents: integer('price_high_cents'),
  priceUnit: text('price_unit'),                      // flat | hourly | per_sqft | quote
  durationMin: integer('duration_min'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [index('services_biz_idx').on(t.businessId)]);

export const menuSections = pgTable('menu_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  source: text('source').notNull().default('manual'), // manual | import | partner
}, (t) => [index('menu_sections_biz_idx').on(t.businessId)]);

export const menuItems = pgTable('menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => menuSections.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents'),
  photoKey: text('photo_key'),
  dietaryTags: text('dietary_tags').array(),          // vegan | vegetarian | gluten_free | halal | kosher
  availableFrom: time('available_from'),
  availableTo: time('available_to'),
  isPopular: boolean('is_popular').notNull().default(false), // derived from engagement, not owner-set
  sortOrder: integer('sort_order').notNull().default(0),
  source: text('source').notNull().default('manual'),
}, (t) => [index('menu_items_section_idx').on(t.sectionId)]);
