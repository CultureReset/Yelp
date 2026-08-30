# Shipping this to Google Play

The dashboard is a Progressive Web App. The route to Play is a **Trusted Web
Activity (TWA)** — Google's own supported way to publish a PWA. The Android
app is a thin shell that opens the site full-screen with no browser chrome;
there is no second codebase to maintain, and a web deploy updates the app
without a store review.

## What is already done here

- `src/app/manifest.ts` — web app manifest, standalone display, theme colour
- `public/sw.js` — offline shell, cache strategy, push notification handling
- `src/app/offline/page.tsx` — what people see with no signal
- `android/twa-manifest.json` — Bubblewrap configuration
- `public/.well-known/assetlinks.json` — Digital Asset Links, **fingerprints
  still to fill in**
- `android/store-listing.md` — the text and asset list Play asks for

## What only you can do

These need your accounts and your money, and I cannot do them for you:

1. **A Google Play Developer account** — US$25 once, at
   <https://play.google.com/console>. Identity verification takes a few days.
2. **A live HTTPS domain** serving the app, e.g. `biz.yourdomain.com`.
   Digital Asset Links will not verify against localhost.
3. **A signing key.** Keep it somewhere you will not lose it — losing it means
   you can never update the app under the same listing.

## Build steps, once you have those

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://biz.yourdomain.com/manifest.webmanifest

# Or reuse the config in this directory after changing `host` and `packageId`:
cp android/twa-manifest.json .
bubblewrap build          # produces app-release-bundle.aab and app-release-signed.apk
```

Then get your key's fingerprint and put it in `assetlinks.json`:

```bash
keytool -list -v -keystore android/keystore.jks -alias upload | grep SHA256
```

Deploy the site so `https://biz.yourdomain.com/.well-known/assetlinks.json`
returns that JSON, then verify:

```
https://developers.google.com/digital-asset-links/tools/generator
```

**Get this right or the app shows a browser address bar**, which is the single
most common TWA mistake. Play App Signing also re-signs your bundle, so once
the app is uploaded, add the fingerprint Play shows you as a *second* entry in
`assetlinks.json` and redeploy.

Finally, upload `app-release-bundle.aab` in the Play Console and fill in the
listing from `store-listing.md`.

## Why a TWA and not React Native

| | TWA | React Native |
|---|---|---|
| Codebases | One | Two |
| Ship an update | Deploy the web app | Store review each time |
| Native modules | Via plugins only | Full access |
| Cost to reach parity | Days | Months |

A React Native app is the right answer once you need something the web cannot
do — background location, deep OS integration, a widget. The four jobs owners
actually do on a phone (reply to a message, reply to a review, upload a photo,
check today's numbers) are all things a TWA does well.

## Honest limitations

- **Push notifications** work on Android through the service worker. On iOS
  they require the user to add the app to their home screen first, and Apple
  does not permit TWAs on the App Store at all — iOS needs a separate route.
- **Camera and photo picker** work through standard web file inputs, which is
  enough for photo upload but is not a native camera experience.
- **Play may reject a TWA that is "just a website"** with no offline handling
  or app-like behaviour. The service worker, the offline page, the standalone
  display, and the app shortcuts here are what answer that objection.
