# 09 — Trust, Moderation & Compliance

The business dashboard is where platform policy meets the person it constrains.
Most of the hard product decisions on a review platform show up here.

## Review integrity

**Recommendation / filtering.** Not every review should carry equal weight. A
software system decides which reviews are shown prominently and which are
demoted to a "not currently recommended" set, based on reviewer history,
review quality, and solicitation signals. Design implications for the
dashboard:

- Show the business *both* sets, clearly labeled, with an honest explanation.
- Never let the business influence the classification — not by paying, not by
  asking support. This must be architecturally true, not just a policy, or it
  leaks and becomes a scandal.
- Explain it in plain language at the point of confusion, which is when a
  glowing review the owner expected doesn't appear.

**Review solicitation policy.** Decide, and enforce in the product:
- Is asking for reviews allowed at all?
- Is asking *selectively* (only happy customers) allowed? Review-gating is
  banned by the FTC in the US and by comparable rules elsewhere.
- Are incentives allowed? Almost universally: no.
Whatever you decide, the "request a review" button in the inbox must reflect
it, and the policy must be one click away from that button.

**Compensated and fake review detection**
- Signals: reviewer account age, review velocity, device/IP clustering, text
  similarity, rating distribution anomalies, sudden bursts after a support
  contact.
- Consequences: review removal, a public consumer alert on the business page,
  suspension of paid programs, account termination.
- A **consumer alert** posted on a business page is the most severe visible
  action. It needs an internal review process, an appeal path, and a defined
  duration — and the business needs to see it and its reason in the dashboard,
  not discover it from a customer.

## Review reports and appeals

Business-facing flow:
1. Report with a reason from a fixed taxonomy + free text + evidence.
2. Status visible in the dashboard: received → under review → decided.
3. Decision with a stated reason, not a form letter.
4. One appeal, reviewed by a different person or a higher tier.
5. SLA published and measured. Owners tolerate "no" much better than silence.

Never let paid status affect moderation outcomes or queue priority. Log the
account's spend tier alongside every decision *so you can audit that it
doesn't* — that's the only way to prove it.

## Business-information moderation

Routing rules for `business_edits`:

| Field class | Route |
|---|---|
| Description, specialties, history, attributes, captions | Auto-approve for verified owners; sampled audit |
| Photos, video | Automated classification (nudity, violence, off-topic, text-heavy) → human on low confidence |
| Hours, links, menu, services | Auto-approve, with anomaly detection (e.g. all hours set to closed) |
| Name, address, phone, website, categories | Always human review |
| Anything within 30 days of a claim or ownership change | Always human review |
| Anything from a consumer | Always human review, with owner notification |

Give the owner: status per pending edit, the reason for any rejection, an
appeal, and the ability to cancel a pending edit.

## Duplicate and closed listings

- Duplicate detection on create: normalized name similarity + geo distance +
  phone match + website domain match. Present suspected duplicates *to the
  user during the flow* rather than creating and merging later.
- Merges are one-way with a permanent redirect and a preserved audit trail;
  reviews from both listings combine, and that must be reversible for 30 days.
- "Permanently closed" needs corroboration — an owner action plus a signal, or
  a human check. A malicious close-report on a competitor is a known attack.

## Privacy & data protection

- **Lawful basis and consent**: separate consent for marketing from acceptance
  of terms. Store consent with timestamp, version, and source.
- **DSARs**: access, portability, correction, and deletion, for business users
  as data subjects. Build the export as a real feature — it also serves
  enterprise customers.
- **Deletion vs retention**: deletion requests must propagate to the warehouse,
  backups (documented lag), search index, and the CDN. Financial records are
  retained under a separate legal basis; say so.
- **Verification documents** (licenses, utility bills, IDs) are the most
  sensitive data you hold. Encrypt at rest with a separate key, restrict access
  to a named role, log every read, and delete on a short schedule after the
  verification decision.
- **EXIF stripping** on every uploaded photo. Business photos taken at an
  owner's home leak their home address otherwise.
- **Tracked phone numbers** used for ad attribution record call metadata; that
  needs disclosure, and call recording (if you ever do it) needs jurisdiction-
  aware two-party consent.
- **Data residency** if you operate in the EU: plan for it before you have EU
  customers, not after.

## Accessibility as compliance

The dashboard is a commercial service; in the US, ADA Title III claims against
web interfaces are common, and in the EU the Accessibility Act applies. Target
WCAG 2.2 AA, test with real assistive tech, and keep an accessibility
statement current.

## Advertising disclosure

- Ads must be visibly labeled as ads on the consumer surface.
- The dashboard must not claim or imply that paying improves organic ranking or
  review outcomes. Review your ad-sales copy for this specifically — it is the
  most common source of regulatory and class-action exposure for local
  platforms.
- Pricing, billing model, and cancellation terms disclosed before purchase,
  not buried in terms.

## Internal tooling you must build alongside the dashboard

Easy to defer, painful to lack:
- Moderation queues with SLA tracking and reviewer quality sampling.
- A support console with scoped, audited impersonation.
- A dispute-resolution workbench that surfaces the claim evidence file.
- Trust-and-safety dashboards for detection-signal drift.
- A policy-decision log, so the same case gets the same answer twice.
