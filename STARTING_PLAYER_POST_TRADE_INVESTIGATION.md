# Starting Player Post Trade — Investigation

**Date:** 2026-06-08  
**Repro:** Production — round 2+ after President→Asshole trade; President returns **3♥** (not 3♣); another seat holds **3♣**; **Asshole** receives opening lead.  
**Scope:** Trace only — no implementation.

---

## Executive summary

| Question | Answer |
|----------|--------|
| Starter chosen before or after trade? | **Both.** Pre-trade index is set at deal (`resolveOpeningPlayerIndex` → dealer’s-left for round 2+). Post-trade index **should** be recalculated via `resolveLeadPlayerIndexAfterTrades` / `resolveOpenerAfterRoleTrades`. |
| Recalculated after trade? | **Intended yes** — server `syncOpeningPlayerAfterTrades`, client `finalizeCeremonyRound`. **Often defeated** by event ordering and sync overwrite. |
| Any rank-3 treated as starter? | **Yes** — `resolveFirstRoundLeadPlayerIndex` fallback at `tableSeats.ts:171` (`c.value === 3`, any suit). |
| Trade completion mutates `currentPlayerIndex`? | **Yes** — server ~595, client via `buildFreshRoundState` ~626. |
| Server wrong vs UI wrong? | **Both layers implicated.** Server can emit stale/wrong index; client can overwrite a correct local finalize with that sync. |

**Root cause (combined, 88% confidence):**

1. **Server emits `gameStateSync` with pre-recalc `currentPlayerIndex` before `syncOpeningPlayerAfterTrades` runs** (`server/index.js:1966` before `:1969`).
2. **Post-trade opener fallback treats any rank-3 as lead** when strict 3♣ scan fails on the hand snapshot — **Asshole with returned 3♥ wins** (`tableSeats.ts:171` via `roundPrep.ts:573–574` / `server/index.js:587–589`).
3. **Client `applyServerSync` applies `parsed.currentPlayerIndex` blindly** after `finalizeCeremonyRound` may have computed the correct 3♣ holder (`GameScreen.tsx:2269`).

Core rules engine **passes** the exact 3-player repro in `scripts/test-core.ts:2193–2222` — bug is **online ceremony / sync pipeline**, not missing rule in isolation.

---

## Repro mapped to code

| Fact | Implication |
|------|-------------|
| President returns **3♥** to Asshole | Asshole holds **rank 3, non-clubs** after trade |
| Another player holds **3♣** | `resolveLeadPlayerIndexAfterTrades` **must** return that seat |
| Asshole opens | Opener resolution used **wrong snapshot** and/or **any-rank-3 fallback**, or **stale sync overwrote** correct index |

Automated analogue (passes offline):

```2193:2222:scripts/test-core.ts
// 3-player: president returns 10♦; middle keeps 3♣ → middle must open
completeWinnerReturn(players, trades[0], [{ suit: "diamonds", value: 10 }]);
assert.strictEqual(
  resolveLeadPlayerIndexAfterTrades(players, { lastRoundOrder: lastOrder }),
  1,
  "Middle player opens when they hold 3♣",
);
```

---

## Audit — searched symbols

| Symbol searched | Found? | Location |
|-----------------|--------|----------|
| `findStarterPlayer` | **No** | — |
| `determineStartingPlayer` | **No** | — |
| `resolveOpeningPlayer` | **No** (use `resolveOpeningPlayerIndex`) | `src/utils/tableSeats.ts:206` |
| Three-of-clubs logic | **Yes** | `tableSeats.ts:167–168`, `182–193`, `core.ts:1821–1835` (opening **play** validation) |
| Lowest-card logic | **Yes** (trade returns, not opener) | `roundPrep.ts:89`, `server/index.js` `pickLowestCards` |
| Role trade completion | **Yes** | `server/index.js:1941–1974`, `GameScreen.tsx:1406–1426`, `2679–2732` |
| `currentPlayerIndex` at round setup | **Yes** | See transition table below |

---

## Transition trace — who holds 3♣?

Legend: **H** = holder of 3♣, **A** = Asshole, **P** = President, **M** = middle/other seat.

### 1. Round preparation (server deal)

