# On Top v1.0.61 Fix — Verification Report

**Date:** 2026-06-20  
**Scope:** P0 grant logic, P0 client on-top turn, P1 turn ownership, P1 server validation  
**Investigation reference:** `ON_TOP_PRODUCTION_INVESTIGATION.md`

---

## Files modified

| File | LOC (diff stat) | Changes |
|------|-----------------|---------|
| `src/game/core.ts` | +10 / −6 (net ~16 touched) | Grant-path direction recovery; `resolveEffectiveTenRule` pre-grant recovery; three call sites use effective ten-rule |
| `src/screens/GameScreen.tsx` | +22 / −9 | `humanRunOnTopTurn` guards on play/pass handlers, passDisabled, card select, noValidPlays; `runOnTopActive` uses `currentPlayerIndex` |
| `server/index.js` | +10 / −1 | Realign `currentPlayerIndex` to `runOnTop.playerIndex`; allow on-top owner through turn gate |
| `scripts/test-core.ts` | +139 | Direction-strip regression tests (higher + lower 10) |

**Total:** 4 files, **179 insertions, 18 deletions** (`git diff --stat HEAD`).

---

## Fix summary by priority

### P0 — Grant logic (`core.ts`)

| Before | After |
|--------|-------|
| `isOnTopEligiblePile` required `tenRule.direction` set | Recovers direction from `currentTrick.actions[].tenRuleDirection` when `direction` is null |
| `maybeResolveTrickAfterPasses` passed raw `state.tenRule` | Passes `resolveEffectiveTenRule(state)` at all three grant call sites |
| `resolveEffectiveTenRule` only recovered direction when `runOnTop.active` | Also recovers when `tenRule.active` (pre-grant) |
| `resolveTenRuleDirectionFromTrick` returned null on first non-direction play | Scans all trick plays (does not abort early) |

### P0 — Client on-top turn (`GameScreen.tsx`)

| Surface | Fix |
|---------|-----|
| `handlePlayPress` | Skip "already passed" block when `humanRunOnTopTurn` |
| `handlePassPress` | Same + log "You skipped on top!" |
| `passDisabled` | Exempt when `humanRunOnTopTurn` |
| `playDisabled` | Already had exemption — unchanged |
| `handleCardPress` / `noValidPlays` | Exempt when `humanRunOnTopTurn` |

### P1 — Turn ownership (`GameScreen.tsx`)

| Before | After |
|--------|-------|
| `runOnTopActive = runOnTop.playerIndex === displayTurnIndex` | `=== state.currentPlayerIndex` (authoritative) |
| `humanRunOnTopTurn` derived from `myPlayerId` alone | Requires `runOnTopActive && localHumanId` |

### P1 — Server validation (`server/index.js`)

Before final pass/play, server now:

1. Detects `runOnTopTurn` for the acting player.
2. Realigns `working.currentPlayerIndex` to `runOnTop.playerIndex` when needed.
3. Skips "Not your turn" when `runOnTopTurn` is true.

---

## Tests executed

```bash
npx tsx ./scripts/test-core.ts
```

**Result:** Exit code **0** — all suites passed, including:

- `On-top direction recovery regression tests passed` (new)
- `On-top ten-rule regression tests passed` (existing higher/lower 10)
- Existing run on-top suite (`Run leader should get on top! after others pass`, etc.)

### New regression coverage (Test 4 analogue)

Simulates sync/reconnect strip: play 10 with `tenRuleDirection`, then set `tenRule = { active: true, direction: null }` before final passes.

| Case | Assertion |
|------|-----------|
| Higher 10 + direction strip | `isOnTopEligiblePile` true; `runOnTop.active` after passes; J valid / 9 rejected on beat |
| Lower 10 + direction strip | `runOnTop.active` after passes; 9 valid / 8 rejected on beat |

---

## Before / after traces

### Higher 10 with stripped direction (Test 1 / Test 4)

**Before (HEAD behaviour):**

```text
maybeResolveTrickAfterPasses
  → isOnTopEligiblePile(..., tenRule: { active: true, direction: null })
  → false
  → finalizeTrickWin
  → runOnTop: undefined, trickHistory.length += 1
```

**After (fixed — from test-core log):**

```text
play 10 higher → tenRule stripped to direction: null
pass 2, 3, 4
maybeResolveTrickAfterPasses: leaderIndex=0, passed=["2","3","4"]
→ grantRunOnTopBeat
→ runOnTop: { active: true, playerIndex: 0 }
→ trickHistory unchanged, pile still [10]
```

### Lower 10 (Test 2)

Same grant path; `resolveEffectiveTenRule` returns `direction: "lower"` after grant; validation accepts 9, rejects 8.

### Run win (Test 3)

Existing `test-core` run suite unchanged and passing. Run branch of `isOnTopEligiblePile` does not depend on `tenRule.direction`; no grant-path regression introduced.

### Online multiplayer (Test 5 — code audit)

**Before:** Server rejected actions when `player.id !== currentId` even if `runOnTop.active` and player was on-top owner.

**After:** `runOnTopTurn` bypass + index realignment before turn check.

Manual multiplayer verification **not run in this session** — server logic change is structural match to investigation fix; recommend one live 4-player pass-round on on-top beat before deploy.

---

## Manual test checklist (required before ship)

| # | Scenario | Expected | Automated | Manual |
|---|----------|----------|-----------|--------|
| 1 | Higher 10 win | On Top appears; winner play/pass | ✅ direction-strip test | ⬜ |
| 2 | Lower 10 win | On Top appears; winner play/pass | ✅ direction-strip test | ⬜ |
| 3 | Run win | On Top appears; winner acts | ✅ existing run tests | ⬜ |
| 4 | Reconnect before final pass | Direction from trick; grant | ✅ direction-strip test | ⬜ |
| 5 | Online multiplayer | No "Not your turn" on valid beat | ⬜ code only | ⬜ |

---

## Confidence estimate

| Area | Confidence | Notes |
|------|------------|-------|
| P0 grant (10 higher/lower) | **95%** | New + existing tests pass; root cause directly addressed |
| P0 grant (run wins) | **90%** | No code change to run branch; existing tests green |
| P0 client pass/play | **88%** | Guards aligned with `humanRunOnTopTurn`; not browser-tested here |
| P1 turn ownership UI | **85%** | `currentPlayerIndex` alignment; presentation edge cases possible |
| P1 server online | **80%** | Logic matches stash fix; needs live multiplayer smoke |
| **Overall ship readiness** | **88%** | Safe for v1.0.61 RC with one manual online on-top round |

---

## Not in scope (unchanged)

- Mission Control / studio tooling
- BOTOPN hide (D-010)
- Round transition / ceremony (Cluster A)
- Spectator promotion (Cluster B)

---

## Suggested commit message

```
fix: on-top grant path, client turn guards, server validation (v1.0.61)
```
