# On Top! — Release Status Audit

**Production baseline:** v1.0.60 @ `249eabb8298333e24f53578e54f7d45dffa5c7bd`  
**HEAD:** same commit (in sync with production client)  
**Audit date:** 2026-06-08

---

## Bug descriptions

### A — Already fixed in production (v1.0.60)

| Issue | Status |
|-------|--------|
| On Top! rules missing or wrong (run beat, 10-rule on-top, skip ends trick) | **Shipped** — core engine since v1.0.29+; architecture in `GAME_ARCHITECTURE.md` §3 |
| Trick win display / next lead after on-top | **Shipped** — v1.0.48 (`3be78a7`) |
| 10 Lower on-top count validation | **Shipped** — v1.0.51 (`383dfb0`) |
| Pre-commit 10 flow (choose Higher/Lower before cards land) | **Shipped** — v1.0.58 (`c82ad46`) |
| `resolveEffectiveTenRule` during active `runOnTop` beat | **Shipped** — v1.0.58 (`c82ad46`) |
| “On top!” table pill flash | **Shipped** — `GameTable.tsx` + What's New v1.0.11 lineage |
| CPU/offline sim stalling on prior passers during on-top | **Shipped** — v1.0.58 offline-round-sim `preprocessTurn` + `GameScreen` offline effect |

### B — Open in production (fix exists uncommitted)

| Issue | Symptom | Root cause (working tree) |
|-------|---------|---------------------------|
| **B1 — Direction stripped after sync** | After online reconnect/sync, pile is uniform 10s but on-top never grants or legal on-top plays reject | HEAD `resolveEffectiveTenRule` only recovers direction when `runOnTop.active`; `isOnTopEligiblePile` requires `tenRule.direction` set |
| **B2 — Leader blocked on on-top beat** | Trick winner who passed earlier in the trick cannot Pass/Play on “On top!” | HEAD `handlePlayPress` / `handlePassPress` reject `hasPassedInCurrentTrick` without `!humanRunOnTopTurn` |
| **B3 — Client turn identity drift** | On-top UI/turn hints misaligned with authoritative turn | HEAD `runOnTopActive` compares `runOnTop.playerIndex` to `displayTurnIndex` not `currentPlayerIndex` |
| **B4 — Server “Not your turn” on on-top** | Online pass/play rejected during on-top beat when `currentPlayerIndex` ≠ `runOnTop.playerIndex` | No server-side run-on-top turn realignment in HEAD |

---

## Commits associated with On Top!

| Commit | Version | On Top! relevance |
|--------|---------|-------------------|
| `45cfb38` | pre-1.0 | Add on top! rules, fresh round, trick/trade fixes |
| `ee78740` | — | Correct on top! rules; What's New |
| `3be78a7` | v1.0.48 | Fix on top! trick win display and next lead |
| `2003d46` | v1.0.29 | On-top 10 fix, compact layout |
| `383dfb0` | v1.0.51 | 10 Lower count fix (on-top validation) |
| `8fd5590` | v1.0.50 | Turn timing / play flights (on-top presentation) |
| `c82ad46` | v1.0.58 | **Major:** `resolveEffectiveTenRule`, pre-commit 10, offline sim on-top preprocess, `test-core` on-top suite |
| `249eabb` | v1.0.59 | Adds `onTopDiagnostics.ts`; ceremony finalize (orthogonal to on-top rules) |

No commits after `249eabb` touch On Top! (uncommitted working tree only).

---

## Files, tests, and diagnostics

### Core rules & validation

| File | Role | Production v1.0.60 | HEAD | Working tree |
|------|------|--------------------|------|--------------|
| `src/game/core.ts` | `resolveEffectiveTenRule`, `isOnTopEligiblePile`, `grantRunOnTopBeat`, `playCards`/`passTurn` on-top guards | ✅ shipped | ✅ same | **+16 lines** — B1 fixes (direction recovery, `resolveEffectiveTenRule` at grant sites) |
| `src/game/onTopDiagnostics.ts` | Dev-only `[ON-TOP-DIAG]` logging; `diagnoseTenRuleOnTopRejection` | ✅ shipped | ✅ added `249eabb` | unchanged |

### Client pass/play guards & UI

| File | Role | Production v1.0.60 | HEAD | Working tree |
|------|------|--------------------|------|--------------|
| `src/screens/GameScreen.tsx` | `humanRunOnTopTurn`, offline `isRunOnTopTurn`, pre-commit 10, pass/play handlers | ✅ partial | ✅ partial | **+374 lines mixed** — **B2/B3** guards (`!humanRunOnTopTurn` on pass/play/select); also Cluster A + unrelated (see `RC_1_0_61_EXCLUDED.md`) |
| `src/components/GameTable.tsx` | “On top!” pill flash animation | ✅ shipped | ✅ same | cosmetic layout only (not on-top logic) |

