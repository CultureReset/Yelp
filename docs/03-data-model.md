# 03 — Data Model

Postgres DDL sketches. Types are illustrative; indexes and constraints shown
where they carry a decision. `id` is `uuid` (v7 for time-ordering) throughout.

---

## Identity & org

```sql
create table users (
  id              uuid primary key,
  email           citext unique not null,
  email_verified_at timestamptz,
  password_hash   text,                    -- null for SSO-only accounts
  first_name      text not null,
  last_name       text not null,
  phone           text,
  phone_verified_at timestamptz,
  mfa_enforced    boolean not null default false,
  locale          text not null default 'en-US',
  status          text not null default 'active',  -- active|suspended|closed
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table auth_credentials (           -- passkeys, TOTP, oauth links
  id          uuid primary key,
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null,              -- totp|webauthn|oauth_google|oauth_apple
  secret_enc  bytea,                      -- envelope-encrypted via KMS
  public_key  bytea,
  provider_subject text,
  label       text,
  last_used_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (kind, provider_subject)
);

create table sessions (
  id            uuid primary key,
  user_id       uuid not null references users(id) on delete cascade,
  token_hash    bytea not null unique,     -- never store the raw token
  ip            inet, user_agent text, asn int, city text,
  mfa_satisfied_at timestamptz,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz
);

create table organizations (
  id            uuid primary key,
  name          text not null,
  kind          text not null default 'single',  -- single|multi|agency
  billing_customer_id text,                      -- Stripe customer
  created_at    timestamptz not null default now()
);

create table memberships (
  id            uuid primary key,
  user_id       uuid not null references users(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  role          text not null,             -- see 05-permissions.md
  location_scope uuid[] ,                  -- null = all locations in org
  invited_by    uuid references users(id),
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, org_id)
);
```

---

## The listing

The central object. Note the split: `businesses` holds *published* state,
`business_edits` holds proposals. Nothing writes to `businesses` except the
publish worker.

```sql
create table businesses (
  id              uuid primary key,
  org_id          uuid references organizations(id),   -- null while unclaimed
  slug            text unique not null,
  name            text not null,
  alias_names     text[],                  -- former names, for search recall
  status          text not null,           -- pending|published|closed|merged|removed
  merged_into     uuid references businesses(id),
  claim_status    text not null default 'unclaimed',
  claimed_at      timestamptz,

  -- location
  address1 text, address2 text, city text, state text,
  postal_code text, country char(2),
  geo             geography(point,4326),
  geo_precision   text,                    -- rooftop|interpolated|centroid
  is_service_area boolean not null default false,
  service_area    geography(multipolygon,4326),

  -- contact
  phone           text, phone_e164 text,
  website         text, website_domain text,

  -- classification
  price_tier      smallint check (price_tier between 1 and 4),
  year_established smallint,

  -- computed / denormalized
  rating_avg      numeric(2,1),
  review_count    int not null default 0,
  photo_count     int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on businesses using gist (geo);
create index on businesses (org_id) where org_id is not null;

create table business_categories (
  business_id uuid references businesses(id) on delete cascade,
  category_id uuid references categories(id),
  is_primary  boolean not null default false,
  primary key (business_id, category_id)
);

-- Attributes are key/value against a category-scoped schema, not columns.
-- A restaurant has "outdoor seating"; a plumber has "emergency service".
-- Adding an attribute must never require a migration.
create table attribute_defs (
  id           uuid primary key,
  key          text unique not null,       -- 'wifi', 'parking', 'accepts_crypto'
  label        text not null,
  value_type   text not null,              -- bool|enum|multi_enum|int|text
  enum_values  jsonb,
  applies_to   uuid[],                     -- category ids; null = universal
  consumer_filterable boolean not null default false
);

create table business_attributes (
  business_id  uuid references businesses(id) on delete cascade,
  attribute_id uuid references attribute_defs(id),
  value        jsonb not null,
  source       text not null default 'owner',  -- owner|user|partner|inferred
  primary key (business_id, attribute_id)
);

create table business_hours (
  id          uuid primary key,
  business_id uuid references businesses(id) on delete cascade,
  day_of_week smallint,                    -- 0-6, null for special dates
  special_date date,
  opens       time, closes time,
  is_closed   boolean not null default false,
  is_24h      boolean not null default false,
  label       text                          -- 'Happy hour', 'Kitchen'
);
-- Hours must support: multiple ranges per day (split shifts), overnight
-- ranges (closes < opens), holiday overrides, and "temporarily closed"
-- as a business-level status rather than 7 closed rows.
```

