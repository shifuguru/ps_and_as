# P0 Investigation — On Top! Not Appearing In Production

**Reported:** On Top! never appears after winning a run, higher-10, or lower-10 on the live public build.  
**Production client:** v1.0.60 @ `249eabb8298333e24f53578e54f7d45dffa5c7bd`  
**Investigation date:** 2026-06-08  
**Scope:** Trace only — no implementation.

---

## Executive summary

The prior audit was **partially wrong**. On Top! **logic exists in the v1.0.60 bundle**, but the **live grant → sync → UI pipeline is broken** for common online play. Unit tests pass; production play does not.

**Primary break point (confidence 88%):** `maybeResolveTrickAfterPasses` → `isOnTopEligiblePile` returns **false** on production HEAD → **`finalizeTrickWin` runs instead of `grantRunOnTopBeat`** → trick clears immediately → client shows trick-end pause, never `runOnTop.active`.

**Secondary break (confidence 82%):** Even when `runOnTop` is briefly set (optimistic client pass), **client pass/play guards** and **`runOnTopActive` index mismatch** prevent the winner from acting; animated pill requires `humanRunOnTopTurn`.

**Uncommitted fixes in working tree** (`core.ts`, `GameScreen.tsx`, `server/index.js`) target exactly these gaps but are **not deployed**.

---

## Pipeline trace

### Stage 1 — Rules engine (`src/game/core.ts`)

| | Expected | Actual (production HEAD) | Evidence |
|---|----------|--------------------------|----------|
| Last pass on eligible pile | `maybeResolveTrickAfterPasses` → `isOnTopEligiblePile` **true** → `grantRunOnTopBeat` | **`isOnTopEligiblePile` false** → `finalizeTrickWin` | HEAD `isOnTopEligiblePile` L191–192; `maybeResolveTrickAfterPasses` L2854–2866 |
| After grant | `runOnTop: { active: true, playerIndex }`, pile **unchanged**, `trickHistory` **unchanged** | Not reached in failing path | `grantRunOnTopBeat` L2587–2605 |
| Run eligibility | `inRunContext && pileEndsRunContext(pile, runSeq)` | Should pass for standard 3+ card run endings | First branch L187–188 |
| 10-rule eligibility | `pileIsUniformTen && tenRule.active && tenRule.direction` | **Fails when `tenRule.direction === null`** even if trick actions carry `tenRuleDirection` | HEAD L192 — strict `tenRule.direction`; no trick recovery at grant time |
| Grant call site | Pass effective ten-rule (direction recovered) | Passes raw **`state.tenRule`** only | HEAD `maybeResolveTrickAfterPasses` L2854–2860, L2876–2882 |

**Working tree delta (not in production):**

```typescript
// isOnTopEligiblePile — recovers direction from currentTrick
const direction = tenRule.direction ?? resolveTenRuleDirectionFromTrick(currentTrick);

// maybeResolveTrickAfterPasses — passes resolveEffectiveTenRule(state)
// resolveEffectiveTenRule — recovers when tenRule.active OR runOnTop.active
if (recovered && (state.runOnTop?.active || state.tenRule?.active)) { ... }
```

**Automated proof engine CAN grant:** `scripts/test-core.ts` L1155–1232 (run), L1296–1328 (higher 10), L2414+ (10-rule regression). Tests use explicit hands and atomic `{ tenRuleDirection }` plays — they do not simulate **online sync with stripped `tenRule.direction`**.

---

### Stage 2 — `grantRunOnTopBeat`

| | Expected | Actual |
|---|----------|--------|
| Called when eligible | Sets `runOnTop`, `currentPlayerIndex = leader`, `mustPlay = true`, removes leader pass from trick | **Not called** on failing path — trick goes straight to `finalizeTrickWin` |

**Answer Q1 — Is On Top! ever being granted?**  
**In production play: effectively no** (trick finalizes instead). **In unit tests: yes.**

---

