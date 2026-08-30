import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { SectionScaffold } from '@/components/section-scaffold';

export const metadata: Metadata = { title: 'Inbox' };

export default async function Page() {
  // Route guard: this section declares the permission it needs.
  await requirePermission('inbox.read');

  return (
    <SectionScaffold
      title={'Inbox'}
      purpose={'Leads, quote requests, and messages. For service businesses this is the product — it is built as a messaging client, not a form log.'}
      note={'Response rate and response time render on your public page, so this section has a public consequence others do not.'}
      slots={[
        {
                "name": "Conversation list",
                "status": "next",
                "detail": "Filter by unread, unanswered, status, kind, date, and assignee. Bulk mark-read, archive, and spam.",
                "fields": [
                        "unread",
                        "status",
                        "kind",
                        "assigned_to"
                ]
        },
        {
                "name": "Thread view",
                "status": "next",
                "detail": "Full history including system events, delivery and read receipts, attachments.",
                "fields": [
                        "messages",
                        "attachments",
                        "read_at"
                ]
        },
        {
                "name": "Composer",
                "status": "next",
                "detail": "Rich text, attachments, quote templates with variable substitution, and a structured price block.",
                "fields": [
                        "body",
                        "quote.amount_cents",
                        "quote.valid_until"
                ]
        },
        {
                "name": "Context sidebar",
                "status": "planned",
                "detail": "Structured quote-request answers, stated location, desired date, budget band, and prior interactions.",
                "fields": [
                        "answers",
                        "budget_band",
                        "desired_date"
                ]
        },
        {
                "name": "Won / lost marking",
                "status": "planned",
                "detail": "Feeds lead attribution and cost-per-lead reporting.",
                "fields": [
                        "status"
                ]
        },
        {
                "name": "Auto-response settings",
                "status": "planned",
                "detail": "On/off, body, delay, hours-aware off-hours reply, and away mode with an end date.",
                "fields": [
                        "auto_reply_enabled",
                        "off_hours_reply_body",
                        "away_until"
                ]
        },
        {
                "name": "Lead preferences",
                "status": "planned",
                "detail": "Categories, service radius, job types, and a budget floor.",
                "fields": [
                        "lead_categories",
                        "lead_radius_mi",
                        "lead_budget_floor_cents"
                ]
        },
        {
                "name": "Response metrics",
                "status": "planned",
                "detail": "Current response rate and median response time, with the definition and trailing window stated plainly.",
                "fields": [
                        "first_response_at"
                ]
        }
]}
    />
  );
}
