# 04 — The Dashboard, Section by Section

## Global shell

Persistent across every screen:

- **Location switcher** (top-left). Shows current location; searchable dropdown
  for multi-location orgs; "All locations" aggregate mode for orgs with more
  than one. Every subsequent screen respects this scope.
- **Primary nav**: Home · Inbox · Reviews · Photos · Business Info · Menu &
  Services · Programs · Analytics · Billing · Settings.
- **Notification bell** — unread count, grouped by type, deep-links into
  context. Never a dead-end toast.
- **"View my public page"** — opens the consumer-facing page in a new tab.
  Non-negotiable. The single most common owner question is "how does this look
  to customers," and every edit screen should offer a preview of the affected
  slot.
- **Account menu** — user profile, switch organization, help, sign out.
- **Impersonation banner** when a support agent is acting on behalf of an
  account. Loud, colored, always visible, with the agent's identity.

Empty, loading, and error states are specified per section below only where
they differ from the default (skeleton → content, retry on error).

---

## 1. Home / Overview

The landing screen. Job: tell the owner what needs attention today, in under
five seconds.

**Slots, in order:**

1. **Header** — business name, avg rating, review count, claim/verification
   badge, public page link.
2. **Attention row** — cards that only appear when actionable:
   unreplied reviews (count, oldest age), unread leads, expiring payment
   method, campaign out of budget, pending moderation on an edit, incomplete
   profile. Each with a one-click destination. If nothing is actionable, this
   row collapses rather than showing "0" tiles.
3. **Snapshot metrics** — last 30 days vs previous 30: page views, customer
   leads, calls, direction requests, website clicks. Each with a sparkline and
   a delta chip (up/down/flat, colored semantically, never accent-colored).
4. **Recent activity feed** — reviews, photos added by users, questions,
   check-ins, messages, ad milestones. Reverse chronological, filterable by
   type, paginated.
5. **Profile completeness** — a scored checklist (hours, photos, description,
   categories, attributes, menu/services, response settings). Show the score's
   *reason*, not just a percentage, and link each item to its editor.
6. **Recommendations / upsell** — at most one, dismissible, clearly labeled as
   a paid product. Cramming this screen with ad upsells is the fastest way to
   make owners distrust the dashboard.

---

## 2. Inbox (Leads, Quotes & Messages)

For service businesses this *is* the product. Treat it like a real messaging
client, not a form log.

**Layout:** three-pane — conversation list, thread, context sidebar.

**Conversation list**
- Filters: unread, unanswered, status (open/won/lost/closed), kind (quote
  request / message / appointment), date range, assigned user.
- Sort: most recent, oldest unanswered.
- Row: consumer name + avatar, snippet, timestamp, unread dot, status chip,
  project badge if the consumer fanned out to multiple businesses.
- Bulk actions: mark read, archive, mark spam.

