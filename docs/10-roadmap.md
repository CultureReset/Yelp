# 10 — Delivery Roadmap

Sequenced so that each phase ships something a real business can use, and so
that the expensive-to-retrofit decisions land first.

## Phase 0 — Foundations (weeks 1–4)

Nothing user-visible. Everything here is expensive to add later.

- Monorepo, CI, migrations with expand/contract discipline
- `users / organizations / memberships` and the `AuthContext` + `can()` layer
- Postgres RLS policies and the cross-tenant test suite
- `businesses` + `business_edits` with the publish worker — **direct writes to
  `businesses` blocked in code review from day one**
- Audit log, event collector, ClickHouse landing tables
- Design tokens and the component library shared with the consumer surface

**Exit criteria:** a cross-org read attempt fails at three independent layers.

## Phase 1 — Get in the door (weeks 5–10)

The minimum that makes the dashboard worth logging into.

- Signup, login, sessions, password reset, email verification
- MFA (TOTP + recovery codes)
- Claim flow: phone call + SMS + domain email verification
- Business Info editing for basics, location, contact, hours
- Reviews list + public reply
- Home screen with the attention row
- Transactional email

**Exit criteria:** an owner can claim a listing, fix their hours, and reply to
a review, all without support.

## Phase 2 — The daily loop (weeks 11–18)

- Photos & videos, with moderation
- Inbox: messages, quote requests, templates, auto-response, response metrics
- Notification system: preferences matrix, email + push
- Analytics v1: page views, customer actions, review trends, from daily rollups
- Team management: invites, roles, session revocation
- Mobile app v1 covering the four core jobs

**Exit criteria:** weekly active use by claimed businesses, driven by
notifications rather than habit.

## Phase 3 — Revenue (weeks 19–30)

- Stripe integration, entitlement ledger, invoices, dunning
- Ads: campaign creation, budget, targeting, creative, pacing, reporting
- Profile upgrades (CTA, slideshow, logo, highlights)
- Ad-to-invoice reconciliation job with variance alerting
- Self-serve cancellation
- Billing role and step-up auth

**Exit criteria:** the number in the ads report equals the number on the
invoice, verified nightly.

## Phase 4 — Depth & verticals (weeks 31–44)

- Menu / services / product catalog, with partner feeds and source authority
- Category-specific attribute schemas
- Deals, gift certificates, payouts, KYC
- Reservations / waitlist / appointments
- Review insights: topic extraction, benchmarks
- Portfolio and project galleries for service businesses
- Verified license and document verification

## Phase 5 — Scale customers (weeks 45–60)

- Multi-location UI: switcher, rollups, bulk edit, consolidated billing
- SAML/OIDC + SCIM
- Public API v1, webhooks, sandbox, client libraries
- Scheduled reports and BI exports
- Agency workspaces spanning organizations

## Continuous, from Phase 1 onward

- Moderation queues and internal support console (they can't lag the features
  they moderate)
- Accessibility audits each phase, not at the end
- Localization: externalize copy from the first commit, translate from Phase 3
- Load testing against realistic volumes — a business with 50k reviews and a
  location with 200 sibling locations

## Team shape

For a build of this scope, roughly: 2 backend (identity/listing), 2 backend
(commerce/messaging), 3 frontend, 1 data engineer, 1 mobile, 1 designer, 1 PM,
plus fractional trust-and-safety and legal. Under about eight engineers this
becomes a 2-year project rather than a 1-year one, mostly because the
moderation and billing surfaces are not parallelizable with the rest.

## What to cut if you must

In order of least damage:
1. Reservations/waitlist/appointments — real products in their own right
2. Deals and payouts — the compliance burden is disproportionate early
3. Public API — defer to Phase 5+, but keep it in the data model's shape
4. Multi-location UI — but *never* the multi-location data model
5. Benchmarks and topic extraction — high value, but additive

What you cannot cut: the edit/moderation pipeline, the audit log, the
permission layer, and ad-to-invoice reconciliation. Each of those is a rewrite
if it's added later.
