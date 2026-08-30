# 07 — Monetization & Billing

## Product catalog

| Product | Model | Notes |
|---|---|---|
| Ads (search + page placements) | CPC, monthly budget | The core revenue line |
| Enhanced profile | Monthly subscription | CTA button, slideshow, logo, highlights |
| Remove competitor ads | Monthly subscription | Usually bundled with the above |
| Verified license badge | Monthly or included | Requires document verification |
| Deals & gift certificates | Revenue share on redemption | Platform holds funds, pays out |
| Check-in offers | Free (engagement lever) | Drives consumer app usage |
| Reservations / waitlist | Per-cover fee or SaaS | Hardware/tablet component |
| Appointments | SaaS | |
| Job postings | Per-post or subscription | |
| Data/API access | Enterprise contract | Multi-location and agencies |

## Billing architecture

**Use a payment provider for money movement, own the entitlement ledger.**
Stripe (or equivalent) holds cards, runs SCA, issues invoices, handles tax.
Your system owns: what the business is entitled to, right now, and why.

```
programs (what they bought)  ──▶  entitlements (what's on)  ──▶  feature gates
      │                                    ▲
      ▼                                    │
usage/spend ledger  ──▶  invoice builder ──┴──▶ payment provider ──▶ webhooks
                                                                        │
                                                            reconcile & update state
```

**Non-negotiables:**

- **Idempotency keys on every write** that touches money. Retries are
  guaranteed — from mobile clients, from webhook redelivery, from your own
  workers.
- **The ledger is append-only.** Corrections are new entries, never updates.
- **Webhooks are the source of truth for payment state**, not the API response
  you got when you created the charge. Handle out-of-order and duplicate
  delivery; verify signatures; store the raw payload.
- **Currency in integer minor units.** Never floats, anywhere, ever.
- **Every entitlement change is dated and audited**, so "why was I charged"
  has a mechanical answer.

## Ad billing specifics

CPC billing is where correctness gets hard:

- **Click validity.** Filter duplicate clicks from the same session, bots, and
  self-clicks by the business's own team, *before* charging. Publish the
  policy.
- **Budget enforcement** is eventually consistent by nature — clicks arrive in
  a stream. Accept a small overage band, disclose it, and credit anything
  beyond it automatically rather than arguing per-ticket.
- **Pacing**: spread spend across the period rather than exhausting it on day
  three, and show the pacing curve in the dashboard.
- **Mid-cycle changes** (budget up/down, pause, cancel) prorate. Show the math
  before the user confirms.
- **Monthly close**: freeze the period, reconcile the spend ledger against the
  event rollups, generate the invoice, then charge. Never charge from a live
  aggregate.

## Deals, gift certificates & payouts

When the platform collects money on behalf of the business, you're a payment
facilitator, with the obligations that implies:

- Onboarding with KYC/KYB (Stripe Connect or equivalent handles this).
- Escrow between purchase and redemption; payout schedule (e.g. on redemption,
  or on a delay after purchase).
- Refunds: consumer-initiated within a window, business-initiated any time,
  with the revenue share reversed correctly.
- Expiry rules that comply with gift-card law — in many US states the value
  cannot expire even if the promotional value does. This is a real legal
  constraint, not a product preference. Model **face value** and **promotional
  value** as separate fields from day one.
- 1099/tax reporting for business payouts.

## Dunning & involuntary churn

Failed payments are a bigger revenue leak than voluntary cancellation.

- Retry schedule with backoff (day 1, 3, 5, 7), smart retry timing from the
  provider.
- Email + in-app + push at each stage, with a one-click update-card link.
- Grace period during which ads keep running, then pause (don't cancel).
- Card-expiry pre-warning at 30 and 7 days; automatic card-updater service.
- Never silently delete data on non-payment. Downgrade the entitlement,
  preserve the account.

## Cancellation

Self-serve, in the dashboard, with:
- What stops, and exactly when (immediately vs end of period).
- Prorated amounts, shown before confirming.
- A retention offer at most once, skippable in one click.
- A confirmation email with an effective date.
- The listing itself never disappears — it reverts to a free, claimed state.

Dark patterns here generate regulatory attention (US FTC "click to cancel"
style rules, EU consumer law) and are not worth the retained revenue.

## Fraud & risk

- Velocity checks on new accounts adding large budgets.
- Manual review threshold for first invoices above a limit.
- Chargeback handling with evidence assembly pulled automatically from the
  audit log, the ad report, and the signup record.
- Detect and block self-clicking on own ads.