**Thread**
- Full message history including system events ("Quote request sent to 5
  businesses", "Consumer viewed your reply").
- Composer: rich-ish text, attachments (images, PDF quotes), **quote
  templates** with variable substitution, canned responses, and a quoted-price
  block (amount, unit, validity window) that renders as structured data.
- Send-and-status: delivered/read receipts where the consumer permits.
- Actions: mark won/lost (feeds attribution reporting), block/report user,
  request a review — **gated by policy**; see [09](09-trust-moderation.md).

**Context sidebar**
- Structured quote-request answers (the category questionnaire).
- Consumer's stated location, desired date, budget band.
- Their prior interactions with this business.
- Response-time stats for this business, so the owner sees the consequence of
  delay.

**Settings owned by this section**
- Auto-response on/off, message text, and delay.
- Business hours-aware auto-reply ("We're closed, we'll respond at 9am").
- Which team members receive lead notifications, per channel.
- Lead preferences: categories, service radius, job types, budget floor.
- Away mode with an end date.

**Public consequence:** response rate and response time badges render on the
consumer page. Surface the current values here, with the definition and the
trailing window stated in plain language.

---

## 3. Reviews

**List view**
- Filters: rating (1–5, multi-select), date range, replied/unreplied,
  reported status, keyword search, source (organic / post-transaction),
  language, and **recommended vs not-recommended**.
- Sort: newest, oldest, highest, lowest, most helpful.
- Each row: reviewer name/avatar/tenure, rating stars, date, body (truncated
  with expand), photos attached, helpful/funny/cool counts, existing reply,
  status chips.

**Per-review actions**
- **Public reply.** One reply per review, editable, with edit history visible
  to no one but showing "edited" publicly. Character limit. Preview before
  publish. Draft autosave — owners write long replies and lose them.
- **Direct message the reviewer.** Private, opens a conversation.
- **Report the review** with a reason taxonomy (conflict of interest, not a
  customer, personal attack, privacy violation, irrelevant, wrong business,
  inappropriate content) plus evidence upload. Shows status and outcome, and
  supports one appeal.
- **Share** — generate an image/link for social, with attribution.

**Insights sub-tab**
- Rating distribution and rating trend over time.
- Volume by week/month.
- Topic extraction: recurring phrases grouped into themes (service, wait time,
  price, cleanliness) with sentiment per theme and trend arrows. This is the
  single most valuable non-obvious feature on the reviews screen.
- Comparison against category and geographic benchmarks.
- Reply coverage: what share of reviews got a reply, and median time to reply.

**Hard product rules to encode in the UI, not just the policy page**
- The business cannot delete or edit a review.
- The business cannot pay to suppress a review, and the UI should never imply
  otherwise.
- Soliciting reviews — especially selectively soliciting positive ones — must
  be explicitly governed. Whatever policy you choose, the dashboard must state
  it at the point of action, or you will be building a review-gating machine by
  accident.

---

## 4. Photos & Videos

- **Grid** with source filter: *your* media vs *customer* media. These are
  governed differently and must never be visually merged.
- Upload: drag-drop, multi-file, progress, client-side downscale, EXIF strip
  (privacy — EXIF carries GPS), format/size validation, virus scan on the
  worker side.
- Per-item: caption, tags/category (food, drink, menu, interior, exterior,
  team, work samples), alt text (accessibility *and* SEO), reorder by drag,
  set as cover photo, delete (owner media only), report (customer media only).
- **Video**: length cap, transcode ladder, poster-frame selection, captions
  upload.
- Bulk: select, tag, delete, reorder.
- **Portfolio / project galleries** for service businesses: a named project
  with before/after images, description, cost band, duration, and location —
  a distinct object from loose photos.
- Moderation state visible per item ("In review", "Rejected — reason").
- Guidance panel: what makes a good cover photo, minimum resolution, what
  gets rejected.

---

## 5. Business Information

The densest screen. Group into cards, save per card, show a live preview of
the affected slot on the public page, and flag which fields will require
moderation *before* the user submits.

**Basics**
- Business name (moderated; explain naming rules inline — no taglines,
  no keyword stuffing)
- Also-known-as / former name
- Primary category + up to N secondary categories (searchable taxonomy)
- Price tier ($–$$$$)
- Year established
- Short description / "About the business"
- Specialties, History, Owner bio + owner photo
- Languages spoken

**Location**
- Street address with autocomplete and normalization
- Suite/floor, cross streets, neighborhood (derived, overridable)
- **Map pin adjustment** — geocoders get storefronts wrong constantly; let the
  owner drag the pin, and store `geo_precision` accordingly
- "I don't have a storefront" → switches to **service area**: radius or a set
  of cities/postal codes, with a map preview
- Parking and transit notes, accessibility entrance details

**Contact**
- Public phone (validated, E.164) and an optional second/text line
- **Tracked call number** if ads are active — explain that calls route through
  a measurement number and still ring the same phone
- Website, plus dedicated links: menu, online ordering, reservations,
  appointment booking, gift cards
- Public email
- Social profiles

**Hours**
- Per-day ranges, multiple ranges per day (split shifts), overnight ranges
- "Open 24 hours", "Closed"
- Named hour sets (dining room vs kitchen vs happy hour vs delivery)
- **Special hours** for specific dates, with a holiday calendar prompt
- **Temporarily closed** with an expected reopen date
- **Permanently closed** — a distinct, confirmed, hard-to-reach action that
  also stops billing
- Timezone, derived from address, overridable

**Attributes / amenities**
Category-driven, from `attribute_defs`. The set differs entirely by vertical:
- *Restaurants*: takeout, delivery, reservations, outdoor/rooftop seating,
  wifi, TV, alcohol, happy hour, noise level, ambience, good for groups/kids,
  dogs allowed, parking type, waiter service, catering, dietary options
  (vegan, vegetarian, gluten-free, halal, kosher)
- *Home services*: emergency availability, free estimates, warranty, licensed,
  bonded, insured, years in business, service radius, satisfaction guarantee
- *Health/beauty*: accepts insurance, by-appointment-only, walk-ins, gender of
  provider, telehealth
- *Universal*: payment methods accepted, wheelchair accessibility, gender-
  neutral restrooms, staff-owned/identity attributes (opt-in, self-declared),
  open to all
Group them, make them searchable, and mark which ones consumers can filter on
— that's the owner's incentive to fill them in.

**Verification & trust**
- Claim/verification status and badge
- Professional license number, issuing state, expiry, verification status
- Insurance/bonding documents
- Health inspection score (integrated from municipal feeds where available)
- Business certifications and identity attributes

**Change management**
- Every card shows last-edited-by and when.
- Pending edits render inline as "Submitted — in review", with the proposed
  value and a cancel action.
- Consumer-submitted corrections that conflict with owner data surface here
  for confirm/reject, rather than silently overwriting.

---

## 6. Menu, Products & Services

- **Services list** — name, description, price or price band, duration,
  category. Feeds quote-request matching and consumer filtering.
- **Menu** — sections → items → name, description, price, photo, dietary tags,
  availability window, options/modifiers. Support three sources: manual entry,
  file/URL import, and a partner feed (POS integration) with a clear indicator
  of which is authoritative so manual edits aren't silently overwritten.
- **Popular items** — derived from consumer engagement, not owner-set.
- **Product catalog** for retail: SKU, price, availability, images.
- **Ordering integration** — link or embedded partner checkout, with fee
  disclosure.

---

## 7. Programs (Advertising, Upgrades & Tools)

A catalog screen plus a management screen per active program.

**Yelp-style Ads**
- Create: objective (calls / clicks / leads / visits), budget with a monthly
  and daily view, bid strategy (automatic or manual CPC), geographic targeting
  (radius or named areas, with reach estimate), category and keyword targeting
  plus negative keywords, dayparting schedule, creative (photo, custom text,
  call-to-action button), landing destination.
- Manage: pause/resume, edit budget mid-cycle with a prorated explanation,
  duplicate a campaign, end a campaign.
- Report: impressions, clicks, CTR, average CPC, spend, leads, cost per lead,
  and lead breakdown by type — daily granularity, date-range comparison,
  export.
- **Budget pacing** display: spent-to-date, projected, and days remaining.
  Owners cancel when they're surprised by a bill; pacing prevents the surprise.

**Profile upgrades**
- Call-to-action button (choose action + destination)
- Photo slideshow / hero video
- Logo
- Business highlights (a bounded set of badges: family-owned, years in
  business, free consultations, emergency service, locally sourced)
- **Remove competitor ads** from your page
- Verified license badge

**Growth tools**
- **Deals & gift certificates** — create, set discount and quantity, terms,
  validity window, redemption tracking, payout schedule, refund handling
- **Check-in offers / loyalty** — reward, frequency cap, redemption flow
- **Posts / updates** — short business updates with photo, pushed to followers
- **Reservations & waitlist** — table inventory, floor plan, party sizes,
  covers, seating duration, notifications to guests, no-show tracking, host
  view for a tablet
- **Appointments** — bookable service list, staff calendars, availability
  rules, buffers, deposits, reminders, cancellation policy
- **Job postings** — role, description, pay band, applications inbox
- **Nearby/adjacent lead programs** — opt-in categories, radius, spend cap

Every paid program needs the same four things: a clear price, a clear
cancellation path, a clear performance report, and a receipt. If any is
missing, expect chargebacks.

---

## 8. Analytics

Definitions live in one module and are surfaced as tooltips everywhere. See
[06 — Analytics](06-analytics.md) for the pipeline.

**Global controls:** date range with comparison period, location scope,
granularity (day/week/month), export to CSV, scheduled email reports.

**Panels**
- **Page views** — total, unique, by device, by surface (search results vs
  business page vs map), by source (organic search on-platform, external
  search engines, ads, direct).
- **Customer actions** (the money metrics) — calls, direction requests,
  website clicks, messages/quote requests, menu views, photo views, bookmarks,
  shares, check-ins, order/reservation clicks. Each over time, each with a
  conversion rate against page views.
- **Search terms** — what consumers searched before landing here, and where
  the business ranked. Careful: this can leak competitive data; aggregate and
  threshold it.
- **Reviews** — volume, average rating, distribution, all trended.
- **Photos** — views, engagement, which photo performs.
- **Leads** — volume, response rate, response time, won/lost, cost per lead
  when ads are running.
- **Ad performance** — as above, reconciled to the invoice. The number here
  and the number on the bill must match or you will lose the customer.
- **Benchmarks** — versus category average in the same metro, shown as a
  percentile band rather than naming competitors.
- **Multi-location rollup** — a table of all locations with the key metrics,
  sortable, with per-location drill-down and a "worst performers" view.

**Rules**
- Never show a metric without its definition and its window.
- Show data-freshness ("through yesterday, 11pm PT"). Analytics lag is fine;
  unexplained analytics lag generates tickets.
- Suppress small numbers rather than showing noisy percentages.

---

## 9. Billing

- Current balance, next charge date, and what will be charged.
- Payment methods: add/remove/set default, card and ACH, 3DS/SCA support,
  expiry warnings well before failure.
- Invoice history: downloadable PDF, line items per program, per location,
  taxes broken out, credits and refunds visible.
- Statements for multi-location: consolidated invoice with a per-location
  breakdown, and the ability to bill locations separately.
- Spend controls: monthly cap, alert thresholds.
- Promo codes and credits, with expiry.
- Dunning: a clear, non-punitive failed-payment flow — retry schedule, grace
  period, what pauses and when.
- Cancellation: self-serve, with the effective date, what stops immediately vs
  at period end, and a confirmation email. Making cancellation hard is both a
  legal exposure and a support cost.
- Tax documents and W-9/payout details where the platform pays the business
  (deals, gift certificates).

---

## 10. Settings

- **Profile** — name, email (re-verification on change), phone, photo, locale,
  timezone.
- **Security** — password, MFA enrollment, passkeys, recovery codes, active
  sessions with revoke, recent security events.
- **Users & permissions** — invite, list, change role, scope to locations,
  remove, transfer ownership, pending invites.
- **Notifications** — a matrix of event type × channel (email, push, SMS,
  in-app): new review, low-rating review, new lead, unanswered lead reminder,
  new photo from a customer, question asked, ad budget events, payment events,
  moderation outcomes, weekly digest. Per-user, not per-business.
- **Organization** — legal name, billing address, tax ID, locations list,
  add/remove location, transfer a location to another org.
- **Integrations** — connected apps, API keys, webhooks, POS/booking/CRM
  connections, disconnect with a clear statement of what stops syncing.
- **Data & privacy** — export your data, deletion request, consent settings,
  who at the platform can access the account.
- **Close account** — with consequences stated: the listing does not
  disappear, it reverts to unclaimed.

---

## Mobile app parity

The business mobile app is not a shrunk-down dashboard. Owners use it for four
things, and those four must be excellent: **push notification → reply to a
message**, **reply to a review**, **upload a photo**, and **check today's
numbers**. Everything else can defer to the web.

Push notifications need per-type controls, a quiet-hours setting, and
deep-linking that survives a cold start.

---

## Accessibility & internationalization

Not a section — a constraint on all of the above.

- Keyboard-operable everywhere, visible focus, correct roles and labels; the
  review reply composer and the photo grid are the usual failures.
- Color never the sole carrier of meaning (rating, status chips, deltas).
- All copy externalized; no concatenated sentences.
- Addresses, phone numbers, currency, dates, and hours are all locale- and
  region-specific. Hours especially: not every market uses a 7-day week
  layout, and 24-hour time is the default in most of the world.
