# Cluster A — Implementation Plan (Round Transition / Ceremony)

**Agent:** Implementation  
**Status:** **Approved for implementation planning** (Director 2026-06-20)  
**Gap:** `multiplayer-round-transition-no-cards`  
**Classification:** Bucket C — client ceremony / sync  
**Do not implement until Director activates Implementation Agent**

---

## Problem statement

After round N completes online, round N+1 can show **empty hands** on the client even though the server dealt. Primary trigger: **fresh round** after 3× same Asshole (`skipPresidentTrade`, instant `tradesComplete`, no trade UI).

Root cause: `tradesComplete` stores authoritative hands in `pendingTradesCompleteRef` but **does not call `finalizeCeremonyRound`** when there is no active `ceremonyPrep` / `tradePhase`. Ceremony finalize then depends on a later path that may never run.

---

## Files affected

| File | Role | Change type |
|------|------|-------------|
| `src/screens/GameScreen.tsx` | Primary — `tradesComplete`, `applyServerSync`, `finalizeCeremonyRound` | **Modify** (~50–75 lines) |
| `src/game/roundPrep.ts` | `shouldFinalizeCeremonyEarly`, `serverPendingTradesComplete` | **Optional** — reuse only; no change unless helper extraction improves clarity (~0–10 lines) |
| `src/game/roundTransitionDiagnostics.ts` | Structured logging | **No logic change** — existing hooks sufficient |
| `src/game/socketAdapter.ts` | Event forwarding | **No change** expected |

**Out of scope:** `server/index.js`, `server/gameSync.js`, dealing authority, rankings, reconnect.

---

## Expected code changes

### 1. `tradesComplete` handler (~2748–2803)

**Today:** If `hands` present and no `prep` / `tp`, only `pendingTradesCompleteRef.current = hands`.

**Change:** Add a third branch when online and hands present:

- Conditions (all): `onlineMultiplayer`, `hands`, no `ceremonyPrepRef`, no `tradePhaseRef`, and any of:
  - `awaitingDealCeremonyRef.current === true`
  - `serverPendingTradesComplete(parsed.pendingTrades)` on current `stateRef` (empty pending / fresh round)
  - `stateRef.current?.freshRound === true`
- Action: resolve base state from `stateRef.current` (or last synced authoritative snapshot), call `finalizeCeremonyRound(players, baseState, hands)`.
- If finalize returns false, keep ref for retry on next sync (do not clear ref prematurely).

### 2. `applyServerSync` — ceremony-skipped path (~2289–2339)

**Today:** When `shouldSkipDealCeremony(parsed)` is true, sets ceremony refs but may `setState(parsed)` without merging hands.

**Change:** After skip-ceremony branch, if:

- `onlineMultiplayer`
- `parsed.playerHands` has living hand counts > 0
- `pendingTradesCompleteRef.current` or `shouldFinalizeCeremonyEarly(prep, pendingHands)`
- not `ceremonyPrep` / `tradePhase` active

→ call `finalizeCeremonyRound` instead of raw `setState` when hands would otherwise be invisible.

### 3. Preserve existing invariants

- **Do not** clear `pendingTradesCompleteRef` on `nextRoundStarting` (comment ~2689 — already correct).
- **Do not** change BOTOPN skip-deal path (`botOpenSkipCeremony` block ~2200–2223) unless regression proves interaction; test separately.
- Keep `launchCeremonyFromDeal` / deal animation path unchanged for rounds with pending trades.

---

## Estimated line count

| Area | Lines (incl. comments) |
|------|-------------------------|
| `tradesComplete` branch | 25–35 |
| `applyServerSync` defensive finalize | 20–30 |
| Imports / small helpers | 5–10 |
| **Total** | **50–75** |

---

## Regression risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Double finalize (tradesComplete + sync both finalize) | Medium | Guard with `ceremonyDoneForRoundRef` / roundKey match before finalize |
| Premature finalize during mid-trade ceremony | High | Keep existing `shouldSyncMidTradeFromServer` and `localCeremonyUi` stashes |
| Offline / bot-open skip-deal conflation | Medium | Gate changes behind `onlineMultiplayer` + explicit fresh-round / awaiting-ceremony flags |
| Trade return reveal interrupted | Low | Existing `tradePhase` path unchanged; new branch only when no tp |
| Wrong opener index after finalize | Low | Reuse `buildFreshRoundState` / server `currentPlayerIndex` fallback already in finalize |

---

## Required tests

### Automated (must pass before ship)

```bash
npx tsx ./scripts/test-core.ts
node scripts/test-connected-round-end-order.mjs
node scripts/test-reconnect-round-complete.mjs
ONLY=2h ROUNDS=3 node scripts/test-multiplayer-matrix.mjs   # multi-round private
SKIP_OFFLINE=1 npm run test-release-gate                     # server slice; Cluster C may still fail independently
```

### Targeted (add or extend)

| Test | Purpose |
|------|---------|
| Extend offline / harness forcing 3× same Asshole finish order | Repro fresh-round instant `tradesComplete` without React |
| Manual: private room, force 3 losses same player, verify round 4 hands | E5 production parity |

### Human QA

- Round 4 fresh round: hands visible, play proceeds, no stuck ceremony overlay.

---

## Rollback plan

1. **Single-commit revert** of `GameScreen.tsx` changes (no server migration, no schema).
2. Redeploy web build from prior tag (`1.0.60` or last green deploy).
3. Verify `quick-private-2h` gate PASS on rollback build.
4. Leave `roundTransitionDiagnostics` logging in place — harmless in production.

**Rollback trigger:** Any of: empty hands persist in Human QA, new ceremony double-deal, trade phase skipped incorrectly, rankings overlay regression.

---

## Acceptance criteria

- [ ] Production repro (3× Asshole → round 4) shows dealt hands on all seated clients
- [ ] `quick-private-2h` remains PASS
- [ ] Rankings / reconnect automated tests remain PASS
- [ ] No new `[ROUND-TRANSITION] finalizeCeremonyRound aborted` errors in dev repro session

**Reference:** [P0_ROUND_TRANSITION_INVESTIGATION.md](../../P0_ROUND_TRANSITION_INVESTIGATION.md)
