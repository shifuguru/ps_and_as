# Live Verification — Post-Trade Opening Player Fix

**Date:** 2026-06-08 (NZ)  
**Harness:** `scripts/live-post-trade-opener-verify.mjs`  
**Command:**

```bash
RELEASE_GATE_SPAWN_SERVER=1 LIVE_OPENER_ATTEMPTS=25 node scripts/live-post-trade-opener-verify.mjs
```

**Result:** **PASS** (attempt 11/25, exit 0)  
**Verdict:** **Starting-player post-trade fix is release-ready.**

---

## Objective

Validate the production repro in a real online room (3 socket clients + spawned server), not only synthetic unit tests:

- President returns **3♥** to Asshole
- Another player holds **3♣**
- Asshole does **not** hold **3♣**
- After trades complete, **3♣ holder** opens — not Asshole because they received 3♥

---

## Test setup

| Parameter | Value |
|-----------|--------|
| Room type | 3-player online private room |
| Dead Hand | No |
| Round reached | Round 2 (after natural round 1 completion) |
| Clients | Host, Guest, Third (3 independent `socket.io` connections) |
| Server | Spawned locally on `http://localhost:4000` |

**Successful repro room:** `O805930` (attempt 11)

---

## Scenario — card ownership

### Roles (after round 1)

| Seat | Player | Role |
|------|--------|------|
| Third | President | `president` |
| Guest | Middle | `neutral` |
| Host | Asshole | `asshole` |

**`lastRoundOrder`:** Third → Guest → Host (President first out, Asshole last)

### Before trade (round 2 deal, pre-selection)

| Seat | Key cards |
|------|-----------|
| President (Third) | **3♥** (+ asshole’s incoming highest card from trade setup) |
| Guest (Middle) | **3♣** (+ 3♠, 3♦ among other cards) |
| Asshole (Host) | No 3♣; received president trade incoming card |

### Trade executed

```text
President → Asshole return card: 3♥
```

(`playerTradeSelection` with `{ suit: "hearts", value: 3 }`)

### After trade

| Seat | Key cards |
|------|-----------|
| President (Third) | 3♥ removed; asshole’s incoming card retained |
| Guest (Middle) | **3♣ unchanged** |
| Asshole (Host) | **3♥ received**; still **no 3♣** |

---

## Verify immediately after trades

Captured from server-authoritative state after `tradesComplete` + follow-up `gameStateSync` requests:

| Field | Value |
|-------|--------|
| **Who owns 3♣?** | **Guest** (middle seat, index 1) |
| **`currentPlayerIndex`** | **1** |
| **`openingPlayerId`** | **Guest** |
| **Asshole (`currentPlayerIndex === 2`)** | **No** — Asshole did not receive first turn |

### Expected vs actual

| Check | Expected | Actual |
|-------|----------|--------|
| Opener | 3♣ owner (Guest) | Guest ✓ |
| Asshole opens on 3♥ alone | Must NOT happen | Asshole index 2 — not opener ✓ |
| `resolveOpenerAfterRoleTrades` index | 1 | 1 ✓ |

---

## Online sync verification

After `tradesComplete`:

1. Waited for post-trade `gameStateSync` on all clients (2× `requestGameState` round-trip).
2. Compared `currentPlayerIndex` across Host, Guest, Third views.

| Client | `currentPlayerIndex` | Opener ID | Matches 3♣ owner? |
|--------|---------------------|-----------|------------------|
| Host | 1 | Guest | Yes |
| Guest | 1 | Guest | Yes |
| Third | 1 | Guest | Yes |

**Sync stable:** Yes — all three clients identical (`syncStable: true`)

**Stale overwrite observed:** No — opener did not revert to Asshole after later syncs in this run.

**Server vs clients:** Aligned on index 1 / Guest as opener.

---

## Diagnostics

No failure occurred in the passing run.

**Observed (non-blocking):** Server stderr emitted `[opener] post-trade: no living 3♣ holder… falling back to dealer-left` during unrelated failed-layout attempts in the search loop (attempts 1–10). That warning did **not** appear for the passing repro; the successful path used `resolveLeadPlayerIndexAfterTrades` → living 3♣ on Guest.

If a future run fails, capture:

- `currentPlayerIndex`
- `playerHands`
- `lastRoundOrder`
- `tradesComplete` payload
- sequential `gameStateSync` payloads per client
- classify fault: server recalculation / client reconciliation / sync overwrite

---

## Seeds & reproducibility

| | Seed |
|---|------|
| Round 1 deal | `245314191` |
| Round 2 deal | `141371098` |

Re-run harness with higher `LIVE_OPENER_ATTEMPTS` if the exact layout is needed again without manual play.

---

## Related automated coverage (pre-live)

| Suite | Result |
|-------|--------|
| `npx tsx ./scripts/test-core.ts` (production repro + dead-hand post-trade) | PASS |
| `node scripts/test-post-trade-opener.mjs` (server sync-before-broadcast) | PASS |

---

## Summary

| Item | Status |
|------|--------|
| Production repro in live 3p room | **Reproduced** (attempt 11) |
| 3♣ holder opens after President → Asshole 3♥ trade | **PASS** |
| Asshole does not open solely on received 3♥ | **PASS** |
| Host / Guest / Third agreement | **PASS** |
| Post-trade sync overwrite | **Not observed** |

**Release readiness:** **Approved** — starting-player post-trade fix validated in live multiplayer, matching synthetic tests and audit expectations.