### Server

| File | Role | Production v1.0.60 | HEAD | Working tree |
|------|------|--------------------|------|--------------|
| `server/index.js` | Authoritative pass/play | ✅ no on-top special case | ✅ same | **+8 lines** — **B4** `runOnTopTurn` index sync + turn guard |
| `server/botHostedRooms.js` | Bot pass/play planning | ✅ `runOnTopTurn` in bot logic | ✅ same | bot delay jitter only (unrelated) |

### Automated tests (in repo)

| File | Coverage | Production v1.0.60 | HEAD | Working tree |
|------|----------|--------------------|------|--------------|
| `scripts/test-core.ts` | On-top grant, 10-rule on-top plays, pass-on-top clears trick, `resolveEffectiveTenRule` | ✅ | ✅ blocks from ~L1155, ~L2414 | **+137 lines** — **B1** “direction strip / recoverable” cases (~L2520+) |
| `scripts/test-edge-cases.ts` | `runOnTopTurn` pass guard | ✅ | ✅ | unchanged |
| `scripts/test-multiplayer-matrix.mjs` | `runOnTop` in turn planning | ✅ | ✅ | unchanged |
| `scripts/release-gate/offline-round-sim.mjs` | `preprocessTurn` skips prior passers unless on-top | ✅ | ✅ v1.0.58 | unchanged |
| `scripts/release-gate/multiplayer-4client-chaos.mjs` | `resolveEffectiveTenRule` + `runOnTop` in chaos sim | ✅ | ✅ | unchanged |
| `scripts/release-gate/bare-turn-sim.mjs` | Turn sim `runOnTop` flag | ✅ | ✅ | unchanged |
| `scripts/release-gate/private-room-reconnect-gate.mjs` | `runOnTop` in reconnect planning | ✅ | ✅ | unchanged |

### Diagnostics & investigation (not in production bundle)

| File | Role | Production v1.0.60 | HEAD | Working tree |
|------|------|--------------------|------|--------------|
| `src/game/onTopDiagnostics.ts` | Structured dev logs (`EXPO_PUBLIC_ON_TOP_DIAG=1`) | ✅ | ✅ | unchanged |
| `scripts/investigate-play-stack.mjs` | Play-stack / on-top path explorer | ❌ | ❌ | **untracked** |
| `scripts/explore-gameplay-edge.mjs` | Edge exploration using `resolveEffectiveTenRule` | ❌ | ❌ | **untracked** |
| `scripts/release-gate/offline-seed-42003-min-repro.mjs` | Seed repro sim | ❌ | ❌ | **untracked** |
| `src/utils/multiplayerPresentationVerify.ts` | Client presentation verify incl. `runOnTopActive` | ❌ | ❌ | **untracked** |
| `TURN_OWNERSHIP_INVESTIGATION.md` | Notes prior-passer vs run-on-top stall | doc | doc | modified |

### Docs / product copy

| File | Notes |
|------|-------|
| `GAME_ARCHITECTURE.md` | Authoritative On Top! design (§3) |
| `src/screens/updateLogContent.ts` | Player-facing on-top changelog entries (v1.0.11, v1.0.48, etc.) |

---

## Implementation status

| Workstream | Implemented | In production | In working tree only |
|------------|-------------|---------------|----------------------|
| On Top! core rules (`grantRunOnTopBeat`, eligibility, validation) | ✅ | ✅ | — |
| `resolveEffectiveTenRule` (basic) | ✅ | ✅ | — |
| `onTopDiagnostics.ts` | ✅ | ✅ | — |
| Pre-commit 10 + atomic `playCards` options | ✅ | ✅ | — |
| Offline/CPU on-top turn preprocess | ✅ | ✅ | — |
| `test-core` on-top regression (higher/lower 10) | ✅ | ✅ | — |
| **B1** Direction recovery when `tenRule.direction` stripped | ✅ code | ❌ | `core.ts` diff |
| **B2** Pass/play guards for leader on on-top beat | ✅ code | ❌ partial (UI only) | `GameScreen.tsx` diff |
| **B3** `runOnTopActive` vs `currentPlayerIndex` | ✅ code | ❌ | `GameScreen.tsx` diff |
| **B4** Server run-on-top turn alignment | ✅ code | ❌ | `server/index.js` diff |
| **B1 tests** direction-strip recovery | ✅ code | ❌ | `test-core.ts` diff |
| Investigation scripts | ✅ local | ❌ | untracked |

