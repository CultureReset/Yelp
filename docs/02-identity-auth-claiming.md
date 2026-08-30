# 02 — Identity, Authentication & Claiming

The business side has **three separate concepts** that beginners collapse into
one, then spend a year untangling:

| Concept | What it is |
|---|---|
| **User account** | A person. Has an email, a password/passkey, sessions, MFA. |
| **Organization** | A billing and ownership container. Owns one or many locations. |
| **Membership** | The edge between a user and an org/location, carrying a **role**. |

A person can belong to several organizations (an agency managing 40
restaurants). An organization can have many people. A location belongs to
exactly one organization at a time, and moving it between orgs is an explicit,
audited transfer — that's how you handle a business being sold.

---

## 1. Entry points

There are four ways a person arrives at the business login, and each needs its
own copy and its own outcome:

1. **"Claim your business"** — the listing exists in the directory. Most common.
2. **"Add your business"** — no listing exists. Creates a listing *and* claims it.
3. **Invited teammate** — an existing org invited them by email.
4. **Returning user** — plain login.

Do not force all four through the same funnel. A user who already has a
listing and hits "add your business" must be caught by duplicate detection
before they create a second listing — duplicate listings are one of the
hardest data problems on a local platform to unwind.

---

## 2. Signup

**Fields:** first name, last name, email, password, business name/search,
and an explicit checkbox for terms + marketing consent (separate checkboxes —
bundling them breaks consent law in several jurisdictions).

**Rules:**
- Email is the identity key, lowercased and normalized. Store the raw form too.
- Passwords: minimum 12 characters, checked against a breached-password list
  (k-anonymity range query against HIBP or a local bloom filter). Do not
  impose composition rules — they reduce entropy in practice.
- Hash with Argon2id (or bcrypt cost ≥ 12 if you must). Never SHA-anything.
- Email verification required before any *publishing* action, but let the user
  browse the dashboard in a read-only state first. Blocking on email
  verification at the door tanks activation.
- Rate limit signup per IP and per email domain; a captcha (Turnstile) only
  after a suspicion threshold, not on every attempt.

**Social/SSO:** Google and Apple at minimum. Apple is required if you ship an
iOS app that offers any other social login. Link by verified email; if the
email matches an existing password account, require the password once before
merging, or you have an account takeover vector.

**Enterprise SSO (SAML/OIDC):** needed sooner than you'd think — multi-location
brands and agencies ask for it. Model it as an org-level setting with domain
capture, and support SCIM provisioning for the same customers.

---

## 3. Login

**Standard flow**
1. Email → password (or passkey).
2. If MFA enrolled → second factor.
3. Device check: unrecognized device/IP-ASN → email notification, and
   optionally step-up verification.
4. Session issued.

**Session design**
- Opaque session token in an `HttpOnly; Secure; SameSite=Lax` cookie, stored
  server-side in Redis with a Postgres backstop. Not a stateless JWT — you
  need instant revocation when a teammate is removed.
- Absolute lifetime 30 days, idle timeout 14 days, re-auth (password prompt)
  required for: changing password/email, adding a payment method, removing a
  user, transferring a location, deleting the account.
- Track per-session: device fingerprint, user agent, IP, ASN, city, created,
  last seen. Surface this list in settings with individual and global revoke.
- CSRF: double-submit token on all state-changing requests, plus `SameSite`.

**Passwordless / magic link.** Worth offering; small business owners forget
passwords at a high rate. Single-use, 10-minute expiry, invalidated on use,
bound to the requesting browser via a paired cookie so a forwarded email
can't be used elsewhere.

**MFA**
- TOTP (RFC 6238) and WebAuthn/passkeys. SMS as a fallback only, clearly
  marked as weaker.
- 10 single-use recovery codes, shown once, stored hashed.
- **Enforce MFA for any user with billing or user-management permission.**
  That's where the money and the account-takeover risk live.

