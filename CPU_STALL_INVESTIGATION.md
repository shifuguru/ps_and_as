# CPU stall investigation (BOTOPN — pass during run)

**Status:** RC-1 fix applied in `runBotTurnLoop` (`repairTurnPointerAndReschedule`).  
**Harness:** `node scripts/test-cpu-stall-botopn.mjs --headless`  
**Live repro:** `npm run server` then `node scripts/test-cpu-stall-botopn.mjs`

---

## A. Reproduction steps

### Deterministic headless (rules + server pass pipeline)

1. Three seats: human `stall-human-1`, `cpu-1`, `cpu-2` (see `scripts/test-cpu-stall-botopn.mjs`).
2. Build run trick: human plays 3, cpu-1 plays 4, cpu-2 plays 5 (run length ≥ 3).
3. Human passes on the run (`passTurn`).
4. Mirror server `gameAction` pass path:
   - `advancePastInactiveSeats`
   - `repairStuckTurnPointer`
5. Run bot helpers: `advanceUntilBotTurnOrHuman` → `processBotTurnStep`.

**Observed in harness (happy path):** After step 3, `currentPlayerIndex` → `cpu-1`; `shouldBotCpuAct` → `true`; CPU step runs.

**Stall-shaped state (prod report):** `currentPlayerIndex` still on **passed human** while `resolveDisplayTurnPlayerIndex` shows **cpu-1** (UI “your turn” skipped, CPUs idle). Harness confirms this desync:

```text
currentPlayerIndex: stall-human-1 (passed)
displayIndex:       cpu-1
shouldBotCpuAct:      false
```

### Live socket (targeted)

1. `npm run server`
2. `node scripts/test-cpu-stall-botopn.mjs` (no `--headless`)
3. Join `BOTOPN` as `StallHuman`, ready until seated (dead-hand promotion).
4. Wait for run context (≥3 cards in run) and human turn.
5. Emit `gameAction` `{ type: "pass" }`.
6. Poll 45s: fail if `stateVersion` unchanged ≥18s while display/current indicates CPU should act.

---

## B. Trace map (PASS → CPU act)

| Step | Location | What to log |
|------|----------|-------------|
| 1 PASS | `server/index.js` `gameAction` | `passTurn` before/after |
| 2 Advance inactive | `turnAdvance.js` `advancePastInactiveSeats` | index, `hasPassedInCurrentTrick` |
| 3 Repair pointer | `core.ts` `repairStuckTurnPointer` | index before/after |
| 4 Kick loop | `botHostedRooms.js` `kickBotTurnLoop` | timer cleared/scheduled |
| 5 Advance to CPU | `advanceUntilBotTurnOrHuman` | return value, index, human branch |
| 6 CPU gate | `shouldBotCpuAct` | current id, `isSeatedInCurrentRound` |
| 7 CPU step | `processBotTurnStep` | `applyCpuTurn` / `passTurn` result |
| 8 Loop schedule | `runBotTurnLoop` lines 760–814 | `acted`, timer scheduled? |

Harness logs JSON lines via `traceLine()` in `scripts/test-cpu-stall-botopn.mjs`.

---

## C. Root cause candidates

### RC-1 (primary) — `runBotTurnLoop` early exit without timer (line 788)

| Field | Value |
|-------|--------|
| **File** | `server/botHostedRooms.js` |
| **Function** | `runBotTurnLoop` |
| **Condition** | `processBotTurnStep` returned `false` → `advanceUntilBotTurnOrHuman` returned **`true`** → `shouldBotCpuAct` is **`false`** → hits `return` at **788** without scheduling `_botTurnTimer` |
| **Why stall** | RC-H (lines 796–814) only runs when `advanceUntilBotTurnOrHuman` returns **`false`**. If advance returns `true` but the seat is still a **passed human** (or CPU that fails `shouldBotCpuAct`), the loop **exits silently** — no CPU timer. |

```text
acted=false → advanceUntilBotTurnOrHuman()=true → shouldBotCpuAct=false → return (NO TIMER)
                                                      ↓
                                            RC-H never reached
```

Matches prod: display turn shows CPU (`resolveDisplayTurnPlayerIndex`), authoritative `currentPlayerIndex` still wrong → `shouldBotCpuAct` false.

---

### RC-2 — `advanceUntilBotTurnOrHuman` human branch returns without reaching CPU (lines 470–495)

