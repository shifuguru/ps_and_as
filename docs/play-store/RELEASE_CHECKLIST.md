# Google Play (Android) release checklist

Operator runbook for the first Play Console upload and each production Android cut after that.

**MVP scope for this pass:** free Android multiplayer client (no AdMob, no Play Billing, no Play Games). Web keeps AdSense + Stripe Remove Ads.

**Application ID:** `com.shifuguru.psandas`  
**Privacy policy URL:** https://shifuguru.github.io/ps_and_as/privacy.html  
**Production server:** `EXPO_PUBLIC_SERVER_URL` → Railway (`https://psandas-production.up.railway.app` in `eas.json` production profile)

---

## A. Repo readiness (agents / engineers)

- [x] Replace Expo placeholder package (`com.anonymous.*`) with `com.shifuguru.psandas`
- [x] Set `android.versionCode` (monotonic; currently `10142` for app version `1.1.42`)
- [x] Add `eas.json` with `preview` (APK) and `production` (AAB) profiles
- [x] Hosted privacy policy page + deploy copy into `web-build/privacy.html`
- [x] Data inventory for Data safety (`docs/data-inventory.md`)
- [x] Settings opens full privacy URL (native + web)
- [x] Bake production server + privacy URL into EAS production env
- [ ] Merge this branch and confirm Pages serves `/privacy.html`
- [ ] `npx eas-cli login` + `eas build:configure` once per Expo project (links Expo account)
- [ ] First successful `eas build --platform android --profile production`

Bump rules:

1. Bump `expo.version` / `package.json` version when shipping player-facing changes (normal web process).
2. Always increment `android.versionCode` before each Play upload (never reuse).
3. Keep production `EXPO_PUBLIC_SERVER_URL` pointed at Railway.

---

## B. Play Console (human)

### One-time

- [ ] Google Play Developer account enrolled
- [ ] Create app: **Ps & As** / Presidents & Assholes — package must match `com.shifuguru.psandas`
- [ ] App category: **Games → Card**
- [ ] Contact email for Play listing + privacy inquiries
- [ ] Privacy policy URL field → `https://shifuguru.github.io/ps_and_as/privacy.html`
- [ ] Complete **Data safety** using `docs/data-inventory.md` (Android column)
- [ ] Complete **Content rating** (IARC). Note adult-themed title; not Designed for Families
- [ ] Target audience / ads declaration: Android build has **no ads** in this release
- [ ] Upload store listing assets from [listing.md](./listing.md)
- [ ] Enable Play App Signing (EAS can generate/upload key)

### Each release

- [ ] `eas build --platform android --profile production`
- [ ] Upload AAB to **Internal testing** (or `eas submit --platform android --profile production`)
- [ ] Smoke test on a real device: cold start, Quick Game, online private room, reconnect
- [ ] Promote to closed / open testing when internal looks good
- [ ] Production rollout when ready

---

## C. Deferred (not this pass)

| Item | Why deferred |
|------|----------------|
| Google Play Games sign-in | Separate identity track; device ID works for MVP |
| AdMob + UMP on Android | Web ads already shipping; native is Phase 2 |
| Play Billing for Remove Ads | Web uses Stripe; entitlements need Play verification path |
| Feature graphic / screenshot photography polish | Listing draft text is ready; creative capture is manual |
| Full SOC 2 / Vanta | Not required for Play listing |

---

## D. Commands

```bash
# Preview APK for device sideload
npx eas-cli build --platform android --profile preview

# Production AAB for Play Console
npx eas-cli build --platform android --profile production

# Optional submit (requires Play service account linked in Expo)
npx eas-cli submit --platform android --profile production --latest
```

Credentials and service-account JSON stay outside git (Expo credentials service or local secrets).
