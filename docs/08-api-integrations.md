# 08 — Public API & Integrations

## Why this exists

Multi-location brands and agencies will not use your dashboard as their
primary interface. They have 200 locations and a BI stack. If you don't give
them an API, they'll scrape the dashboard, and you'll spend engineering time
blocking your best customers.

## API surface

REST + JSON, versioned in the path (`/v1/`), OAuth 2.0 client-credentials for
server-to-server and authorization-code for third-party apps acting on a
business's behalf.

**Business management**
```
GET    /v1/businesses                       list locations in the org
GET    /v1/businesses/{id}
PATCH  /v1/businesses/{id}                  → creates a business_edit, returns pending
GET    /v1/businesses/{id}/edits            edit status & moderation outcomes
PUT    /v1/businesses/{id}/hours
GET    /v1/businesses/{id}/attributes
PUT    /v1/businesses/{id}/attributes
POST   /v1/businesses/{id}/media            multipart or presigned-URL flow
DELETE /v1/media/{id}
PUT    /v1/businesses/{id}/menu
```

**Reviews**
```
GET    /v1/businesses/{id}/reviews          cursor paginated, filterable
POST   /v1/reviews/{id}/reply
POST   /v1/reviews/{id}/report
```

**Messaging**
```
GET    /v1/businesses/{id}/conversations
GET    /v1/conversations/{id}/messages
POST   /v1/conversations/{id}/messages
PATCH  /v1/conversations/{id}               status: won|lost|closed|spam
```

**Analytics**
```
GET  /v1/businesses/{id}/metrics?metrics=page_views,leads&from=&to=&granularity=day
POST /v1/reports                            async export job
GET  /v1/reports/{id}                       status + signed download URL
```

**Advertising**
```
GET/POST/PATCH /v1/campaigns
GET  /v1/campaigns/{id}/performance
GET  /v1/invoices
```

**Conventions**
- Cursor pagination only. Offset pagination breaks on live data.
- `Idempotency-Key` header honored on all POSTs.
- Rate limits per client and per business, returned in `RateLimit-*` headers,
  with `429` and `Retry-After`.
- Errors: a stable machine `code`, a human `message`, and a `field` where
  applicable. Never leak internals.
- Partial failure in batch endpoints returns per-item status, not a blanket
  400.
- Everything read-your-writes consistent within the org, or the response says
  it's pending (as `PATCH /businesses` does).

## Webhooks

Push, don't make them poll.

Events: `review.created`, `review.updated`, `review.replied`,
`message.received`, `lead.created`, `business.edit_approved`,
`business.edit_rejected`, `media.moderated`, `campaign.budget_exhausted`,
`invoice.paid`, `invoice.payment_failed`, `deal.redeemed`.

Delivery contract: at-least-once, signed with HMAC-SHA256 over the raw body
plus a timestamp (replay window), exponential retry for 24h, a dead-letter
view in the dashboard, and a manual replay button. Consumers must be told to
be idempotent — put it in the docs and in the payload (`event_id`).

## Inbound integrations

| Partner class | What flows in | What flows out |
|---|---|---|
| POS (Toast, Square, Clover) | Menu, prices, hours, order availability | Order clicks |
| Reservation (OpenTable, Resy) | Availability, bookings | Reservation intent |
| Booking/scheduling (Mindbody, Vagaro) | Services, staff availability | Appointment requests |
| Review management (Birdeye, Podium, Sprout) | Replies | Reviews, ratings |
| CRM (Salesforce, HubSpot) | — | Leads |
| Listing management (Yext, Uberall) | Business facts across locations | Edit status |
| Ad/analytics (GA4, Google Ads) | — | Conversions, spend |
| Accounting (QuickBooks, Xero) | — | Invoices |

**The authority problem.** When a POS feed and an owner's manual edit disagree
about a menu price, something must win. Store `source` on every field-level
value and let the org configure authority per data domain. Show the owner
which fields are partner-managed and therefore read-only in the dashboard —
silently reverting their edit overnight is the worst possible outcome.

## Developer experience

- OpenAPI spec generated from the implementation, not hand-maintained.
- Sandbox environment with seeded businesses, reviews, and a fake ad account.
- Client libraries for at least TypeScript and Python.
- API keys managed in the dashboard, scoped by permission and location, with
  last-used timestamps and one-click rotation.
- A changelog and a deprecation policy with a minimum 12-month window. Say it
  publicly; enterprise buyers ask.
