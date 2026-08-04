# Data inventory

Authoritative list of data Presidents & Assholes (Ps & As) collects, where it lives, and who can access it. Keep this file current when adding identity, storage, or third-party integrations.

**Last reviewed:** 2026-08-04

## Summary

| Class | Examples | Sensitivity |
|-------|----------|-------------|
| Player identity | Device install ID, Game Center player ID, `google:{sub}` | Medium (stable identifiers) |
| Display profile | Display name (≤20 chars), appearance prefs, felt tint | Low–medium (name visible to tablemates) |
| Progression | XP, round stats, streaks | Low |
| Session secrets | Seat `reconnectSecret`, Google session token (`psas1.*`) | High |
| Auth tokens | Google ID token (short-lived, client→server only) | High (ephemeral) |
| Optional email | Google account email inside session payload | Medium (PII) |

No payment card data is processed in-app. Donations go to external GitHub Sponsors.

## Client (device / browser)

| Data | Storage | Purpose | Retention |
|------|---------|---------|-----------|
| Install / device player ID | AsyncStorage | Offline & fallback identity | Until app data cleared / uninstall |
| Linked Game Center ID | AsyncStorage | Stable iOS identity | Until unlink / clear |
| Display name | AsyncStorage | Shown in rooms & UI | Until changed / clear |
| Local XP & career stats | AsyncStorage | Progression when offline | Until clear; may merge with cloud |
| Theme / felt / sound prefs | AsyncStorage | UX preferences | Until changed / clear |
| Google session token | AsyncStorage (web) | Cloud stats sync without re-prompt | ~30 days or sign-out / clear |
| Lobby / room session | In-memory (+ limited prefs) | Multiplayer session | Session / reconnect window |

## Game server (Railway)

| Data | Storage | Purpose | Access |
|------|---------|---------|--------|
| `player-stats.json` keyed by player ID | `server/data/` on disk | Cloud XP, stats, profile | Server process; Railway operators with service access |
| In-memory rooms / hands | Process memory | Live multiplayer | Not persisted after room ends |
| Seat reconnect secrets | In-memory room state | Reclaim seat after disconnect | Server only; never broadcast |
| Google session HMAC secret | Env `GOOGLE_SESSION_SECRET` | Sign/verify `psas1.*` tokens | Railway env; not in client |
| Google OAuth client ID(s) | Env `GOOGLE_CLIENT_ID` / related | Verify ID tokens | Railway + public web client ID |

**Note:** Without a Railway volume on `server/data`, redeploys can wipe `player-stats.json`. See [ops-persistence.md](./ops-persistence.md).

## Third parties

| Vendor | Data shared | Why |
|--------|-------------|-----|
| Apple Game Center | Player ID, display name (via Apple APIs on device) | iOS identity; name may be shown to other players |
| Google Sign-In | `sub`, optional email / name via ID token verify | Optional web account link for cloud stats |
| GitHub Pages | Static app assets only | Host the web/PWA client |
| Railway | Hosted game server + env + disk/volume | Authoritative multiplayer + stats API |
| GitHub Sponsors | Handled entirely by GitHub | Voluntary donations (no card data in our code) |

## What other players can see

In a shared room, seatmates typically see:

- Display name
- Public profile / progression hints the UI shows (e.g. level)
- Game actions and finish rank

They do **not** receive other players’ full hands (server enforces per-recipient views), reconnect secrets, Google emails, or session tokens.

## Public vs secret configuration

| Variable | Public? | Notes |
|----------|---------|-------|
| `EXPO_PUBLIC_SERVER_URL` | Yes (client) | Production socket/API base URL |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Yes (OAuth web client) | Expected to be public |
| `EXPO_PUBLIC_*` generally | Bundled into client | **Never** put private keys or HMAC secrets here |
| `GOOGLE_SESSION_SECRET` | No | Railway-only; rotate on schedule / after suspected leak |
| `GOOGLE_CLIENT_ID` (server) | Semi-public ID | Server allow-list for token audience |

## Deletion & retention

| Data | Default retention | Player deletion |
|------|-------------------|-----------------|
| Local AsyncStorage | Until device clear | Player clears site/app data |
| Cloud `player-stats` entry | Until deleted or store wiped | Request via [SECURITY.md](../SECURITY.md) with player ID (`google:…`, Game Center, or device id) |
| Live room state | Room lifetime | Automatic |
| Google session token | ≤ ~30 days | Expires; clearing local storage drops it |
| Server logs | Hosting provider defaults | No intentional long-term PII log store; avoid logging emails/tokens |

Operators: use [scripts/delete-player-stats.js](../scripts/delete-player-stats.js) after verifying the request.
