# Play Store listing

Copy ready to paste into the Play Console, plus the assets it will ask for.

## App details

**App name** (30 char max)
```
Business Dashboard
```

**Short description** (80 char max — this is what shows in search results)
```
Reply to reviews, answer customers, and see what brings people in.
```

**Full description** (4000 char max)
```
Run your business listing from your phone.

REPLY TO REVIEWS
Read every review as it arrives and reply publicly, or message the customer
privately. Long replies save as drafts, so you never lose one halfway through.

ANSWER CUSTOMERS FAST
Quote requests and messages land in one inbox. Save templates for the
questions you get every week. Your response time shows on your public page, so
answering quickly is the clearest lever you have.

KEEP YOUR DETAILS RIGHT
Hours, phone, website, menu, services, photos. The things customers check
before deciding. Split shifts and holiday hours are handled properly.

SEE WHAT IS WORKING
Page views, calls, direction requests, website clicks, and where visitors came
from. Every number states exactly what it counts.

MANAGE YOUR TEAM
Give staff the access they need and nothing more. A front-of-house account can
answer messages without seeing your billing.

MULTIPLE LOCATIONS
Switch between locations, or see them together.

WHAT THIS APP WILL NOT DO
It will not let you delete a review. Customers write those, and businesses
cannot edit or remove them. Advertising changes where your ads appear — it
does not change your star rating, which reviews are shown, or where you rank
in ordinary search results. We would rather say that plainly than have you
find out later.

Free to claim and manage your business. Advertising and profile upgrades are
optional, priced before you commit, and cancellable from the app.
```

## Graphics required

| Asset | Size | Notes |
|---|---|---|
| App icon | 512 × 512 PNG | 32-bit, no alpha, no rounded corners — Play masks it |
| Feature graphic | 1024 × 500 PNG | Shown at the top of the listing |
| Phone screenshots | min 2, max 8 | 1080 × 1920 or similar 16:9 |
| Tablet screenshots | optional | Only if you declare tablet support |

Use these screens, in this order — they answer "what will I actually do with
this" in the first two thumbnails:

1. Home with the attention row — "36 reviews without a reply"
2. Reviews with the composer open
3. Inbox conversation with the quote request sidebar
4. Analytics with the customer actions table
5. Business info showing a pending edit in review

## Data safety form

Play asks you to declare all of this. Answer it accurately — a mismatch
between the form and what the app does is a common cause of rejection.

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| Name, email | Yes | No | Account management |
| Phone number | Optional | No | Account recovery, verification |
| Business address | Yes | Yes, publicly | It is a public listing |
| Photos | Yes | Yes, publicly | Business photos on the listing |
| Payment info | Via processor | No | Handled by the payment provider, not stored here |
| App interactions | Yes | No | Analytics and product improvement |
| Crash logs | Yes | No | Diagnostics |

- Data is encrypted in transit: **yes**
- Users can request deletion: **yes** — Settings → Data & privacy
- Committed to the Play Families policy: only if you target under-13s, which
  this does not

## Content rating

Answer the questionnaire honestly. A business tools app with user-generated
content (reviews, photos) typically rates **Everyone** or **Teen** depending
on whether you moderate before or after publication.

Declare **user-generated content** and be ready to describe your moderation:
reporting flow, review queues, and turnaround. Play asks about this now and
rejects apps that cannot answer.

## Category and contact

- **Category**: Business
- **Tags**: business tools, reviews, small business
- **Website, email, and privacy policy URL** are all required. The privacy
  policy must be publicly reachable *before* you submit — Play checks it.

## Before you submit

- [ ] `assetlinks.json` live and verified, including the Play App Signing
      fingerprint, or the app opens with a browser address bar
- [ ] Privacy policy and terms published at real URLs
- [ ] Tested on a physical Android device, not only an emulator
- [ ] Offline behaviour checked with the network off
- [ ] Screenshots taken at the right resolution
- [ ] Internal testing track first, production second
