# Turn ownership investigation

**Status:** Reference material only — not an active implementation stream.  
**Gap register:** [ARCHITECTURE_GAPS.md](./ARCHITECTURE_GAPS.md) — **Turn Ownership Invariant** (P2, Documented)  
**Use when:** A live multiplayer bug traces to authoritative `currentPlayerIndex` / turn eligibility.  
**Do not use for:** Proactive refactors, new ownership APIs, or architecture passes.  
**Related:** [CPU_STALL_INVESTIGATION.md](./CPU_STALL_INVESTIGATION.md) (symptom: authoritative vs display desync)

---

## Summary

During active gameplay, `currentPlayerIndex` is treated as the **authoritative** seat for play/pass validation, bot turn loops, and server `gameAction` checks. Multiple writers can leave the pointer on an **out**, **passed**, or otherwise **ineligible** seat. Downstream **repair** (`ensureTurnNotOnPriorPasser`, `repairStuckTurnPointer`, `advancePastInactiveSeats`) compensates but does not define ownership.

**Key finding:** The root issue is not individual assignment sites. It is that **“no valid next player” is encoded as a valid index** via `nextActivePlayerIndex` returning `fromIndex` when no seat satisfies `playerCanActInCurrentTrick` (`src/game/core.ts` ~2782). Callers assign that value directly; repair passes then try to fix the snapshot after the fact.

---

## Intended invariants (active gameplay)

After a **committed** gameplay transition (and before broadcast on the server), `currentPlayerIndex` should reference a **legal authoritative seat**:

| Requirement | Predicate |
|---------------|-----------|
| Seat exists | `players[currentPlayerIndex]` defined |
| Still in round | `isPlayerStillIn(state, id)` |
| May act this trick | `playerCanActInCurrentTrick(state, index)` **or** documented phase exception below |

### Documented exceptions (pointer may differ from “may act now”)

| Phase | Behaviour |
|-------|-----------|
| `tenRulePending` | Clock frozen; chooser is `tenRuleChooserIndex()` (derived from `lastPlayPlayerIndex` / `currentPlayerIndex`). |
| Acknowledgment-pass phase | Concurrent ack passes; leader may wait at `lastPlayPlayerIndex`; `canAcknowledgmentPass` allows off-turn passes. |
| Round complete / between-rounds | Pointer non-authoritative; no play/pass. |
| Room pause (standard online) | Snapshot frozen; away seat may still be `currentPlayerIndex`; `isGamePausedForAway` blocks `gameAction`. |

Disconnect / pause is **room-layer** (`server/index.js`); `GameState` has no `disconnectedAt`.

---

## Invalid states (bugs when authoritative)

| State | Typical symptom |
|-------|-----------------|
| Out seat (`!isPlayerStillIn`) | “Waiting for \<out player\>”; no one can act; bots idle |
| Prior passer (not run-on-top) | CPU stall; `resolveDisplayTurnPlayerIndex` ≠ `currentPlayerIndex` |
| Dead-hand seat during play | Blocked or looping inactive advance |
| No eligible seat, trick not resolved | Stall until repair or manual intervention |

**Mid-function** stale pointer (before `ensureTurn` / `maybeResolve`) is expected during multi-step core transitions. **Invalid** means an authoritative snapshot **after** server post-pipeline or client sync that still blocks gameplay incorrectly.

---

## Root cause: `nextActivePlayerIndex` fallback contract

```ts
// src/game/core.ts — when no seat can act:
return fromIndex;
```

Semantic collapse:

- “Trick should finalize” → treated as “stay at `fromIndex`”
- “Round complete” → same
- “True bug” → same

Downstream effects:

1. **`ensureTurnNotOnPriorPasser`** — out branch returns when `next === idx` without resolving (~2739–2742).
2. **Direct assigns** — `playCards`, `passTurn`, `setTenRuleDirection`, `finalizeTrickWin`, server `removePlayerFromActiveGame`, `turnAdvance.js` all inherit silent failure.
3. **`reconcileCurrentPlayerIndex`** — remaps by player id only; preserves out/passed seat if id still in `players[]` (~84–88 `server/index.js`).
4. **Dual turn view** — `resolveDisplayTurnPlayerIndex` + `repairStuckTurnPointer` in `GameScreen` (offline) and server pipeline (online) mask authoritative bugs for UI.

