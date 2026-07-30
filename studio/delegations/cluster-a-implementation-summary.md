# Cluster A — Implementation Summary

**Work item:** `wi-round-transition`  
**Date:** 2026-06-20  
**Status:** Implemented and validated

---

## Summary

Fixed online round transition **empty hands** when `tradesComplete` arrives without active ceremony UI (fresh round / instant trades path). Client now calls `finalizeCeremonyRound` from:

1. **`tradesComplete` handler** — when no `ceremonyPrep` / `tradePhase`, guarded by `ceremonyDoneForRoundRef`, `awaitingDealCeremony`, `freshRound`, or empty server pending trades.
2. **`applyServerSync`** — when authoritative `playerHands` exist but visible player hands are empty (ceremony skipped or sync-before-finalize race).

Double-finalize guarded via existing `ceremonyDoneForRoundRef` check and `finalizeCeremonyRound` return value.

---

## Files changed

| File | Change |
|------|--------|
| `src/screens/GameScreen.tsx` | +helpers `serverHandsHaveLivingCards`, `livingPlayersHandsEmpty`, `shouldFinalizeInstantTradesComplete`; tradesComplete branch; applyServerSync defensive finalize; `finalizeCeremonyRoundRef` typed as `boolean` |

**Lines:** ~75 net

---

## Test results

| Test | Result |
|------|--------|
| `npx tsx ./scripts/test-core.ts` | **PASS** |
| `node scripts/test-connected-round-end-order.mjs` | **PASS** |
| `node scripts/test-reconnect-round-complete.mjs` | **PASS** |
| `ONLY=2h ROUNDS=3 node scripts/test-multiplayer-matrix.mjs` | **PASS** |

Release gate server slice (2026-06-20, `SKIP_OFFLINE=1`): **partial PASS** — `quick-private-2h`, `spectator-promote`, `reconnect-rankings`, `private-reconnect` green; `botopn-lifecycle` / `botopn-stall-live` remain Cluster C.

---

## Risk assessment

| Risk | Status |
|------|--------|
| Double finalize | Mitigated — `ceremonyDoneForRoundRef !== roundKey` |
| Mid-trade premature finalize | Mitigated — requires no prep/tp |
| Rankings / reconnect regression | No change to round-end ordering paths |
| BOTOPN skip-deal path | Unchanged |

---

## Recommendation

**Keep** — automated validation green; scope limited to documented ceremony finalize paths.

---

## Rollback

Revert `src/screens/GameScreen.tsx` Cluster A hunks only.
