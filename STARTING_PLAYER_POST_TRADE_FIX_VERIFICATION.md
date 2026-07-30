# Starting Player Post-Trade Fix — Verification

**Date:** 2026-06-08  
**Investigation:** `STARTING_PLAYER_POST_TRADE_INVESTIGATION.md`  
**Objective:** After role trades, opening lead goes to the **3♣ holder** — not Asshole with returned 3♥.

---

## Files modified

| File | Change |
|------|--------|
| `server/index.js` | P0 server ordering; `syncOpeningPlayerAfterTrades` uses `resolveOpenerAfterRoleTrades`; human instant-complete sync before broadcast |
| `src/utils/tableSeats.ts` | P0 `resolveOpenerAfterRoleTrades` — 3♣ only; no any-rank-3 post-trade fallback |
| `src/game/roundPrep.ts` | Re-export opener helper; `openingLeadNotYetTaken`, `reconcilePostTradeOpeningIndex` |
| `src/game/core.ts` | Export `resolveOpenerAfterRoleTrades` |
| `src/screens/GameScreen.tsx` | P1 client reconcile guard; removed stale `useServerOpener` fallback |
| `src/game/roundTransitionDiagnostics.ts` | `logPostTradeOpenerReconciled` |
| `scripts/test-core.ts` | Tests 1, 2, 4 (production repro, 4-player, client reconcile) |
| `scripts/test-post-trade-opener.mjs` | Test 3 (server handler ordering) |

**LOC (this fix slice):** ~420 insertions / 55 deletions across 7 tracked files (+ new `scripts/test-post-trade-opener.mjs`).

---

## Before / after flows

### Server — `playerTradeSelection` (trade complete)

**Before:**

```text
applyWinnerSelectedCards
  → playerHandsUpdate
  → broadcastGameState()     ← stale currentPlayerIndex
  → syncOpeningPlayerAfterTrades()
  → tradesComplete
```

**After:**

```text
applyWinnerSelectedCards
  → playerHandsUpdate
  → syncOpeningPlayerAfterTrades()   ← 3♣ holder
  → broadcastGameState()             ← correct index
  → tradesComplete
```

Mid-trade (president still selecting): `broadcastGameState` unchanged after `playerHandsUpdate`.

### Server — `startNextRound` (instant-complete / fresh round)

**Before:** `broadcastGameState` could run before opener recalc for human rooms with no pending trades.

**After:** Human `else if (lastOrder >= 2 && allTradesComplete)` calls `syncOpeningPlayerAfterTrades` **before** `broadcastGameState`.

### Opener resolution (post-trade)

**Before:**

```text
resolveLeadPlayerIndexAfterTrades (3♣)
  → resolveFirstRoundLeadPlayerIndex (3♣, then ANY rank 3)  ← 3♥ on Asshole could win
  → resolveOpeningPlayerIndex (dealer's-left)
```

**After:**

```text
resolveOpenerAfterRoleTrades
  → resolveLeadPlayerIndexAfterTrades (3♣ only)
  → [warn] → resolveOpeningPlayerIndex (dealer's-left) if no 3♣ in snapshot
```

Round 1 / dead-hand sideline paths still use `resolveFirstRoundLeadPlayerIndex` (including any-rank-3 only where round-1 rules apply).

### Client — `applyServerSync`

**Before:** `setState(parsed)` could apply stale `currentPlayerIndex` after `finalizeCeremonyRound`.

**After:** When trades complete + `playerHands` + no play yet → `reconcilePostTradeOpeningIndex` overwrites index with 3♣ holder; logs `[ROUND-TRANSITION] post-trade opener reconciled`.

---

## Regression tests

| Test | Command | Result |
|------|---------|--------|
| **1** — 3-player, president returns 3♥, middle holds 3♣ | `npx tsx ./scripts/test-core.ts` | **PASS** |
| **2** — 4-player, opener == 3♣ holder | `npx tsx ./scripts/test-core.ts` | **PASS** |
| **3** — sync before broadcast in server handler | `node scripts/test-post-trade-opener.mjs` | **PASS** |
| **4** — client reconcile fixes stale asshole index | `npx tsx ./scripts/test-core.ts` | **PASS** |
| Full core suite | `npx tsx ./scripts/test-core.ts` | **PASS** (exit 0) |

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| No trade-complete sync before opener recalc | **Met** — server reorder + startNextRound guard |
| Clients receive correct `currentPlayerIndex` after trades | **Met** — broadcast after sync |
| 3♥ / 3♦ / 3♠ never post-trade opener candidates | **Met** — removed from `resolveOpenerAfterRoleTrades` chain |
| Stale sync cannot override correct ceremony opener | **Met** — `reconcilePostTradeOpeningIndex` in `applyServerSync` |
| Production repro (3♥ to Asshole, 3♣ elsewhere) | **Met** — deterministic test |

---

## Confidence

| Layer | Estimate |
|-------|----------|
| Root cause addressed (ordering + any-rank-3 fallback) | **95%** |
| Production repro fixed | **92%** |
| No regression to round-1 / dead-hand opening | **90%** (existing tests green) |
| **Overall ship confidence** | **93%** |

---

## Commands

```bash
npx tsx ./scripts/test-core.ts
node scripts/test-post-trade-opener.mjs
```
