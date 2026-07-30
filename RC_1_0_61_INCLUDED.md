# RC v1.0.61 — Included Bundle

**Baseline:** production **v1.0.60** @ commit `249eabb8298333e24f53578e54f7d45dffa5c7bd`  
**Target:** smallest deployable release candidate (Clusters A + B only)  
**Date:** 2026-06-08

---

## Scope

This bundle ships **two P0 fixes** only:

| Cluster | Gap | Fix |
|---------|-----|-----|
| **A** | Multiplayer round transition — empty hands after repeated Asshole | Client ceremony finalize on instant `tradesComplete` / fresh-round sync |
| **B** | Spectator promotion between rounds | Server `promoteReadySpectatorsBetweenRounds` + notify on ready |

Everything else in the working tree is **out of scope** for v1.0.61 unless explicitly pulled in via a mixed-file commit (see Uncertain).

---

## Gameplay-affecting files modified since v1.0.60

### Required — Cluster A

| File | Role |
|------|------|
| `src/screens/GameScreen.tsx` | **Primary.** Adds `shouldFinalizeInstantTradesComplete`, `serverHandsHaveLivingCards`, `livingPlayersHandsEmpty`; defensive finalize in `applyServerSync` and `tradesComplete` paths |

**Cluster A symbols (must land):**

- `shouldFinalizeInstantTradesComplete`
- `serverHandsHaveLivingCards` / `livingPlayersHandsEmpty`
- `applyServerSync` block: empty visible hands + authoritative server hands → `finalizeCeremonyRound`
- `tradesComplete` handler: `shouldFinalizeInstantTradesComplete` → `finalizeCeremonyRoundRef`

---

### Required — Cluster B

| File | Role |
|------|------|
| `server/index.js` | **Primary.** Spectator ready promotion between rounds |

**Cluster B symbols (must land):**

- `canSpectatorMarkReadyForPromotion`
- `promoteReadySpectatorsBetweenRounds`
- `notifyPromotedSpectators`
- `playerReadyForNextRound` handler: call promotion + notify before `tryStartNextRoundIfReady`

---

### Required — release packaging (non-gameplay, deploy)

| File | Role |
|------|------|
| `package.json` | Set `"version": "1.0.61"` on release commit |
| `src/screens/updateLogContent.ts` | What's New entry (not yet modified in working tree) |

---

### Recommended — gate verification (commit with RC, not player-facing)

| File | Role |
|------|------|
| `scripts/test-core.ts` | Extended core regression (ten-rule direction recovery tests) |
| `scripts/test-connected-round-end-order.mjs` | Rankings overlay order gate script (**untracked** — add if gate rerun required) |

---

## Strict minimal bundle (2 files)

If cherry-picking hunks, **only these files** are required for Clusters A + B:

```
src/screens/GameScreen.tsx   # Cluster A hunks only
server/index.js              # Cluster B hunks only
```

Plus release packaging: `package.json`, `src/screens/updateLogContent.ts`.

---

## Practical bundle (if whole files committed)

The working-tree copies of `GameScreen.tsx` and `server/index.js` **also contain** non-RC changes (see `RC_1_0_61_EXCLUDED.md`). Committing them whole **without stripping** pulls in co-located edits.

### Co-located in `GameScreen.tsx` (ships with whole file)

| Change | Classification |
|--------|----------------|
| Run-on-top pass / turn fixes | Gameplay — **uncertain** (not Cluster A) |
| `playFlightHold` / turn-ring highlight | Gameplay — optional polish |
| Seat chat UI + handlers | Gameplay — **exclude** from minimal RC |
| Presence ring context (`PRESENCE_RING_V1`, default off) | Optional visual — **exclude** from minimal RC |
| CPU think delay jitter | Optional polish — **exclude** |
| Turn transition diagnostics logging | Dev-only — **exclude** |

### Co-located in `server/index.js` (ships with whole file)

| Change | Classification |
|--------|----------------|
| `seatChat` gameAction handler | Gameplay — **exclude** from minimal RC |
| Run-on-top turn index sync on pass/play | Gameplay — **uncertain** (pairs with client run-on-top) |

---

## Dependency chain (only if whole `GameScreen.tsx` is committed)

If the full working-tree `GameScreen.tsx` is committed **without** removing imports, these **additional** files become build-required:

| File | Why |
|------|-----|
| `src/components/GameSeatChatButton.tsx` | imported by GameScreen |
| `src/utils/seatChat.ts` | imported by GameScreen |
| `src/utils/turnTransitionDiagnostics.ts` | imported by GameScreen |
| `src/utils/turnRingFlightVerify.ts` | modified; new exports used by GameScreen |
| `src/utils/playAnimationTiming.ts` | imported by GamePlayArea (if committed) |
| `src/presence/*` | imported when presence wired |
| `src/components/PresenceRingHost.tsx` | imported by OpponentSeat |
| `src/components/LegacyTurnRing.tsx` | imported by OpponentSeat |
| `src/components/PresenceRing.tsx` | presence stack |
| `src/components/OpponentSeat.tsx` | presence wiring |
| `src/components/OpponentRing.tsx` | presence + seatChat props |
| `src/components/GamePlayArea.tsx` | presenceContext prop |
| `src/game/socketAdapter.ts` | seatChat listener |
| `server/index.js` | seatChat emit (already co-located) |

**Minimal RC recommendation:** cherry-pick Cluster A hunks into `GameScreen.tsx` **without** seat-chat / presence / diagnostics imports — avoids this dependency chain.

---

## Summary — files to include in v1.0.61 RC commit

### MUST commit

| File |
|------|
| `src/screens/GameScreen.tsx` (Cluster A hunks minimum) |
| `server/index.js` (Cluster B hunks minimum) |
| `package.json` (version → 1.0.61) |
| `src/screens/updateLogContent.ts` (What's New) |

### SHOULD commit (verification)

| File |
|------|
| `scripts/test-core.ts` |
| `scripts/test-connected-round-end-order.mjs` (add to repo) |

### DO NOT commit (see excluded doc)

Studio, Mission Control, investigations, presence/seat-chat stack (unless whole-file path chosen), BOTOPN timing, deploy-studio infra.
