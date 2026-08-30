# Yelp for Business — Rebuild Blueprint

A complete build specification for the **business side** of a Yelp-class local
commerce platform: the login and account-claiming process, and every section,
slot, and control of the business owner dashboard.

This repository is the design record. It answers two questions:

1. **What does the business side actually contain?** Every screen, every field,
   every state — enumerated rather than gestured at.
2. **How would you build it?** Architecture, data model, permission model,
   pipelines, and a phased delivery plan.

## Read in this order

| Doc | What it covers |
|---|---|
| [01 — Architecture](docs/01-architecture.md) | System shape, stack, services, why each piece exists |
| [02 — Identity, auth & claiming](docs/02-identity-auth-claiming.md) | Signup, login, 2FA, the claim/verification state machine |
| [03 — Data model](docs/03-data-model.md) | Core tables, relationships, the draft/publish pattern |
| [04 — Dashboard sections](docs/04-dashboard-sections.md) | The dashboard itself, section by section, field by field |
| [05 — Roles & permissions](docs/05-permissions.md) | Who can do what, and how it's enforced |
| [06 — Analytics](docs/06-analytics.md) | Event pipeline, metrics definitions, reporting surfaces |
| [07 — Monetization & billing](docs/07-monetization-billing.md) | Ads, upgrades, deals, invoicing, payment lifecycle |
| [08 — Public API & integrations](docs/08-api-integrations.md) | Partner API, webhooks, POS/booking/review sync |
| [09 — Trust, moderation & compliance](docs/09-trust-moderation.md) | Review integrity, edit moderation, appeals, privacy |
| [10 — Delivery roadmap](docs/10-roadmap.md) | What to build in what order, and what "done" means |

## The one-paragraph version

A business owner signs up for an account, **claims** a listing that already
exists in the consumer-facing directory (or creates a new one), and proves
they control it. Claiming grants their account a **membership** on that
location, with a role. From there the dashboard is a set of tools over a
single object — the business listing — plus the streams attached to it:
reviews, messages, photos, analytics events, and paid programs. Almost every
hard problem in the build is a consequence of one fact: **the business does
not own its own page.** Consumers write the reviews, upload most of the
photos, and the platform arbitrates. The dashboard is a *negotiated* editing
surface, not a CMS.

That distinction drives the architecture. See
[01 — Architecture](docs/01-architecture.md).

---

## Running the app

The blueprint above is now backed by a working application.

```bash
# 1. Postgres (any instance — local, Supabase, Neon, RDS)
cp .env.local.example .env.local     # then point DATABASE_URL at your database

npm install
npm run db:push                      # create the 49 tables
npm run db:seed                      # a realistic business to work against

npm run dev                          # http://localhost:3000
```

**Seeded sign-ins**

| Email | Password | Role | Sees |
|---|---|---|---|
| `owner@rosastaqueria.com` | `CorrectHorseBattery1` | Owner | All ten sections, both locations |
| `front@rosastaqueria.com` | `CorrectHorseBattery1` | Responder | Home, Inbox, Reviews, Settings — one location |

Signing in as both is the fastest way to see the permission layer working.

## What is built

| Area | State |
|---|---|
| Database schema (49 tables) | Complete — identity, listing, edits, social, messaging, commerce, audit |
| Permission layer | Complete — 7 roles, 27 permissions, location scoping, step-up auth, 10 unit tests |
| Signup / login / sessions / reset | Working — Argon2id, breach check, opaque server-side sessions, rate limiting with backoff |
| Dashboard shell | Working — location switcher, permission-filtered nav, notifications, public-page link |
| Home | Working — attention row, 30-day snapshot with sparklines, activity feed, profile strength |
| Reviews | Working — filters, distribution, reply coverage, publish/edit replies, draft autosave, reporting |
| Business info | Working — card editing through the edit/moderation pipeline, pending-edit list, hours display |
| Analytics | Rollup pipeline and metric definitions built; panels partially wired |
| Inbox, Photos, Menu, Programs, Billing, Settings | Specified and routed; slot-level scaffolds pending implementation |

Each scaffolded section lists its slots with build status, so the gap between
the specification and the implementation is visible in the product rather than
tracked separately.

## The architectural rule, enforced

`src/lib/listing/publish.ts` is the only writer to the published `businesses`
row. Everything else submits a proposal to `business_edits`, and
`src/lib/listing/routing.ts` decides whether it publishes immediately or waits
for a moderator. `e2e/flows.mjs` asserts this: a phone-number change is held
while a description change goes live.

## Tests

```bash
npm run typecheck   # strict TypeScript, zero errors
npm test            # permission matrix unit tests
node e2e/flows.mjs  # see e2e/README.md
```