---

## Compensating controls (not ownership)

| Layer | File | Role |
|-------|------|------|
| Core repair | `src/game/core.ts` — `repairStuckTurnPointer`, `advanceOffPriorPasser`, `ensureTurnNotOnPriorPasser` | Fix passer/out pointer after assign |
| Server post-action | `server/index.js` `gameAction` — `reconcileCurrentPlayerIndex` → `advancePastInactiveSeats` → `repairStuckTurnPointer` | Patch snapshot before broadcast |
| Inactive loop | `server/turnAdvance.js` — `advancePastInactiveSeats` | Auto-pass / advance off dead, out, passed, ack-wait |
| Display shim | `src/game/core.ts` — `resolveDisplayTurnPlayerIndex` | UI turn hint skips stale pointer |
| Client offline | `src/screens/GameScreen.tsx` — CPU effect calls `repairStuckTurnPointer` | Local parity with server repair |

These exist because writers do not guarantee the invariant before handoff.

---

## Writer inventory (production)

Direct `currentPlayerIndex` assignments — see prior audit in conversation / gap entry. High-risk pattern: **assign from `nextActivePlayerIndex` without immediate trick resolve**.

Shipped mitigation (pass path): `passTurn` for out actor returns `advanceOffPriorPasser` (~2539–2541). Does not fix fallback contract globally.

---

## Evidence / regression

| Artifact | Notes |
|----------|-------|
| `scripts/test-core.ts` | Regression ~out seat + living all passed + `lastPlayPlayerIndex` on out |
| `CPU_STALL_INVESTIGATION.md` | Display index correct, authoritative index on passed human |
| `reports/qa/verify-rc1-live.mjs` | Uses `resolveDisplayTurnPlayerIndex` vs raw index |

---

## Investigation guide (future bugs)

When investigating “stuck turn”, “waiting for out player”, or “CPU won’t act”:

1. Read **raw** `currentPlayerIndex` and seat id — not only UI turn hint.
2. Compare to `resolveDisplayTurnPlayerIndex` — desync ⇒ repair/assign bug, not display bug.
3. Check `playerCanActInCurrentTrick`, `isPlayerStillIn`, `hasPassedInCurrentTrick`, `runOnTop`.
4. Trace last mutation: `playCards` / `passTurn` / `finalizeTrickWin` / `reconcileCurrentPlayerIndex` / `turnAdvance.js`.
5. Ask: did `nextActivePlayerIndex` return `fromIndex` with no eligible seat? If yes, treat as **contract bug**, not a one-off assign line.
6. Do **not** add another local assign fix without considering fallback semantics (see gap register).

---

## Suggested future work (documentation only)

No implementation in this track. When prioritised:

1. **Document phase exceptions** in `GAME_ARCHITECTURE.md` / `docs/rules.md` — single table for when `currentPlayerIndex` is authoritative vs frozen.
2. **Invariant check before broadcast** — dev-only assert or test helper: after server `gameAction` pipeline, current seat is legal or in named exception phase.
3. **Unify reconcile + validity** — `reconcileCurrentPlayerIndex` should not return early on id remap without living/can-act check (design note only).
4. **Collapse display shim** — long-term: authoritative index always legal ⇒ remove `resolveDisplayTurnPlayerIndex` from player-facing hints (depends on core contract fix).
5. **Test matrix** — extend `test-core.ts` with cases for: out leader + all passed, ten-rule after out play, `removePlayerFromActiveGame` while current, bot loop after pass-on-run (see CPU stall doc).
6. **Cross-link bot stall** — RC-1 timer exit when `shouldBotCpuAct` false may be downstream of invalid pointer; fix ownership before adding more bot-loop branches.

**Explicitly out of scope for this gap:** introducing new result types, redesigning turn ownership API, or patching individual assign sites without addressing the fallback.

---

## Related docs

- [ARCHITECTURE_GAPS.md](./ARCHITECTURE_GAPS.md) — Turn Ownership Invariant
- [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) — § Turn ownership (intent)
- [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md) — Event flow + repair pipeline
- [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) §6 — Pause preserves turn pointer
