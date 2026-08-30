# 06 — Analytics

## Pipeline

```
consumer web/app  ──┐
business dashboard ─┼──▶ collector ──▶ Kafka/Kinesis ──▶ stream enrich ──▶ ClickHouse (raw)
partner callbacks ──┘      (edge)          │                  │                    │
                                           │                  │                    ▼
                                    dead-letter          bot/fraud            hourly + daily
                                       queue              filtering            rollup tables
                                                                                    │
                                                            ┌───────────────────────┤
                                                            ▼                       ▼
                                                    dashboard reads          exports, emails,
                                                    (rollups only)           billing reconcile
```

**Rules that keep this honest:**

- The dashboard **never** queries raw events. It reads pre-aggregated rollups
  keyed on `(business_id, day, dimension)`. A page load that scans raw events
  works fine on your test data and falls over on a business with a million
  monthly views.
- **Bot filtering happens before rollup**, and the filter version is stamped on
  each rollup row. When you improve the filter, you can explain why last
  month's numbers changed — and you will be asked to.
- Late events are accepted for 72 hours and trigger a rollup rebuild for the
  affected day. After that they're dropped and counted.
- Every rollup row carries `computed_at`. The UI shows freshness from it.

## Event taxonomy

Name events `object.action`, past tense, with a stable schema registry.

| Event | Key properties |
|---|---|
| `business_page.viewed` | surface (page/search/map), device, referrer_class, position |
| `business.call_clicked` | source, is_tracked_number |
| `business.directions_requested` | origin_distance_band |
| `business.website_clicked` | destination |
| `business.menu_viewed` | menu_source |
| `business.photo_viewed` | media_id, index |
| `business.bookmarked` / `.shared` | — |
| `message.started` / `.sent` | kind, is_automated |
| `quote_request.submitted` | project_id, fanout_size |
| `review.submitted` | rating, has_photos, visibility |
| `ad.impressed` / `.clicked` | campaign_id, placement, cpc_cents |
| `deal.purchased` / `.redeemed` | deal_id |
| `reservation.booked` / `.no_show` | party_size |

Business-side events (`dashboard.section_viewed`, `review.replied`,
`campaign.created`) go through the same pipeline. You need them to understand
activation and to run the product.

## Metric definitions — write these down once

These become tooltips, doc pages, and the shared `metrics` module.

- **Page view** — one render of the business page or a listing card
  impression *on the business page surface only*, excluding known bots and
  excluding views by users with a membership on that business.
- **Unique visitor** — distinct pseudonymous visitor id per day, per business.
- **Customer lead** — any of: call click, direction request, website click,
  message started, quote request, order click, reservation click. This is the
  headline number, so it must be defined precisely and never quietly changed.
- **Call** — a click on the phone CTA (not a completed call), unless a tracked
  number is in use, in which case a connected call over N seconds.
- **Response rate** — conversations with a business reply within 24h ÷ total
  eligible conversations, trailing 30 days, excluding conversations marked
  spam.
- **Response time** — median (not mean) of first-reply latency, trailing 30
  days.
- **Cost per lead** — ad spend ÷ leads attributed to ads in the same window,
  using last-click within a 7-day window.

**Attribution.** Pick a model, document it, and use the same one in the ads
report, the analytics screen, and the invoice. Last-click with a fixed lookback
is defensible and explainable; anything cleverer is unexplainable to a
restaurant owner at 11pm.

## Reconciliation

Ad clicks/spend shown in the dashboard must reconcile to the invoice. Run a
nightly job that compares `ad_spend_daily` against the billing ledger and
alerts on any variance over a threshold. Discrepancies here are the top driver
of chargebacks and churn.

## Benchmarks

Comparative metrics ("you're in the 70th percentile for photo views among
Italian restaurants in Austin") are the highest-value analytics feature and
the highest-risk. Guard rails: minimum cohort size before showing anything,
percentile bands rather than raw competitor values, no naming of specific
competitors, and no metric that could reveal an individual business's numbers.

## Exports & reporting

- CSV/XLSX export of any panel, generated async, delivered via a signed URL
  that expires. Never generate a large export in the request path.
- Scheduled email reports: weekly/monthly, per location or rolled up,
  configurable recipients.
- A read API for the same numbers (see [08](08-api-integrations.md)) —
  multi-location customers will pipe this into their own BI regardless, so
  make it supported rather than scraped.