---

## Deployed status

| Layer | v1.0.60 (live) | Notes |
|-------|----------------|-------|
| **Client** (`249eabb`) | On Top! rules + UI pill + partial guards | Bugs **B2–B3** reproducible in online/private play |
| **Server** (production host) | Same generation as shipped client unless manually updated | Bug **B4** if server matches HEAD without working-tree diff |
| **Core sync path** | `resolveEffectiveTenRule` without B1 | Bug **B1** on reconnect / `gameStateSync` with stripped direction |

---

## Automated test coverage

| Scenario | Covered? | Where |
|----------|----------|-------|
| Run leader gets on-top after others pass | ✅ | `test-core.ts` ~L1155+ |
| Higher/lower 10 on-top play validation | ✅ | `test-core.ts` ~L1296+, ~L2414+ |
| Pass on on-top clears trick | ✅ | `test-core.ts` |
| `resolveEffectiveTenRule` during on-top beat | ✅ | `test-core.ts` ~L1467 |
| Direction stripped, recover from trick (B1) | ✅ locally | `test-core.ts` uncommitted ~L2520+ — **not in production gate run** |
| Online pass/play on on-top after prior pass (B2) | ❌ | No automated gate |
| Server turn index realignment (B4) | ❌ | No dedicated gate |
| 40-game offline sim with on-top preprocess | ✅ | `offline-round-sim.mjs` (HEAD) |

**Gate:** `npm run test-core` passes on HEAD for shipped on-top tests; uncommitted direction-strip tests fail against HEAD `core.ts`, pass against working tree.

---

## Known remaining issues

1. **Production B2:** `handlePlayPress` / `handlePassPress` still block when `hasPassedInCurrentTrick` — fix only in uncommitted `GameScreen.tsx`.
2. **Production B1:** Sync/reconnect can leave `tenRule.active` with `direction: null` on 10 pile — on-top grant/validation fails until fix deployed.
3. **Production B3/B4:** Turn index drift between display and authority during on-top beat (client + server).
4. **No Human QA signoff** specific to on-top online reconnect path.
5. **Investigation tooling** (`investigate-play-stack.mjs`, etc.) untracked — not part of release gate.

---

## Recommendations

| Item | Recommendation | Rationale |
|------|----------------|-----------|
| Core On Top! rules, pill UX, pre-commit 10, basic `resolveEffectiveTenRule` | **Already shipped** | Live in v1.0.60; documented in What's New |
| B1 — `core.ts` direction recovery + grant-site `resolveEffectiveTenRule` | **Include in v1.0.61** | Small, targeted; fixes online sync edge; tests written |
| B2/B3 — `GameScreen.tsx` on-top pass/play guards | **Include in v1.0.61** if committing whole `GameScreen.tsx` for Cluster A; **defer** if cherry-picking Cluster A only | Co-located in same file; cherry-pick can include only on-top hunks (~30 lines) without seat-chat/presence |
| B4 — `server/index.js` run-on-top turn sync | **Include in v1.0.61** | Required for online B2 fix; ~8 lines; pairs with client |
| `scripts/test-core.ts` direction-strip tests | **Include in v1.0.61** with B1 | Locks regression |
| Investigation scripts / `onTopDiagnostics` expansion | **Defer** | Dev-only; not player-facing |
| `GameTable.tsx` pill layout diff | **Defer** | Cosmetic; unrelated to on-top correctness |

### Summary verdict

| Category | Verdict |
|----------|---------|
| **On Top! as a feature** | **Already shipped** in v1.0.60 |
| **On Top! online reliability fixes (B1–B4)** | **Include in v1.0.61** — small, gameplay-affecting, uncommitted; align with RC if `GameScreen.tsx` / `server/index.js` ship anyway |
| **Diagnostics / investigation tooling** | **Defer** post-RC |

If enforcing **strict minimal RC** (Cluster A/B cherry-picks only): cherry-pick **B1–B4 hunks** into the same two files alongside Cluster A/B, or **defer all B1–B4 to v1.0.62** and document as known issue: “On top! after reconnect or after passing earlier in the trick may fail online.”

---

## Quick reference — symbols by location

```
resolveEffectiveTenRule     src/game/core.ts
isOnTopEligiblePile         src/game/core.ts
grantRunOnTopBeat           src/game/core.ts
onTopDiagnostics            src/game/onTopDiagnostics.ts
humanRunOnTopTurn           src/screens/GameScreen.tsx
runOnTopTurn (server)       server/index.js (working tree only)
```
