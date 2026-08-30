import {
  pgTable, uuid, text, timestamp, boolean, integer, jsonb, index,
} from 'drizzle-orm/pg-core';
import { businesses } from './listing';
import { users } from './identity';

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  consumerId: uuid('consumer_id').notNull(),
  consumerName: text('consumer_name').notNull(),
  consumerAvatarKey: text('consumer_avatar_key'),
  consumerCity: text('consumer_city'),
  kind: text('kind').notNull().default('message'),    // quote_request | message | appointment
  projectId: uuid('project_id'),                      // groups a consumer's fan-out to several businesses
  fanoutSize: integer('fanout_size'),
  status: text('status').notNull().default('open'),   // open | won | lost | closed | spam
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  unreadForBusiness: integer('unread_for_business').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('conversations_biz_recent_idx').on(t.businessId, t.lastMessageAt),
  index('conversations_biz_status_idx').on(t.businessId, t.status),
]);

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderType: text('sender_type').notNull(),          // consumer | business | system
  senderId: uuid('sender_id'),
  senderName: text('sender_name'),
  body: text('body'),
  attachments: jsonb('attachments').$type<Array<{ key: string; name: string; mime: string; bytes: number }>>().default([]),
  quote: jsonb('quote').$type<{ amountCents: number; unit: string; validUntil: string; note?: string }>(),
  isAutomated: boolean('is_automated').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)]);

/** Structured payload behind a lead — the category questionnaire answers. */
export const quoteRequests = pgTable('quote_requests', {
  conversationId: uuid('conversation_id').primaryKey().references(() => conversations.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').$type<Array<{ question: string; answer: string }>>().notNull(),
  budgetBand: text('budget_band'),
  desiredDate: text('desired_date'),
  locationText: text('location_text'),
  serviceCategory: text('service_category'),
});

export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  body: text('body').notNull(),                       // supports {{customer_name}}, {{business_name}}
  useCount: integer('use_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('message_templates_biz_idx').on(t.businessId)]);

export const inboxSettings = pgTable('inbox_settings', {
  businessId: uuid('business_id').primaryKey().references(() => businesses.id, { onDelete: 'cascade' }),
  autoReplyEnabled: boolean('auto_reply_enabled').notNull().default(false),
  autoReplyBody: text('auto_reply_body'),
  autoReplyDelaySec: integer('auto_reply_delay_sec').notNull().default(0),
  offHoursReplyEnabled: boolean('off_hours_reply_enabled').notNull().default(false),
  offHoursReplyBody: text('off_hours_reply_body'),
  awayUntil: timestamp('away_until', { withTimezone: true }),
  awayMessage: text('away_message'),
  leadCategories: text('lead_categories').array(),
  leadRadiusMi: integer('lead_radius_mi'),
  leadBudgetFloorCents: integer('lead_budget_floor_cents'),
  notifyUserIds: uuid('notify_user_ids').array(),
});
