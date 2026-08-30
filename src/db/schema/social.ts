import {
  pgTable, uuid, text, timestamp, boolean, integer, smallint,
  jsonb, index,
} from 'drizzle-orm/pg-core';
import { businesses } from './listing';
import { users } from './identity';

/**
 * Consumer-authored. Read-only to the business: they get a reply and a
 * report button, never an edit or a delete.
 */
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull(),
  authorName: text('author_name').notNull(),
  authorAvatarKey: text('author_avatar_key'),
  authorReviewCount: integer('author_review_count').notNull().default(0),
  authorCity: text('author_city'),
  rating: smallint('rating').notNull(),
  body: text('body').notNull(),
  language: text('language').notNull().default('en'),
  visibility: text('visibility').notNull().default('recommended'), // recommended | not_recommended | removed
  visibilityReason: text('visibility_reason'),
  photoKeys: text('photo_keys').array(),
  helpfulCount: integer('helpful_count').notNull().default(0),
  funnyCount: integer('funny_count').notNull().default(0),
  coolCount: integer('cool_count').notNull().default(0),
  isEdited: boolean('is_edited').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (t) => [
  index('reviews_biz_created_idx').on(t.businessId, t.createdAt),
  index('reviews_biz_rating_idx').on(t.businessId, t.rating),
  index('reviews_visibility_idx').on(t.businessId, t.visibility),
]);

export const reviewReplies = pgTable('review_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  body: text('body').notNull(),
  visibility: text('visibility').notNull().default('public'), // public | direct_message
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [index('review_replies_review_idx').on(t.reviewId)]);

/** Draft autosave — owners write long replies and lose them otherwise. */
export const replyDrafts = pgTable('reply_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('reply_drafts_uq').on(t.reviewId, t.userId)]);

export const reviewReports = pgTable('review_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  reportedBy: uuid('reported_by').notNull().references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason').notNull(),
  // conflict_of_interest | not_a_customer | personal_attack | privacy | irrelevant | wrong_business | inappropriate
  detail: text('detail'),
  evidenceKeys: text('evidence_keys').array(),
  status: text('status').notNull().default('open'),   // open | under_review | upheld | declined | appealed
  decisionNote: text('decision_note'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  appealedAt: timestamp('appealed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('review_reports_biz_idx').on(t.businessId, t.createdAt)]);

/**
 * Owner media and consumer media live in one table but are governed by
 * different rules and must never be visually merged in the UI.
 */
export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  uploaderId: uuid('uploader_id'),
  uploaderName: text('uploader_name'),
  source: text('source').notNull(),                   // owner | consumer | partner
  kind: text('kind').notNull().default('photo'),      // photo | video
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type'),
  bytes: integer('bytes'),
  width: integer('width'),
  height: integer('height'),
  durationMs: integer('duration_ms'),
  caption: text('caption'),
  altText: text('alt_text'),
  tags: text('tags').array(),                         // food | drink | menu | interior | exterior | team | work
  isCover: boolean('is_cover').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  viewCount: integer('view_count').notNull().default(0),
  moderationStatus: text('moderation_status').notNull().default('pending'), // pending | approved | rejected
  moderationReason: text('moderation_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('media_biz_source_idx').on(t.businessId, t.source),
  index('media_biz_sort_idx').on(t.businessId, t.sortOrder),
]);

/** Named project galleries for service businesses — distinct from loose photos. */
export const portfolioProjects = pgTable('portfolio_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  costLowCents: integer('cost_low_cents'),
  costHighCents: integer('cost_high_cents'),
  durationDays: integer('duration_days'),
  locationText: text('location_text'),
  beforeKeys: text('before_keys').array(),
  afterKeys: text('after_keys').array(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('portfolio_biz_idx').on(t.businessId)]);

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  askedBy: uuid('asked_by'),
  askerName: text('asker_name'),
  body: text('body').notNull(),
  answerBody: text('answer_body'),
  answeredBy: uuid('answered_by').references(() => users.id, { onDelete: 'set null' }),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('questions_biz_idx').on(t.businessId, t.createdAt)]);

/** Daily pre-aggregated rollups. The dashboard NEVER queries raw events. */
export const metricsDaily = pgTable('metrics_daily', {
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  day: text('day').notNull(),                         // YYYY-MM-DD
  pageViews: integer('page_views').notNull().default(0),
  uniqueVisitors: integer('unique_visitors').notNull().default(0),
  calls: integer('calls').notNull().default(0),
  directions: integer('directions').notNull().default(0),
  websiteClicks: integer('website_clicks').notNull().default(0),
  messages: integer('messages').notNull().default(0),
  quoteRequests: integer('quote_requests').notNull().default(0),
  menuViews: integer('menu_views').notNull().default(0),
  photoViews: integer('photo_views').notNull().default(0),
  bookmarks: integer('bookmarks').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  orderClicks: integer('order_clicks').notNull().default(0),
  reservationClicks: integer('reservation_clicks').notNull().default(0),
  mobileShare: integer('mobile_share').notNull().default(0),  // percent
  sourceBreakdown: jsonb('source_breakdown').$type<Record<string, number>>().default({}),
  filterVersion: text('filter_version').notNull().default('v1'), // bot-filter version, stamped
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('metrics_daily_pk').on(t.businessId, t.day)]);

/** Raw event landing table. In production this streams to ClickHouse. */
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id'),
  type: text('type').notNull(),                       // business_page.viewed | business.call_clicked ...
  visitorId: text('visitor_id'),
  props: jsonb('props').$type<Record<string, unknown>>().default({}),
  isBot: boolean('is_bot').notNull().default(false),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('events_biz_time_idx').on(t.businessId, t.occurredAt)]);
