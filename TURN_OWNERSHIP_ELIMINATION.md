# Turn ownership elimination — post-1.1.0 initiative

**Status:** Post-1.1.0 engineering track (P2 technical debt)  
**Not:** RC2 blocker · 1.1.0 blocker · P0 gameplay bug  
**Gap register:** [ARCHITECTURE_GAPS.md](./ARCHITECTURE_GAPS.md) — **Turn Ownership Invariant**  
**Reference:** [TURN_OWNERSHIP_INVESTIGATION.md](./TURN_OWNERSHIP_INVESTIGATION.md)

---

## Problem

Bare simulation without production repair layers exposes latent core defects:

| Metric | Baseline (2026-06-08) |
|--------|------------------------|
| Harness | `scripts/release-gate/bare-turn-sim.mjs` |
| 100 games (42000–42099) | **22 failures (22%)** |
| 500 games | **99 failures (19.8%)** |
| 1000 games | **190 failures (19.0%)** |

All observed failures in baseline batches: **`turn on out player N`** — no `idle-empty`, `stuck`, or `no current player` in seeds 42000–42999.

Production avoids these via repair/masking layers (see Phase 1 inventory). Release gates pass because repairs are active.

**Objective:** reduce bare sim **100 games → 0 failures** without requiring `preprocessTurn` or `repairStuckTurnPointer`.

**Constraints:** do not add repair layers, expand preprocess coverage, or hide failures. Remove dependency — do not improve masking.

---

## Release guidance

```text
RC2        → Ship
1.1.0      → Ship once active player-facing defects are cleared
This track → Post-1.1.0 foundational hardening
```

Do not delay player-facing releases for this work.

---

## Success criteria

| Phase | Deliverable |
|-------|-------------|
| **1** | Document every ownership repair layer + invalid-state → cause → catcher map |
| **2** | Root cause(s) identified; failing seeds minimised and clustered |
| **3** | Bare sim 100 games @ 42000+: **0 failures** |
| **4** | Remove obsolete repair paths; update gates/docs |

---

## Agent assignments

### Architecture Agent (primary owner)

1. Maintain repair layer inventory (§ Phase 1 below).
2. Identify where ownership becomes invalid before repair runs.
3. Produce ownership state diagram: **Invalid state → How it occurs → Which repair catches it**.

### Gameplay Rules Agent

1. Collect failing seeds — `scripts/turn-ownership/failing-seeds-42000-42099.json`.
2. Minimise each seed (`offline-seed-42003-min-repro.mjs` pattern).
3. Cluster failures — one root cause vs multiple defects.

**Starter seeds (100-game batch):** 42005, 42010, 42011, 42015, 42017, 42021, 42026, 42030, 42033, 42036, 42038, 42042, 42044, 42047, 42049, 42052, 42055, 42058, 42061, 42064, 42070, 42074, 42088, 42093, 42096.

### Simulation Agent

Run after each core fix attempt:

```bash
node scripts/release-gate/bare-turn-sim.mjs
OFFLINE_BARE_SIM_GAMES=500 node scripts/release-gate/bare-turn-sim.mjs
OFFLINE_BARE_SIM_GAMES=1000 node scripts/release-gate/bare-turn-sim.mjs
OFFLINE_BARE_SIM_JSON=1 OFFLINE_BARE_SIM_GAMES=100 node scripts/release-gate/bare-turn-sim.mjs
```

Cluster by signature: `turn on out player`, `idle-empty`, `stuck`, `no current player`, `max steps`, `round incomplete`.

Update `scripts/turn-ownership/baseline-metrics.json` when baseline shifts.

### Exploration Agent

Target transitions for ownership corruption:

- Round boundaries
- Player finishes (goes out)
- Trick clears / finalize
- Ten-rule transitions
- On-top transitions

Use `scripts/explore-gameplay-edge.mjs` and min-repro scripts; compare **raw** `currentPlayerIndex` vs `resolveDisplayTurnPlayerIndex`.

---

## Phase 1 — Repair layer inventory

