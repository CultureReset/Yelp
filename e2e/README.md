# End-to-end checks

Browser-driven checks against a running server. They are not a substitute for
unit tests — they exist because the three flows below are the ones that
generate support load when they break.

```bash
npm run build && npx next start -p 3100 &
npm run db:seed
node e2e/flows.mjs         # reply persistence + edit routing
node e2e/permissions.mjs   # role scoping and denial pages
node e2e/screenshots.mjs   # desktop + mobile captures
```

## What `flows.mjs` proves

1. A published review reply survives a round trip.
2. A **descriptive** edit (specialties) auto-publishes.
3. An **identity** edit (phone) is held for moderation — and the published
   `businesses` row is left untouched. This is the core architectural claim
   from `docs/01-architecture.md`; if it regresses, the moderation pipeline
   is broken.

## What `permissions.mjs` proves

- A Responder sees only Home, Inbox, Reviews, Settings.
- An Owner sees all ten sections.
- Direct navigation to a forbidden route renders the no-access page rather
  than throwing.