| Stage | File : lines | `currentPlayerIndex` | 3♣ owner | Notes |
|-------|----------------|----------------------|----------|-------|
| Deal + initial state | `server/index.js:102–116` → `core.ts:347–397` | Set at `core.ts:397` via `resolveOpeningPlayerIndex` | **M** (dealt) | Pre-trade hands in `playerHands` |
| Pre-trade opener rule | `tableSeats.ts:206–230` | **Dealer’s-left**, not 3♣ holder | **M** still has 3♣ | Round 2+: opener = seat anticlockwise from Asshole dealer |
| Mandatory trade prep | `server/index.js:454–502` | Unchanged | **M** | Asshole’s best card(s) removed; incoming to President |
| Roles | `server/index.js:428–449` | Unchanged | **M** | `roles.asshole`, `roles.president` |

**At deal completion:** 3♣ remains on whoever was dealt it (typically not Asshole). `currentPlayerIndex` = **dealer’s-left index** (usually **not** Asshole in a 3+ seat ring).

### 2. Role trade completion (President selects return)

| Stage | File : lines | `currentPlayerIndex` | 3♣ owner | Notes |
|-------|----------------|----------------------|----------|-------|
| President selects 3♥ | `server/index.js:506–545`, `:1951–1963` | Still pre-recalc | **M** | `playerHands` updated; Asshole gains 3♥ |
| **`broadcastGameState`** | `server/index.js:1966` | **Still pre-recalc (dealer’s-left)** | **M** | **Bug:** sync sent **before** opener recalc |
| **`syncOpeningPlayerAfterTrades`** | `server/index.js:565–597`, called `:1969` | **Should → M** (3♣ scan) | **M** | Copies `playerHands` → `p.hand` then resolves |
| `tradesComplete` emit | `server/index.js:1970` | Server memory correct; **not in payload** | **M** | Payload is `{ playerHands }` only |

**Fallback chain inside `syncOpeningPlayerAfterTrades` (`server/index.js:587–593`):**

1. `resolveLeadPlayerIndexAfterTrades` — **3♣ only** (`tableSeats.ts:191`)
2. `resolveFirstRoundLeadPlayerIndex` — 3♣ then **any rank 3** (`tableSeats.ts:167–171`)
3. `resolveOpeningPlayerIndex` — dealer’s-left (`tableSeats.ts:221–230`)

If step 1 fails on a bad snapshot, step 2 picks **first seat in deal order with any 3** → **Asshole with 3♥** can win **before** step 3.

### 3. Client ceremony / sync

| Stage | File : lines | `currentPlayerIndex` | 3♣ owner | Notes |
|-------|----------------|----------------------|----------|-------|
| Hidden ceremony state | `GameScreen.tsx:1316–1321`, `roundPrep.ts:597–604` | Dealer’s-left on **empty hands** | n/a (hands hidden) | `openingPlayerIndex` omitted when `priorRound` |
| Trade UI | `GameScreen.tsx:2108` | From server snapshot | Local view partial | Opponent `players[].hand` may be hidden placeholders |
| **`finalizeCeremonyRound`** | `GameScreen.tsx:1138–1158`, `roundPrep.ts:560–576` | **`resolveOpenerAfterRoleTrades(merged)`** | **M** when `serverHands` complete | Uses full `playerHands` from `tradesComplete` |
| **`applyServerSync` default path** | `GameScreen.tsx:2269` | **`parsed.currentPlayerIndex`** | Server view | **Can overwrite** finalize if stale/newer `stateVersion` from `:1966` broadcast |

### 4. First playable state (expected vs actual)

| | Expected | Actual (repro) |
|---|----------|----------------|
| Starter | **M** (`resolveLeadPlayerIndexAfterTrades`) | **A** (Asshole) |
| Mechanism | 3♣ holder after full post-trade hands | Any-rank-3 fallback and/or stale `gameStateSync` index |

---

## Key functions (exact locations)

### Opener selection — authoritative rules

```560:576:src/game/roundPrep.ts
export function resolveOpenerAfterRoleTrades(players, dealerOptions?) {
  const priorRound = (lastRoundOrder?.length ?? 0) >= 2 || (finishedOrder?.length ?? 0) >= 2;
  if (!priorRound) {
    return resolveOpeningPlayerIndex(players, dealerContext);
  }
  const afterTrades = resolveLeadPlayerIndexAfterTrades(players, dealerContext);
  if (afterTrades >= 0) return afterTrades;
  const anyThreeLead = resolveFirstRoundLeadPlayerIndex(players, dealerContext);
  if (anyThreeLead >= 0) return anyThreeLead;
  return resolveOpeningPlayerIndex(players, dealerContext);
}
```

