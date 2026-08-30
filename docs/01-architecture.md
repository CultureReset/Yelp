# 01 — Architecture

## The governing constraint

A business owner dashboard on a review platform is **not** a content
management system. In a CMS the operator owns the content. Here they don't:

- **Reviews** are written by consumers and cannot be edited or deleted by the
  business. The business gets a *reply*, and a *report* button.
- **Photos** come from both sides. The business owns theirs; user photos can
  only be reported, not removed.
- **Business facts** (name, address, hours, categories) are editable by the
  business, but edits are *proposed* — some publish instantly, some go to a
  moderation queue, and consumers can also submit corrections that compete
  with the owner's.
- **Ranking and recommendation** are platform decisions the business cannot
  buy or override, and the product must say so plainly, everywhere, or you
  create a compliance problem.

So the core model is **proposal + arbitration**, not direct mutation. Build
that in from day one; retrofitting a moderation layer onto direct writes is a
rewrite.

## Service shape

Start as a modular monolith with clean seams, not microservices. The seams
that matter:

```
                      ┌────────────────────────────┐
   biz.example.com ──▶│  Business Web App (Next.js)│
   (dashboard SPA)    │  SSR + RSC + route handlers│
                      └────────────┬───────────────┘
                                   │ internal RPC / typed client
      ┌────────────────────────────┼─────────────────────────────┐
      ▼              ▼             ▼              ▼              ▼
 ┌──────────┐  ┌───────────┐ ┌──────────┐  ┌───────────┐  ┌───────────┐
 │ Identity │  │  Listing  │ │  Social  │  │ Messaging │  │ Commerce  │
 │  & Org   │  │ (business │ │ (reviews,│  │  (leads,  │  │ (ads,     │
 │          │  │  facts,   │ │  photos, │  │  quotes,  │  │ billing,  │
 │ accounts │  │  hours,   │ │  Q&A,    │  │  inbox)   │  │ deals,    │
 │ sessions │  │  menus,   │ │  tips)   │  │           │  │ payouts)  │
 │ claims   │  │  edits)   │ │          │  │           │  │           │
 └────┬─────┘  └─────┬─────┘ └────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │            │              │              │
      └──────────────┴────────────┴──────┬───────┴──────────────┘
                                         ▼
                        ┌────────────────────────────────┐
                        │ Platform services              │
                        │ • Moderation & Trust           │
                        │ • Search index (OpenSearch)    │
                        │ • Event pipeline → warehouse   │
                        │ • Notification fan-out         │
                        │ • Media (upload, transcode)    │
                        │ • Async workers (queue)        │
                        └────────────────────────────────┘
```

**Why these five and not others.** Each owns a different write pattern:
Identity is low-volume/high-security; Listing is low-volume/high-moderation;
Social is high-read/consumer-write; Messaging is realtime and bidirectional;
Commerce is money and must be auditable and idempotent. Those are genuinely
different reliability and consistency requirements, which is the only good
reason to draw a service boundary.

## Stack

| Layer | Choice | Reasoning |
|---|---|---|
| Business dashboard | Next.js (App Router) + TypeScript | Server components keep the heavy listing/analytics reads off the client; route handlers give you a BFF without a separate service |
| Consumer site/app | Separate app, same domain model | Different caching and scale profile; sharing a codebase couples release cycles |
| Styling | Tailwind + a real token layer | Tokens matter because the dashboard, the consumer page preview, and the mobile app must agree on what a business page looks like |
| Primary DB | PostgreSQL | Relational, has PostGIS for geo, `tsvector` for cheap text search, and row-level security if you want defense in depth |
| ORM / query | Drizzle or Prisma | Either; pick one and enforce migrations in CI |
| Cache / locks | Redis | Session lookup, rate limits, idempotency keys, hot listing reads |
| Search | OpenSearch / Elasticsearch | Business discovery, review full-text, dashboard filtering across large review sets |
| Analytics store | ClickHouse (or BigQuery) | Dashboard metrics are `GROUP BY day` over hundreds of millions of events; Postgres will not do this well |
| Object storage | S3 + CDN | Photos, videos, verification documents, invoice PDFs, CSV exports |
| Queue / jobs | BullMQ (Redis) or SQS + workers | Verification calls, moderation routing, digest emails, ad-spend rollups, export generation |
| Realtime | WebSocket service (or Pusher/Ably) | Inbox typing/delivery, live lead alerts |
| Payments | Stripe | Cards, ACH, invoicing, tax; Connect if you pay businesses out for deals/gift certificates |
| Telephony | Twilio | Verification calls and SMS, plus tracked/masked phone numbers for ad-call attribution |
| Email | Resend / SendGrid | Transactional, digests, and domain-based claim verification |
| Geo | PostGIS + a geocoder (Mapbox/Google) | Address normalization, map pin placement, service-area polygons |
| Feature flags | LaunchDarkly or a small in-house table | Every monetization surface needs to be rolled out by cohort |

## Cross-cutting decisions to make once, early

**1. Everything the business edits is versioned.** `business_edits` is an
append-only proposal log. The live listing is a materialized projection.
This gives you moderation, audit trail, rollback, and "who changed the hours"
for free — all of which you will be asked for.

**2. Every dashboard number has a single definition, stored in code.** Define
"page view", "customer lead", "call" once, in a shared metrics module used by
the dashboard, the exports, the ad reports, and the emails. Businesses compare
numbers across surfaces and file support tickets when they disagree.

**3. Idempotency on every mutating public/API endpoint.** Required for
billing, but adopt it everywhere — mobile clients retry.

**4. Multi-location is not a later feature.** Model `Organization → Location`
from the first migration even if the UI only ever shows one location at
launch. Collapsing a single-location model into a hierarchy later touches
every table and every permission check.

**5. Soft-delete and retention policy from day one.** Closed businesses,
deleted photos, and cancelled accounts all need to persist for dispute
resolution while disappearing from the consumer surface.

**6. The dashboard is read-heavy and latency-sensitive at the edges.** Cache
the listing projection aggressively; invalidate on publish. Analytics reads
are pre-aggregated into daily rollups — never query raw events from a
page-load path.

## Environments and delivery

- Trunk-based with short-lived branches; migrations forward-only and
  backwards-compatible for one release (expand/contract).
- Preview environments seeded with a realistic fixture business — a restaurant
  with 400 reviews, 2 open disputes, an active ad campaign, and an unread
  inbox. Most dashboard bugs only appear at realistic data volume.
- Contract tests between the dashboard BFF and each service.
- Synthetic monitoring on login, claim, and reply-to-review. Those three
  flows failing is what generates support load.
