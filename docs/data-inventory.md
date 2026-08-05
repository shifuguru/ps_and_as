# Data inventory

Authoritative list of data Presidents & Assholes (Ps & As) collects, where it lives, and who can access it. Keep this file current when adding identity, storage, ads, billing, or third-party integrations.

Use this when filling the Google Play **Data safety** form and when updating `public/privacy.html`.

**Last reviewed:** 2026-08-05

## Summary

| Class | Examples | Sensitivity |
|-------|----------|-------------|
| Player identity | Device install ID, Android ID fallback, Game Center player ID, `google:{sub}` | Medium (stable identifiers) |
| Display profile | Display name (≤20 chars), appearance prefs, felt tint | Low–medium (name visible to tablemates) |
| Progression | XP, round stats, streaks | Low |
| Entitlements | Cloud `adsRemoved` | Low–medium (purchase state) |
| Session secrets | Seat `reconnectSecret`, Google session token (`psas1.*`) | High |
| Auth tokens | Google ID token (short-lived, client→server only) | High (ephemeral) |
| Optional email | Google account email inside session payload | Medium (PII) |
| Ads (web only) | AdSense cookies / advertising IDs via Google | Medium (third-party) |
| Usage analytics (first-party) | Allowlisted event names + limited numeric/boolean props; daily aggregates | Low (designed not to store names/emails) |

No payment card data is processed in our code. Web Remove Ads uses Stripe Checkout; Android Play Billing is not shipping yet.

## Client (device / browser)

| Data | Storage | Purpose | Retention |
|------|---------|---------|-----------|
| Install / device player ID | AsyncStorage | Offline & fallback identity | Until app data cleared / uninstall |
| Android ID (`hw-…`) | Derived via `expo-application` | Android fallback identity | Device lifetime / until reset |
| Linked Game Center ID | AsyncStorage | Stable iOS identity | Until unlink / clear |
| Display name | AsyncStorage | Shown in rooms & UI | Until changed / clear |
| Local XP & career stats | AsyncStorage | Progression when offline | Until clear; may merge with cloud |
| Theme / felt / sound prefs | AsyncStorage | UX preferences | Until changed / clear |
| Local `adsRemoved` cache | AsyncStorage | Instant ads UI after purchase | Until clear; re-synced from cloud |
| Ads consent (web) | AsyncStorage / local flags | Whether AdSense may load | Until changed / clear |
| Google session token | AsyncStorage (web) | Cloud stats sync without re-prompt | ~30 days or sign-out / clear |
| Lobby / reconnect session | AsyncStorage (room id, name, optional reconnect secret; short TTL) | Resume a table after refresh / brief disconnect | Until TTL expiry / clear |

## Game server (Railway)

| Data | Storage | Purpose | Access |
|------|---------|---------|--------|
| `player-stats.json` keyed by player ID | `server/data/` on disk | Cloud XP, stats, profile, `adsRemoved` | Server process; Railway operators with service access |
| In-memory rooms / hands | Process memory | Live multiplayer | Not persisted after room ends |
| Seat reconnect secrets | In-memory room state | Reclaim seat after disconnect | Server only; never broadcast |
| Google session HMAC secret | Env `GOOGLE_SESSION_SECRET` | Sign/verify `psas1.*` tokens | Railway env; not in client |
| Google OAuth client ID(s) | Env `GOOGLE_CLIENT_ID` / related | Verify ID tokens | Railway + public web client ID |
| Stripe webhook / checkout state | Stripe + server routes | Verify Remove Ads purchases | Stripe dashboard + Railway env |

**Note:** Without a Railway volume on `server/data`, redeploys can wipe `player-stats.json` (including entitlements).

## Third parties

| Vendor | Data shared | Why | Platforms |
|--------|-------------|-----|-----------|
| Apple Game Center | Player ID, display name (via Apple APIs on device) | iOS identity; name may be shown to other players | iOS |
| Google Sign-In | `sub`, optional email / name via ID token verify | Optional web account link for cloud stats | Web (Android native pending) |
| Google AdSense H5 | Advertising identifiers / cookies per Google policies | Interstitial + rewarded ads after consent | Web only |
| Stripe | Checkout session + player id metadata; payment details handled by Stripe Checkout | One-time Remove Ads purchase | Web only |
| GitHub Pages | Static app assets + privacy page | Host the web/PWA client | Web |
| Railway | Hosted game server + env + disk/volume | Authoritative multiplayer + stats API | All online clients |

**Note:** An optional in-app donate URL may still point at GitHub Sponsors in code, but monetization is ads + Remove Ads; do not feature Sponsors in the public privacy policy.

## What other players can see

In a shared room, seatmates typically see:

- Display name
- Shared table cues (e.g. felt tint on seats)
- Game actions, finish rank, and round XP for that round
- Last-place remaining cards at round end (game rule)

They do **not** receive other players’ full hands during play, reconnect secrets, Google emails, session tokens, purchase details, or career XP totals as a lobby field.

**Note for operators:** Settings currently shows Google link status and Level/XP, not a copyable raw player ID. Privacy deletion requests should ask for Google-linked email (if any) + display name.

## Google Play Data safety — quick map (Android build)

Declare only what the **Android app binary** actually does in the shipping build:

| Data type | Collected? | Shared? | Notes for this release |
|-----------|------------|---------|------------------------|
| App activity / gameplay | Yes (online rooms) | Yes (to tablemates as game events) | Required for multiplayer |
| Device or other IDs | Yes (install / Android ID fallback) | No (not sold) | Local identity; may sync as player key if cloud sync added later |
| Name | Yes (display name) | Yes (tablemates) | Player-chosen |
| Email | No (Android build) | No | Web Google link may receive email; not in first Android build |
| Purchase history | No (Android build) | No | Stripe is web-only; no Play Billing yet |
| Advertising ID | No (Android build) | No | No AdMob/AdSense in Android build |

Update this table when shipping Play Games, AdMob, or Play Billing.

## Public vs secret configuration

| Variable | Public? | Notes |
|----------|---------|-------|
| `EXPO_PUBLIC_SERVER_URL` | Yes (client) | Production socket/API base URL |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Yes (OAuth web client) | Expected to be public |
| `EXPO_PUBLIC_PRIVACY_URL` | Yes | Hosted privacy policy URL |
| `EXPO_PUBLIC_ADSENSE_CLIENT` | Yes | Web AdSense publisher id |
| `EXPO_PUBLIC_*` generally | Bundled into client | **Never** put private keys or HMAC secrets here |
| `GOOGLE_SESSION_SECRET` | No | Railway-only |
| Stripe secret / webhook secret | No | Railway-only |

## Deletion & retention

| Data | Default retention | Player deletion |
|------|-------------------|-----------------|
| Local AsyncStorage | Until device clear | Player clears site/app data |
| Cloud `player-stats` entry | Until deleted or store wiped | Request via privacy contact / [SECURITY.md](../SECURITY.md). Include Google-linked email (if any) and display name — **Settings does not currently show a raw player ID** |
| Live room state | Room lifetime | Automatic |
| Google session token | ≤ ~30 days | Expires; clearing local storage drops it |
| Stripe customer / payment records | Stripe retention | Via Stripe + deletion request to us for cloud entitlement |
