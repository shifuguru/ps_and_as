# Google Play store listing draft

Copy/paste into Play Console → Main store listing. Keep player language; avoid internal codenames.

**App name (30 chars max):** `Ps & As`  
**Package:** `com.shifuguru.psandas`

---

## Short description (80 chars max)

```
Race to empty your hand. Become President — or finish as the Asshole.
```

(72 characters)

---

## Full description

```
Presidents & Assholes is a fast multiplayer card game where everyone races to empty their hand.

Climb to President. Avoid finishing last as the Asshole. Rankings carry into the next round — the President gets an edge, and the Asshole pays up their best cards.

Play against AI for a quick round, or host a private online table with friends.

Features
• Classic Presidents / Asshole shedding rules
• Quick Game vs AI
• Private online rooms with reconnect
• Local career XP and achievements on your device
• Portrait-friendly phone play

This Android release is free to play. Ads and Remove Ads purchases are available on the web version today; they are not included in this Android build.

Privacy policy: https://shifuguru.github.io/ps_and_as/privacy.html
Play the web version: https://shifuguru.github.io/ps_and_as/
```

---

## Graphics checklist

| Asset | Spec | Source in repo |
|-------|------|----------------|
| App icon | 512×512 PNG | Export from `assets/icon.png` / adaptive icon |
| Feature graphic | 1024×500 | **Not in repo yet** — create from felt + logo |
| Phone screenshots | ≥2, up to 8 | Capture from device/emulator: Home, Quick Game, rankings |
| Tablet screenshots | Optional | Capture if supporting large screens |

Suggested screenshot set:

1. Home / Player Hub with brand title
2. In-round table (felt + hand)
3. Rankings / President–Asshole result
4. Private lobby / Find Game (if space)

---

## Categorization & policies (suggested answers)

| Field | Suggestion |
|-------|------------|
| Category | Games → Card |
| Tags | Multiplayer, Offline, Casual |
| Contains ads | **No** (Android build) |
| In-app purchases | **No** (Android build) |
| Target age | 13+ / general audience (adult-themed name; not for Families) |
| Privacy policy | https://shifuguru.github.io/ps_and_as/privacy.html |

When AdMob or Play Billing ships, update this file, Data safety, and the Play Console declarations in the same release.