### Stage 3 — Server state (`server/index.js` + `server/turnAdvance.js`)

| Step | Expected | Actual (HEAD) | Evidence |
|------|----------|---------------|----------|
| `pass` action | `passTurn` → grant or finalize | Same core via `gameBridge.js` | L1924–1930 |
| Post-pass | Preserve `runOnTop` if granted | `advancePastInactiveSeats` respects `runOnTopTurn` | `turnAdvance.js` L30–32, L46, L90 |
| Broadcast | Full `gameState` incl. `runOnTop` | `gameStateView.js` spreads state — **no strip** | L17–18, L54–58 |
| Sync meta | `attachSyncMeta` adds version/phase only | Does not remove `runOnTop` | `gameSync.js` L52–58 |

**Answer Q2 — Is On Top! present in server state?**  
**No on the failing path** — server never sets it because Stage 1 finalizes the trick.

**HEAD server has no `runOnTopTurn` turn realignment** (working tree adds L1888–1900) — secondary bug when grant *does* occur but `currentPlayerIndex` drifted.

**Server deployment note:** `gameBridge.js` loads `src/game/core.ts` from disk at process start. Web client can be v1.0.60 while game server runs **stale code if not restarted** after deploy. Cannot confirm production server SHA from repo alone.

---

### Stage 4 — Socket sync → client (`GameScreen.tsx` `applyServerSync`)

| | Expected | Actual |
|---|----------|--------|
| `gameStateSync` payload | Includes `runOnTop` when granted | Payload never contains it on failing path |
| `parseServerGameState` | Accepts full snapshot | Passes through extra fields (`localPlayer.ts` L111–125) |
| `setState(repairStuckTurnPointer(parsed))` | Applies server `runOnTop` | L2269 — no strip |
| Optimistic online pass | Client may briefly set `runOnTop` via local `passTurn` | L4527–4531 — **overwritten** when server sync arrives with finalized trick (`trickHistory` length +1, `runOnTop` absent) |

**Answer Q3 — Is On Top! present in client state?**  
**No in steady state** — sync reflects finalized trick. Possible **sub-frame optimistic flash** on last passer’s client only.

**Answer Q4 — Stripped during sync?**  
**Not by sync logic.** State arrives **without** `runOnTop` because server never granted it. Stale-version rejection (`shouldApplyServerSnapshot`) can drop snapshots but is not the primary failure.

---

### Stage 5 — UI rendering (`GameScreen.tsx` → `GameTable.tsx`)

| UI element | Condition | Production HEAD behaviour |
|------------|-----------|---------------------------|
| **“On top!” pill text** | `state.runOnTop?.active` → `modifierLabel = "On top!"` | Never true on failing path |
| Pill visibility | `playModifierLabel = modifierLabel && !trickPauseFrozen` | `trickPauseFrozen` true after trick finalize — shows winner pause instead |
| **Animated On top! flash** | `humanRunOnTopTurn && playModifierLabel` | Requires `runOnTop.active` **and** local player is leader |
| Pass button | `passDisabled` includes `hasPassedInCurrentTrick` **without** `!humanRunOnTopTurn` | L5567 area — blocks pass even during on-top beat |
| `handlePassPress` / `handlePlayPress` | Should allow leader on on-top beat | **Block** when `hasPassedInCurrentTrick(actor.id)` — no `humanRunOnTopTurn` guard (L4517, L4723) |
| `runOnTopActive` (validation) | Compare to **`currentPlayerIndex`** | HEAD compares to **`displayTurnIndex`** (L4119–4121) — local `isValidPlay` can reject on-top plays |
| `isHumanTurn` | True for on-top leader | Uses `humanRunOnTopTurn` OR authoritative current — OK if `runOnTop` set |
| Quads overwrite | — | `fourOfAKindChallenge.active` **overwrites** `"On top!"` label (L4861–4864) — edge case only |

