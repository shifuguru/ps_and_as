# Identity & Progression Platform

**Status:** Roadmap approved · **Implementation:** Not approved  
**Blocked by:** `rc-stability-exit` (see `roadmap.json` → `currentPhase`)  
**Epic:** `epic-identity-progression-platform`

## Why it exists

Remote players show empty profile popups because progression is **local-first** with optional cloud backup. Multiplayer syncs identity (`profileId`, name, `feltTint`) only — not XP or achievements. Ad-hoc `fetchCloudPlayerStats` calls in scoreboard/borders duplicate a pipeline the profile modal never uses.

## What it unlocks

- **PublicPlayerProfile** — single multiplayer-facing progression contract
- Remote profile viewing (achievements + XP in lobby and in-game modal)
- Guest-first identity with optional account linking
- Apple / Google Sign-In (post-RC)
- Server-derived public snapshots and authenticated progression writes
- Titles, cosmetics, ranked foundations — without redesigning sync later

## Constraints (non-negotiable)

| Rule | Detail |
|------|--------|
| **profileId** | Preserve `getOrCreatePlayerId()` as stable key; auth links in |
| **Multiplayer authority** | Progression is presentation + persistence only — never turn/card state |
| **Single contract** | `PublicPlayerProfile` on sockets, lobby, profile UI — no parallel GET pipelines |
| **No Phase A** | Modal-only cloud fetch rejected by Director |

## PublicPlayerProfile (v1 contract)

```typescript
type PublicPlayerProfile = {
  profileId: string;
  displayName: string;
  careerXp: number;
  roundsPlayed: number;
  tricksWon: number;
  unlockedAchievementIds: string[];
  achievementCount: number;
  featuredBorderId: string | null;
  timesPresident: number;
  bestPresidentStreak: number;
  level?: number;
  titleId?: string | null;
  rankTier?: string | null;
  cosmeticIds?: string[];
  profileUpdatedAt: number;
  profileSchemaVersion: 1;
  visibility: "public" | "private";
};
```

## Roadmap phases

| Phase ID | Name | Window | Depends on |
|----------|------|--------|------------|
| `identity-progression-foundation` | Foundation | v1.1.x post-RC | `rc-stability-exit` |
| `identity-guest-and-link` | Guest accounts & linking | v1.2.0 | foundation |
| `identity-oauth` | Apple & Google Sign-In | v1.2.x–v1.3.0 | guest-and-link |
| `progression-cloud-authority` | Cloud progression authority | v1.3.0 | foundation + oauth (recommended) |
| `progression-titles-cosmetics` | Titles & cosmetics | v1.3.x–v1.4.0 | cloud-authority (recommended) |
| `progression-ranked-foundation` | Ranked foundations | v1.4.0+ | cloud-authority |

## Phase 1 exit criteria (first implementation slice)

- `PublicPlayerProfile` schema + validator (client + server)
- Profile pushed on join/reconnect; included in `lobbyUpdate`
- Client session cache; modal + scoreboard + borders read cache (no duplicate GETs)
- `ARCHITECTURE_GAPS.md` XP persistence gap closed when shipped

## RC classification

| Work | RC-safe when unblocked? |
|------|-------------------------|
| Phase 1 Foundation | Yes — additive lobby fields, read-only UX |
| Guest / OAuth / cloud authority / cosmetics / ranked | Post-RC |

## Investigation references

- Remote profile investigation (2026-06): root cause = no socket profile + modal skips remote fetch
- Director approved roadmap integration (2026-06-19): planning only, no code

## Files (implementation — future)

| Layer | Paths |
|-------|-------|
| Contract | `src/profile/publicPlayerProfile.ts`, `server/publicProfile.js` |
| Server | `server/index.js`, `server/playerStatsStore.js` |
| Client cache | `src/profile/profileCache.ts` |
| UI | `LobbyPlayerModal.tsx`, `GameScreen.tsx` |
| **Do not touch for progression** | `core.ts`, turn ownership, `gameStateSync` |