### The edit / moderation pattern

```sql
create table business_edits (
  id            uuid primary key,
  business_id   uuid not null references businesses(id) on delete cascade,
  submitted_by  uuid references users(id),
  source        text not null,             -- owner|consumer|partner|internal
  patch         jsonb not null,            -- RFC 7386 merge patch of proposed fields
  status        text not null default 'pending', -- pending|auto_approved|approved|rejected|superseded
  risk_score    numeric,
  reviewed_by   uuid references users(id),
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now()
);
create index on business_edits (business_id, created_at desc);
create index on business_edits (status) where status = 'pending';
```

Routing rules live in code, not the table: low-risk fields (description,
photos captions, specialties) from a trusted, verified owner auto-approve;
name, address, phone, website, and category changes always queue; anything
from a consumer queues. The published row is rebuilt by applying approved
patches in order, which means **the edit log is the source of truth and
`businesses` is a cache** — say that out loud in code review or someone will
write to it directly.

---

## Reviews & social

```sql
create table reviews (
  id            uuid primary key,
  business_id   uuid not null references businesses(id) on delete cascade,
  author_id     uuid not null,             -- consumer user
  rating        smallint not null check (rating between 1 and 5),
  body          text not null,
  language      text,
  visibility    text not null,             -- recommended|not_recommended|removed
  visibility_reason text,
  is_edited     boolean not null default false,
  created_at    timestamptz not null,
  updated_at    timestamptz
);
create index on reviews (business_id, created_at desc);
create index on reviews (business_id, rating);

create table review_replies (
  id          uuid primary key,
  review_id   uuid not null references reviews(id) on delete cascade,
  business_id uuid not null,
  author_id   uuid not null references users(id),   -- the business user
  body        text not null,
  visibility  text not null default 'public',       -- public|direct_message
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz
);

create table review_reports (
  id          uuid primary key,
  review_id   uuid not null references reviews(id),
  reported_by uuid not null references users(id),
  reason      text not null,   -- conflict_of_interest|not_a_customer|threat|
                               -- irrelevant|privacy|inappropriate|wrong_business
  detail      text,
  evidence_urls text[],
  status      text not null default 'open',  -- open|upheld|declined|appealed
  decided_at  timestamptz,
  decision_note text
);

create table media (
  id           uuid primary key,
  business_id  uuid not null references businesses(id) on delete cascade,
  uploader_id  uuid not null,
  source       text not null,             -- owner|consumer|partner
  kind         text not null,             -- photo|video
  storage_key  text not null,
  width int, height int, duration_ms int,
  caption      text,
  tags         text[],                    -- food|menu|interior|exterior|team
  is_cover     boolean not null default false,
  sort_order   int,
  moderation_status text not null default 'pending',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
```

---

## Messaging & leads

```sql
create table conversations (
  id            uuid primary key,
  business_id   uuid not null references businesses(id),
  consumer_id   uuid not null,
  kind          text not null,            -- quote_request|message|appointment
  project_id    uuid,                     -- groups a consumer's fan-out to many businesses
  status        text not null default 'open',  -- open|won|lost|closed|spam
  first_response_at timestamptz,
  last_message_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on conversations (business_id, last_message_at desc);

create table messages (
  id              uuid primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_type     text not null,          -- consumer|business|system
  sender_id       uuid,
  body            text,
  attachments     jsonb,
  is_automated    boolean not null default false,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create table quote_requests (              -- structured payload behind a lead
  conversation_id uuid primary key references conversations(id),
  answers         jsonb not null,          -- category-specific questionnaire
  budget_band     text,
  desired_date    date,
  location_text   text
);
```