| Field | Value |
|-------|--------|
| **File** | `server/botHostedRooms.js` |
| **Function** | `advanceUntilBotTurnOrHuman` |
| **Condition** | Seated human has **already passed**; `awaitingHumanPlay` false; `advancePastInactiveSeats` + `repairStuckTurnPointer` do **not** change index/trick/pile → `return changed` at **495** with index still on passer |
| **Why stall** | Feeds RC-1: advance “succeeded” (`true`) but pointer still on non-CPU → `shouldBotCpuAct` false |

**Note:** RC-B fix (lines 467–479) correctly skips humans who **still owe** a play; this is the **post-pass** path where inactive advance must move index to CPU.

---

### RC-3 — `shouldBotCpuAct` false while UI shows CPU

| Field | Value |
|-------|--------|
| **File** | `server/botHostedRooms.js` |
| **Function** | `shouldBotCpuAct` → `isSeatedInCurrentRound` |
| **Condition** | `currentPlayerIndex` points at `cpu-*` but lobby/game disagree (spectator, `isBotActiveAtTable` false, dead-hand eviction in `turnAdvance.js` `botEvicted`) |
| **Why stall** | Loop thinks no CPU may act; combined with RC-1 → no timer |

---

### RC-4 — `runBotTurnLoop` exits on round complete (line 771)

| Field | Value |
|-------|--------|
| **File** | `server/botHostedRooms.js` |
| **Function** | `tryCompleteBotRound` inside `runBotTurnLoop` |
| **Condition** | `tryCompleteBotRound` returns true while trick still appears active to clients |
| **Why stall** | Loop returns with no reschedule; table looks mid-trick |

Lower confidence than RC-1 for this specific report.

---

### RC-5 (mitigated) — RC-B/C/H partial fixes

| ID | Intent | Gap |
|----|--------|-----|
| RC-B | Don’t stop on human who still owes play | Fixed; doesn’t cover RC-1/2 when advance returns `true` on passer |
| RC-C | `advancePastInactiveSeats` forced `nextActivePlayerIndex` | In `turnAdvance.js` 102–106; may still not run if human branch returns early at 495 |
| RC-H | Passed-seat retry | **Unreachable** when advance returns `true` (RC-1) |

---

## D. Recommended fix (smallest)

**Single change in `runBotTurnLoop` (lines 782–814):** Before the `return` at 788, run the same **passed-seat advance + reschedule** logic as RC-H whenever the turn pointer is still invalid — regardless of whether `advanceUntilBotTurnOrHuman` returned true or false.

```javascript
// After advanceUntilBotTurnOrHuman + broadcast, before return at 788:
const gs = live.gameState;
const idx = gs?.currentPlayerIndex;
const cur = idx != null ? gs.players[idx] : null;
const runOnTopTurn =
  gs?.runOnTop?.active && gs.runOnTop.playerIndex === idx;

if (
  cur &&
  (hasPassedInCurrentTrick(gs, cur.id) || !shouldBotCpuAct(live)) &&
  !runOnTopTurn &&
  !ctx.isRoundComplete(gs)
) {
  ctx.advancePastInactiveSeats(live);
  live.gameState = ctx.cloneGameState(repairStuckTurnPointer(live.gameState));
  ctx.broadcastGameState(ctx.io, live);
  live._botTurnTimer = setTimeout(step, BOT_TURN_DELAY_MS);
  return;
}

if (shouldBotCpuAct(live) && !ctx.isRoundComplete(live.gameState)) {
  live._botTurnTimer = setTimeout(step, BOT_TURN_DELAY_MS);
}
return;
```

Optional tighten: in `processBotTurnStep`, when `advanceUntilBotTurnOrHuman` ran at 667 and `shouldBotCpuAct` is false, call `repairStuckTurnPointer` once before returning false (avoids depending on loop retry).

**Do not:** redesign turn ownership, client authority, or league/QA features for this bug.

---

## E. Verification

1. Apply fix.
2. `node scripts/test-cpu-stall-botopn.mjs --headless` — desync block must schedule CPU (no `loop_line_788_no_timer`).
3. Live BOTOPN: pass on run → `stateVersion` advances within ~2s with CPU on trick.
4. Existing `scripts/test-core.ts` “pass during run” block still passes.