```182:199:src/utils/tableSeats.ts
export function resolveLeadPlayerIndexAfterTrades(players, options) {
  for (const id of livingDealRecipientOrder(players, options)) {
    ...
    if (p.hand?.some((c) => c.value === 3 && c.suit === "clubs")) {
      return idx;
    }
  }
  ...
  return -1;
}
```

```145:172:src/utils/tableSeats.ts
export function resolveFirstRoundLeadPlayerIndex(players, options) {
  ...
  const clubsIdx = findIdxWith((c) => c.value === 3 && c.suit === "clubs");
  if (clubsIdx >= 0) return clubsIdx;
  ...
  return findIdxWith((c) => c.value === 3);  // ← ANY suit, including 3♥ on Asshole
}
```

```206:230:src/utils/tableSeats.ts
export function resolveOpeningPlayerIndex(players, options) {
  ...
  if (!priorRound) {
    return resolveFirstRoundLeadPlayerIndex(...);  // round 1 path
  }
  // round 2+ pre-trade: dealer's-left ONLY — no 3♣ check
  const openerId = recipientOrder.find((id) => living.includes(id)) ?? ...;
  return players.findIndex((p) => p.id === openerId);
}
```

### Server post-trade recalc

```565:607:server/index.js
function syncOpeningPlayerAfterTrades(gameState, hostId) {
  ...
  for (const p of gameState.players || []) {
    if (playerHands[p.id]) p.hand = [...playerHands[p.id]];
  }
  let idx = resolveLeadPlayerIndexAfterTrades(gameState.players, dealerContext);
  if (idx < 0) idx = resolveFirstRoundLeadPlayerIndex(...);
  if (idx < 0) idx = resolveOpeningPlayerIndex(...);
  if (idx >= 0) {
    gameState.currentPlayerIndex = idx;
    gameState.mustPlay = true;
  }
}
```

```1958:1974:server/index.js
room.gameState.playerHands = playerHands;
for (const p of room.gameState.players) { p.hand = playerHands[p.id] || p.hand; }
io.to(roomId).emit('playerHandsUpdate', { playerHands });
broadcastGameState(io, room);                    // ← index NOT yet recalculated
if (allTradesComplete(room.gameState)) {
  syncOpeningPlayerAfterTrades(room.gameState, room.host);
  io.to(roomId).emit('tradesComplete', { playerHands });
}
```

### Client finalize + sync overwrite

```1138:1166:src/screens/GameScreen.tsx
const dealerContext = {
  hostId: resolvedHostId,
  lastRoundOrder: baseState.lastRoundOrder,
  finishedOrder: ceremonyPrepRef.current?.finishOrder,  // often null in tradePhase path
};
const openerFromHands = resolveOpenerAfterRoleTrades(merged, dealerContext);
const next = buildFreshRoundState(baseState, merged, dealerContext,
  openerFromHands >= 0 ? openerFromHands : useServerOpener ? baseState.currentPlayerIndex : undefined);
setState(next);
```

```2269:2269:src/screens/GameScreen.tsx
setState(repairStuckTurnPointer(parsed));  // applies server currentPlayerIndex without opener recalc
```

### Pre-trade deal opener (not post-trade rule)

```712:712:src/game/roundPrep.ts
const openingPlayerIndex = resolveOpeningPlayerIndex(players, dealerContext);
```

Used for ceremony metadata; round 2+ hidden state passes `undefined` opener to force `resolveOpenerAfterRoleTrades` — but only at finalize with real hands.

---

## Answers to investigation questions

### 1. Is starter chosen before trade or after trade?

**Both, depending on layer:**

- **Before trade:** `beginAuthoritativeRound` → `buildInitialGameState` → `resolveOpeningPlayerIndex` (`core.ts:387`, `tableSeats.ts:206–230`) sets **`currentPlayerIndex` to dealer’s-left** for round 2+.
- **After trade (intended):** `syncOpeningPlayerAfterTrades` (server) and `finalizeCeremonyRound` → `resolveOpenerAfterRoleTrades` (client) should set starter to **3♣ holder**.

### 2. Is starter recalculated after trade?

**Yes in code, but not atomically with sync:**

- Server recalc runs **after** a `broadcastGameState` that still carries the old index (`server/index.js:1966` vs `:1969`).
- No guaranteed second broadcast after recalc on human rooms.
- Client may finalize correctly, then **`applyServerSync` replaces index** (`GameScreen.tsx:2269`).

### 3. Does any code treat any rank-3 card as the starting card?

**Yes.**