**Answer Q5 — UI suppressed?**  
**Yes, by absence of state**, not by a dedicated hide flag. When trick finalizes, **`trickPauseActive`** hides modifier pills and shows trick-win flow — player perceives “On Top never happened.”

**Answer Q6 — Missing commits audits assumed deployed?**  
**Partially.**

| Component | In production v1.0.60 (249eabb) | Only in working tree |
|-----------|-----------------------------------|----------------------|
| `grantRunOnTopBeat`, core on-top rules | ✅ | — |
| `onTopDiagnostics.ts` | ✅ | — |
| `test-core` on-top suite | ✅ | + direction-strip tests |
| **Grant-time direction recovery** (`isOnTopEligiblePile`, `maybeResolveTrickAfterPasses`) | ❌ | ✅ `core.ts` |
| **`resolveEffectiveTenRule` pre-grant recovery** (`tenRule.active` path) | ❌ | ✅ `core.ts` |
| **Client pass/play on-top guards** | ❌ partial | ✅ `GameScreen.tsx` |
| **`runOnTopActive` vs `currentPlayerIndex`** | ❌ | ✅ `GameScreen.tsx` |
| **Server run-on-top turn realignment** | ❌ | ✅ `server/index.js` |

The audit conflated **“code in bundle”** with **“functioning in live play.”**

---

## Exact failing condition

### Primary (10 higher / 10 lower) — **88% confidence**

**Condition:**

```text
maybeResolveTrickAfterPasses(state)
  → isOnTopEligiblePile(..., state.tenRule)
  → pileIsUniformTen(pile) && tenRule.active && tenRule.direction
  → FAIL when tenRule.direction === null
  → finalizeTrickWin (no runOnTop)
```

**When `tenRule.direction` is null at grant time (production):**

- Online `gameStateSync` / reconnect snapshots with `tenRule: { active: true, direction: null }` while `currentTrick.actions[].tenRuleDirection` still set
- Legacy two-step 10 path if direction not committed atomically
- HEAD **`resolveEffectiveTenRule` cannot recover before grant** — recovery requires `runOnTop.active`, which does not exist yet (chicken-and-egg)

**Affected files:** `src/game/core.ts` (`isOnTopEligiblePile`, `maybeResolveTrickAfterPasses`, `resolveEffectiveTenRule`)

**Fix size:** ~15–25 LOC in `core.ts` (working tree already has draft)

---

### Primary (run wins) — **72% confidence**

**Condition:** Same choke point — `isOnTopEligiblePile` run branch returns false → immediate finalize.

Run branch does **not** need `tenRule.direction`. Failures imply:

- `inRunContext` false at resolve time (run not detected from `pile` + `pileHistory` + `currentTrick`), **or**
- `pileEndsRunContext` false (pile top ≠ run tail), **or**
- `allOthersPassed` false (pass accounting / leader resolution)

During live tricks the UI may show **“Runs!”** (`getPlayTypePills` L4880–4882) while the trick is open, then jump to trick-end pause **without** ever setting `runOnTop.active`.

**Affected files:** `src/game/core.ts` (`resolveRunContext`, `isOnTopEligiblePile`, `maybeResolveTrickAfterPasses`, `resolveTrickLeaderIndex`)

**Fix size:** Investigation + 0–20 LOC depending on root run-context edge case; may share grant-path fix above.

---

### Secondary — client cannot act even if grant occurs — **82% confidence**

**Condition:** `runOnTop.active === true` but:

- `handlePassPress` / `handlePlayPress` reject `hasPassedInCurrentTrick` (leader passed earlier in trick before grant stripped pass from trick — timing window), **or**
- `passDisabled` lacks `!humanRunOnTopTurn`, **or**
- `runOnTopActive` uses `displayTurnIndex !== runOnTop.playerIndex` → wrong local validation

**Affected files:** `src/screens/GameScreen.tsx`, optionally `server/index.js` (turn index)

**Fix size:** ~25–40 LOC (working tree draft exists)

---

## Direct answers