**Account recovery** is the real attack surface, not login.
- Reset link: single-use, 30-minute expiry, invalidates all sessions on use.
- Never reveal whether an email exists ("If that address has an account,
  we've sent a link").
- If MFA is enrolled and recovery codes are lost, route to **manual
  verification with a human**, not to an automated bypass. An automated MFA
  bypass makes MFA decorative.
- On password change, email the user, keep the current session, kill the rest.

**Rate limiting & abuse**
- Per-account exponential backoff after 5 failures; per-IP sliding window;
  global anomaly detection on credential-stuffing patterns (many accounts, one
  IP, one attempt each — the per-account limiter will never see it).
- Log every auth event to an append-only `auth_events` table: type, result,
  IP, UA, geo. This is both a security tool and a support tool.

---

## 4. Claiming — the state machine

Claiming is the highest-stakes flow on the business side. A successful attack
gives someone control of a stranger's storefront: hours, phone number,
website, and the ability to reply to customers in their name.

```
                  ┌───────────┐
                  │ UNCLAIMED │
                  └─────┬─────┘
                        │ owner starts claim
                        ▼
                ┌───────────────┐
                │ CLAIM_STARTED │──── abandoned (7d) ──▶ EXPIRED
                └───────┬───────┘
                        │ choose verification method
                        ▼
             ┌────────────────────┐
             │ VERIFICATION_SENT  │◀── retry (max 3/24h)
             └───────┬────────────┘
              code ok│         │ code fails ×5 / method exhausted
                     ▼         ▼
              ┌───────────┐  ┌──────────────┐
              │ VERIFIED  │  │ MANUAL_REVIEW│── docs uploaded ──┐
              └─────┬─────┘  └──────┬───────┘                   │
                    │               │ rejected                  │
                    │               ▼                           │
                    │          ┌─────────┐                      │
                    │          │ DENIED  │                      │
                    │          └─────────┘                      │
                    ▼                                           │
              ┌──────────┐◀──────────────────────────────────────┘
              │ CLAIMED  │  (membership created, role = OWNER)
              └────┬─────┘
                   │ another party disputes
                   ▼
            ┌───────────────┐
            │  DISPUTED     │ ── resolution ──▶ CLAIMED (either party)
            └───────────────┘
```

**Verification methods**, in descending order of strength:

| Method | How it works | Notes |
|---|---|---|
| **Automated phone call** | Robocall to the *listing's* published number, reads a 6-digit code | Strongest cheap signal — proves control of the number already public on the page |
| **SMS** | To the listing's number, if mobile | Same idea, weaker (portability/SIM swap) |
| **Email at business domain** | Only if the email domain matches the listing's website domain | Strong, but only works for businesses with a real site |
| **Postcard** | Mailed code to the listing address, 5–10 days | Slow but proves physical presence; keep it for high-risk cases |
| **Document review** | Business license, utility bill, tax doc, storefront photo | Human review; needed for new/edge cases |
| **Existing partner integration** | POS/booking provider vouches | Best conversion for chains |

Critical rule: **verification must target the contact details already on the
listing**, not details the claimant supplies. A claimant who can change the
phone number and then verify against it has verified nothing.

**Additional controls**
- Cool-down: a location that changed hands cannot be re-claimed for N days
  without manual review.
- Any change to the listing's phone, address, or website within 30 days of a
  claim goes to moderation regardless of the account's normal trust level.
- Notify the *previous* owner's email on any successful re-claim, with a
  one-click dispute link.
- All verification attempts, methods, codes (hashed), and outcomes recorded in
  `claim_attempts` — this is the evidence file when a dispute reaches a human.

**"Add a business"** (no listing exists) is claiming with the verification
order reversed: create the listing in a `PENDING` state, run duplicate
detection (name + geo distance + phone + normalized URL), verify, then publish
to the directory. Never let an unverified new listing appear publicly — that's
a spam vector.

---

## 5. Team & access management

Once claimed, the org owner can invite people.

- Invite by email with a role and an optional location scope.
- Invite token: single-use, 7-day expiry, bound to the invited email address.
- Accepting an invite while logged into a different account must prompt, not
  silently attach to the wrong user.
- Removing a user immediately revokes their sessions **and** their outstanding
  invites, and reassigns nothing — orphaned drafts stay with the org.
- The last remaining Owner cannot remove themselves or downgrade their role;
  force an explicit ownership transfer.
- Every membership change is written to the audit log with actor, target,
  before/after role, and IP.

Roles and the full permission matrix: see
[05 — Roles & permissions](05-permissions.md).

---

## 6. What "done" looks like for this area

- [ ] Signup, login, logout, reset, email change, all with verification
- [ ] TOTP + WebAuthn + recovery codes; enforced for billing/admin roles
- [ ] Session list with per-device revoke; global "sign out everywhere"
- [ ] Google + Apple OAuth with safe account linking
- [ ] SAML/OIDC + SCIM behind a flag for enterprise orgs
- [ ] Claim flow with phone, SMS, domain-email, postcard, and document paths
- [ ] Dispute intake and resolution tooling for the internal support team
- [ ] `auth_events` and `claim_attempts` audit tables, queryable by support
- [ ] Rate limits at account, IP, and global-anomaly levels
- [ ] Synthetic monitors on login and claim, alerting on failure-rate deltas