- `resolveFirstRoundLeadPlayerIndex` → `findIdxWith((c) => c.value === 3)` at **`src/utils/tableSeats.ts:171`**.
- Invoked from post-trade fallbacks in **`resolveOpenerAfterRoleTrades`** (`roundPrep.ts:573–574`) and **`syncOpeningPlayerAfterTrades`** (`server/index.js:588–589`).
- **Not** used by `resolveLeadPlayerIndexAfterTrades` (clubs-only at `:191`).

This directly explains **Asshole opening after receiving 3♥** when the 3♣ scan fails on the snapshot used.

### 4. Does role-trade completion mutate `currentPlayerIndex`?

**Yes:**

| Location | Mutation |
|----------|----------|
| `server/index.js:595–596` | `gameState.currentPlayerIndex = idx`; `mustPlay = true` |
| `roundPrep.ts:626` | `buildFreshRoundState` sets `currentPlayerIndex: openerIdx` |
| `GameScreen.tsx:1166` | `setState(next)` after finalize |

Also **non-recalc mutations:** `broadcastGameState` preserves pre-trade index until sync runs; `applyServerSync` copies server index.

### 5. Server correct and UI wrong, or wrong on server?

| Layer | Verdict | Confidence |
|-------|---------|------------|
| **Core / offline** | Correct | 99% (tests pass) |
| **Server authoritative index** | Often **stale or wrong at sync boundary** | 70% |
| **Client display** | **Wrong when sync overwrites** good finalize | 75% |
| **Combined production repro** | **Pipeline bug**, not missing 3♣ rule | **88%** |

**Server memory** after `syncOpeningPlayerAfterTrades` is likely correct when full `playerHands` are copied; **clients may never see that index** if they apply an earlier `gameStateSync` or resolve opener on incomplete hands and hit the **any-rank-3** fallback.

---

## Recommended logging (for next repro capture)

At each transition, log:

```text
event: startNextRound | playerTradeSelection | syncOpeningPlayerAfterTrades | tradesComplete | finalizeCeremonyRound | gameStateSync
currentPlayerIndex
starterPlayerId (= players[currentPlayerIndex].id)
roles (president / asshole ids)
lastRoundOrder
trade payload (selected return cards)
playerHands[<eachId>] contains 3♣? (boolean)
resolveLeadPlayerIndexAfterTrades result
resolveFirstRoundLeadPlayerIndex result (if reached)
stateVersion
```

---

## Smallest possible fix (do not implement here)

**Priority 1 — server ordering (~3 lines moved):**  
In `server/index.js:1965–1970`, call **`syncOpeningPlayerAfterTrades` before `broadcastGameState`**, then broadcast once (or broadcast again after sync). Ensures `gameStateSync` carries post-trade opener.

**Priority 2 — remove dangerous fallback (~2–6 lines):**  
In `resolveOpenerAfterRoleTrades` (`roundPrep.ts:573–574`) and `syncOpeningPlayerAfterTrades` (`server/index.js:588–589`), **drop `resolveFirstRoundLeadPlayerIndex` fallback** for `priorRound` paths — go straight from `resolveLeadPlayerIndexAfterTrades` to `resolveOpeningPlayerIndex` (or fail closed). Prevents **3♥ on Asshole** from winning when 3♣ scan fails.

**Priority 3 — client guard (~8–15 lines):**  
In `GameScreen.tsx` `applyServerSync`, when trades are complete and `playerHands` present, set  
`currentPlayerIndex = resolveOpenerAfterRoleTrades(applyServerPlayerHands(...), dealerContext)`  
instead of trusting `parsed.currentPlayerIndex` alone.

**Optional:** Include `openingPlayerIndex` or `starterPlayerId` in `tradesComplete` payload so clients need not re-derive.

---

## Related tests (already green)

- `scripts/test-core.ts:2097–2225` — post-trade 3♣ opener (includes 3-player middle-holder + president returns non-3♣)
- No automated test for **`broadcastGameState` before `syncOpeningPlayerAfterTrades`** or **`applyServerSync` overwrite**

---

## Confidence summary

| Finding | Confidence |
|---------|------------|
| Rule: post-trade starter = 3♣ holder | 99% |
| Core implements rule when hands complete | 99% |
| Any-rank-3 fallback can pick Asshole with 3♥ | 95% |
| Server broadcasts sync before opener recalc | 92% |
| Client sync can overwrite correct finalize | 85% |
| **Combined root cause for production repro** | **88%** |