| # | Question | Answer |
|---|----------|--------|
| 1 | Is On Top! ever being granted? | **No in production steady state.** Engine grants in tests; live path finalizes trick. |
| 2 | Present in server state? | **No** on failing path. |
| 3 | Present in client state? | **No** after sync. Brief optimistic grant possible, then overwritten. |
| 4 | Stripped during sync? | **No** — never sent. |
| 5 | UI suppressed? | **Yes** — no `runOnTop` + trick pause replaces table; pass/play guards block interaction if grant occurs. |
| 6 | Missing commits? | **Core grant exists in v1.0.60; grant-time recovery + client/server guards are uncommitted.** Audit overstated “functioning.” |

---

## Commits & files reference

### Shipped in production (249eabb)

| Commit / area | Relevance |
|---------------|-----------|
| `45cfb38` | On Top! rules introduced |
| `3be78a7` v1.0.48 | Trick win display after on-top |
| `c82ad46` v1.0.58 | Pre-commit 10, `resolveEffectiveTenRule`, offline sim on-top preprocess |
| `249eabb` v1.0.59 | `onTopDiagnostics.ts`, ceremony work |

### Not deployed (working tree)

| File | Change |
|------|--------|
| `src/game/core.ts` | Grant-time direction recovery; `resolveEffectiveTenRule` pre-grant; `maybeResolveTrickAfterPasses` uses effective ten-rule |
| `src/screens/GameScreen.tsx` | `!humanRunOnTopTurn` pass/play guards; `runOnTopActive` uses `currentPlayerIndex` |
| `server/index.js` | `runOnTopTurn` index realignment on pass/play |
| `scripts/test-core.ts` | Direction-strip recovery regression tests |

### Diagnostics (dev-only)

| File | Purpose |
|------|---------|
| `src/game/onTopDiagnostics.ts` | `[ON-TOP-DIAG]` when `__DEV__` or `EXPO_PUBLIC_ON_TOP_DIAG=1` |
| `scripts/investigate-play-stack.mjs` | Untracked — play-stack explorer |

---

## Recommendation

| Action | Priority |
|--------|----------|
| **Include uncommitted `core.ts` grant-path fixes in v1.0.61** | P0 — restores grant for 10-rule + sync edge cases |
| **Include `GameScreen.tsx` on-top pass/play guards + `runOnTopActive` fix** | P0 — makes granted beat usable |
| **Include `server/index.js` run-on-top turn sync** | P0 for online |
| **Verify production game server restarted on same commit as web** | P0 ops |
| **Add gate test: pass chain → `runOnTop.active` with stripped `tenRule.direction`** | P1 |
| **Correct ON_TOP_RELEASE_STATUS.md** | Governance — “code shipped ≠ live functioning” |

**Do not defer** — user report validates P0; unit tests alone are insufficient signoff.

---

## Confidence & fix estimate

| Item | Confidence | Est. LOC |
|------|------------|----------|
| Primary fail: `isOnTopEligiblePile` / grant path (10-rule) | **88%** | 15–25 |
| Run-win grant failure (same choke point) | **72%** | 0–20 |
| Client pass/play guards | **82%** | 25–40 |
| Server turn realignment | **75%** | ~8 |
| **Total minimal fix** | **85%** combined | **~50–70 LOC** across 3 files |

---

## Audit correction

> **Prior claim:** “On Top! as a feature is already shipped in production v1.0.60.”

**Revised:** On Top! **code is shipped**; the **production grant pipeline is not functioning** for reported scenarios. The feature behaves as if absent: tricks finalize immediately, trick-win UI runs, **`runOnTop` never reaches client state**, and interaction guards would block the beat even if it did.

**Evidence:** HEAD `isOnTopEligiblePile` strict direction check; grant site passes `state.tenRule` not recovered effective rule; UI binds `"On top!"` to `state.runOnTop?.active`; user observes zero appearance across run / higher-10 / lower-10 on live build.