Response rate and response time are computed from
`first_response_at - created_at`, aggregated over a trailing 30 days, and
displayed publicly. That makes them a *product surface*, not just a metric —
they need a clear, documented definition and an exclusion policy for spam
conversations.

---

## Commerce

```sql
create table programs (                    -- anything the business subscribes to
  id           uuid primary key,
  business_id  uuid not null references businesses(id),
  kind         text not null,              -- ads|upgrade_profile|remove_competitor_ads|
                                           -- verified_license|deals|reservations|waitlist
  status       text not null,              -- active|paused|pending|cancelled
  started_at   timestamptz, ended_at timestamptz,
  config       jsonb not null default '{}'
);

create table ad_campaigns (
  id            uuid primary key,
  program_id    uuid not null references programs(id) on delete cascade,
  business_id   uuid not null,
  objective     text not null,             -- calls|website|leads|visits
  budget_cents  int not null,
  budget_period text not null,             -- monthly|daily
  bid_strategy  text not null,             -- auto|manual_cpc
  max_cpc_cents int,
  geo_targets   jsonb,                     -- radius or named areas
  category_targets uuid[],
  keyword_targets  text[],
  negative_keywords text[],
  schedule      jsonb,                     -- dayparting
  creative      jsonb,                     -- photo id, custom text, CTA
  status        text not null,
  created_at    timestamptz not null default now()
);

create table ad_spend_daily (
  business_id uuid, campaign_id uuid, day date,
  impressions bigint, clicks bigint, leads bigint,
  spend_cents bigint,
  primary key (campaign_id, day)
);

create table invoices (
  id           uuid primary key,
  org_id       uuid not null references organizations(id),
  period_start date, period_end date,
  subtotal_cents bigint, tax_cents bigint, total_cents bigint,
  currency     char(3) not null default 'USD',
  status       text not null,              -- draft|open|paid|past_due|void|refunded
  provider_invoice_id text,
  pdf_key      text,
  issued_at timestamptz, due_at timestamptz, paid_at timestamptz
);

create table deals (
  id           uuid primary key,
  business_id  uuid not null references businesses(id),
  kind         text not null,              -- deal|gift_certificate|check_in_offer
  title        text not null, terms text not null,
  price_cents int, value_cents int,
  quantity_total int, quantity_sold int not null default 0,
  starts_at timestamptz, ends_at timestamptz,
  status text not null
);

create table deal_redemptions (
  id          uuid primary key,
  deal_id     uuid not null references deals(id),
  code        text unique not null,
  purchased_by uuid,
  purchased_at timestamptz,
  redeemed_at timestamptz,
  refunded_at timestamptz,
  payout_id   uuid
);
```

---

## Events & audit

```sql
-- Written to the event pipeline, landed in ClickHouse; mirrored here only
-- for the small set of events that need transactional consistency.
create table audit_log (
  id          uuid primary key,
  org_id      uuid, business_id uuid,
  actor_id    uuid, actor_type text,       -- user|system|support|partner
  action      text not null,               -- 'business.hours.updated'
  target_type text, target_id uuid,
  before      jsonb, after jsonb,
  ip inet, user_agent text,
  created_at  timestamptz not null default now()
);
create index on audit_log (business_id, created_at desc);
```

The audit log is not optional. Support cannot resolve "someone changed my
phone number" without it, and you cannot answer a data-subject access request
without it either.

---

## Multi-tenancy enforcement

Two layers, because one is not enough:

1. **Application layer** — every query goes through a repository that takes an
   `AuthContext { userId, orgId, businessIds, permissions }`. No raw queries
   in handlers.
2. **Database layer** — Postgres row-level security keyed on a session GUC
   (`set local app.org_id = ...`). This catches the query someone writes at
   2am that bypasses the repository.

Test it: a fixture suite that, for every table, attempts cross-org reads and
writes and asserts zero rows and a raised error.