Production paths that **compensate** for invalid `currentPlayerIndex` without fixing the root fallback contract (`nextActivePlayerIndex` returns `fromIndex` when no seat can act).

| Layer | Location | Role | Masks |
|-------|----------|------|-------|
| **Core repair** | `core.ts` — `repairStuckTurnPointer`, `advanceOffPriorPasser`, `ensureTurnNotOnPriorPasser` | Re-point off passed/out seats after writers assign | Turn on prior passer; some out-seat stalls |
| **Server post-action** | `server/index.js` `gameAction` — `reconcileCurrentPlayerIndex` → `advancePastInactiveSeats` → `repairStuckTurnPointer` → `reconcileCurrentPlayerIndex` | Patch snapshot before broadcast | Online authoritative invalid index |
| **Inactive advance loop** | `server/turnAdvance.js` — `advancePastInactiveSeats` | Auto-pass / advance off dead, out, passed, ack-wait | Stuck on ineligible seat mid-trick |
| **BOTOPN repair** | `server/botHostedRooms.js` — `repairStuckTurnPointer`, `repairTurnPointerAndReschedule` | Bot table turn loop recovery | BOTOPN CPU stall / timer exit |
| **Display shim** | `core.ts` — `resolveDisplayTurnPlayerIndex` | UI turn hint skips stale pointer | Player sees correct “waiting for…” while authority wrong |
| **Release gate preprocess** | `offline-round-sim.mjs`, `quick-game-50-turns.mjs` — `preprocessTurn()` | GameScreen-style repair loop before CPU step | Bare sim passes in gated paths; **not** in bare harness |
| **Id-only reconcile** | `server/index.js` — `reconcileCurrentPlayerIndex` | Remap index by player id on join/reconnect | Can **preserve** out/passed seat if id still in array |

### Invalid state → occurrence → repair (draft)

| Invalid state | How it occurs (hypothesis) | Repair that catches it today |
|---------------|----------------------------|------------------------------|
| Turn on **out** player | `playCards` / `passTurn` / `finalizeTrickWin` assigns from `nextActivePlayerIndex` after opponent goes out; fallback returns `fromIndex` | `preprocessTurn` skip-empty-or-out → `passTurn`; server `advancePastInactiveSeats`; bare sim **fails here** |
| Turn on **prior passer** | Pass path leaves pointer on seat that already passed current trick | `repairStuckTurnPointer` → `advanceOffPriorPasser`; `preprocessTurn` advance-off-passer |
| Turn on **dead-hand** seat | Inactive seat not advanced before action | `advancePastInactiveSeats` |
| **Display ≠ authority** | Raw index stale; display resolver finds eligible seat | `resolveDisplayTurnPlayerIndex` (UI only); server repair on sync |
| **No eligible seat**, trick unresolved | `nextActivePlayerIndex` returns `fromIndex`; trick should finalize | `ensureTurnNotOnPriorPasser` partial; late-round all-passed mitigation in `passTurn`; still incomplete globally |

Architecture Agent: expand this table with file:line writers and sequence diagrams per transition type.

---

## Measurement harness

| Script | Preprocess / repair | Use |
|--------|---------------------|-----|
| `offline-round-sim.mjs` | **Yes** — `preprocessTurn` | Release gate (passes) |
| `bare-turn-sim.mjs` | **No** | Post-1.1.0 debt metric |
| `offline-seed-42003-min-repro.mjs` | Configurable | Single-seed minimisation |

Failing seed export: `scripts/turn-ownership/failing-seeds-42000-42099.json`  
Baseline metrics: `scripts/turn-ownership/baseline-metrics.json`

---

## Related docs

- [TURN_OWNERSHIP_INVESTIGATION.md](./TURN_OWNERSHIP_INVESTIGATION.md) — root cause, writer inventory, investigation guide
- [CPU_STALL_INVESTIGATION.md](./CPU_STALL_INVESTIGATION.md) — display vs authoritative desync symptom
- [ARCHITECTURE_GAPS.md](./ARCHITECTURE_GAPS.md) — gap register
- [RELEASE_GATE.md](./RELEASE_GATE.md) — shipping gates (unchanged; bare sim not gating)
