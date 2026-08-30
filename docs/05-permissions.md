# 05 — Roles & Permissions

## Roles

| Role | Intended for | Scope |
|---|---|---|
| **Owner** | The person who claimed the business / signed the contract | Org-wide, cannot be removed if last one |
| **Admin** | Operations manager, agency account lead | Org-wide |
| **Billing** | Bookkeeper, finance | Org-wide, billing only |
| **Location Manager** | Store/branch manager | Scoped to specific locations |
| **Marketing** | In-house or agency marketer | Scoped, no billing |
| **Responder** | Front-of-house staff, VA, answering service | Scoped, reviews + inbox only |
| **Analyst** | Read-only reporting | Scoped, read-only |
| **Support (internal)** | Platform staff, via impersonation | Time-boxed, fully audited |

## Matrix

`●` full · `◐` limited (see notes) · `·` none

| Capability | Owner | Admin | Billing | Loc. Mgr | Marketing | Responder | Analyst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| View dashboard | ● | ● | ◐ | ● | ● | ◐ | ● |
| Edit business info | ● | ● | · | ● | ◐ | · | · |
| Change name / address / phone | ● | ● | · | ◐ | · | · | · |
| Manage hours | ● | ● | · | ● | · | · | · |
| Upload / delete photos | ● | ● | · | ● | ● | · | · |
| Manage menu & services | ● | ● | · | ● | ● | · | · |
| Reply to reviews | ● | ● | · | ● | ● | ● | · |
| Report a review | ● | ● | · | ● | ● | ◐ | · |
| Read & reply to messages | ● | ● | · | ● | ● | ● | · |
| Change lead settings | ● | ● | · | ● | ● | · | · |
| Create / edit ad campaigns | ● | ● | · | ◐ | ● | · | · |
| Change budgets | ● | ● | ◐ | · | ◐ | · | · |
| Create deals / offers | ● | ● | · | ◐ | ● | · | · |
| View analytics | ● | ● | ◐ | ● | ● | · | ● |
| Export data | ● | ● | ◐ | ● | ● | · | ● |
| View invoices | ● | ● | ● | · | · | · | · |
| Manage payment methods | ● | ◐ | ● | · | · | · | · |
| Cancel programs | ● | ● | ◐ | · | · | · | · |
| Invite / remove users | ● | ● | · | ◐ | · | · | · |
| Change roles | ● | ◐ | · | · | · | · | · |
| Add / remove locations | ● | ● | · | · | · | · | · |
| Transfer ownership | ● | · | · | · | · | · | · |
| Close account | ● | · | · | · | · | · | · |

**Notes on `◐`**
- *Billing → view dashboard*: billing screens and invoice-linked analytics only.
- *Location Manager → name/address/phone*: may propose; requires Admin or Owner
  approval before it enters moderation. These fields are how account takeover
  becomes profitable, so they get an extra gate.
- *Location Manager → campaigns/deals*: may create and edit within a budget
  ceiling set by an Admin; cannot raise the ceiling.
- *Marketing → edit business info*: descriptive fields (description,
  specialties, attributes, highlights) but not identity fields.
- *Admin → payment methods*: can add, cannot delete the last one, cannot see
  full card details (nobody can — they live at the payment provider).
- *Admin → change roles*: can manage every role below Admin, cannot create
  another Owner.
- *Responder → report a review*: can file a report, cannot appeal a decision.

## Implementation

**Permissions are strings, roles are bundles.** Check
`can(ctx, 'review.reply', businessId)`, never `if (role === 'admin')`. Role
definitions change; call sites shouldn't.

```ts
type Permission =
  | 'business.read'      | 'business.edit'        | 'business.edit_identity'
  | 'hours.edit'         | 'media.write'          | 'menu.write'
  | 'review.reply'       | 'review.report'        | 'review.appeal'
  | 'inbox.read'         | 'inbox.write'          | 'inbox.settings'
  | 'ads.read'           | 'ads.write'            | 'ads.budget'
  | 'deals.write'        | 'analytics.read'       | 'analytics.export'
  | 'billing.read'       | 'billing.write'        | 'program.cancel'
  | 'users.read'         | 'users.write'          | 'users.roles'
  | 'org.locations'      | 'org.transfer'         | 'org.close';

interface AuthContext {
  userId: string;
  orgId: string;
  role: Role;
  locationScope: string[] | 'all';
  permissions: Set<Permission>;
  mfaSatisfiedAt: Date | null;
}
```

**Three enforcement layers, all required:**

1. **Route/handler guard** — declarative, colocated with the route. A route
   with no declared permission fails closed in CI via a lint rule.
2. **Repository layer** — every query takes the `AuthContext` and applies the
   org and location scope. No handler builds its own `where` clause.
3. **Row-level security in Postgres** — the backstop. Set the org on the
   connection per request; policies filter on it.

**Step-up authentication.** These actions require re-authentication within the
last 15 minutes regardless of role: adding/removing a payment method,
transferring ownership, removing a user, changing the business phone/address,
closing the account, generating an API key.

**Support impersonation** is a first-class, separate path:
- Requires a ticket reference and a stated reason.
- Time-boxed (max 60 minutes), auto-expiring.
- Read-only by default; write access requires a second approver.
- Banner visible to the agent at all times.
- Every action logged with both the agent and the impersonated user.
- The account owner gets an email afterwards saying what was accessed.

**Testing.** A permission matrix test that iterates every role × every
permission × in-scope/out-of-scope location, asserting against a table
checked into the repo. When someone changes a role definition, the test
diff shows exactly what they changed — which is the point.
