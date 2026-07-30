# Release Gate Failure Correlation — Evidence Report

**Agents:** Investigation (primary), Release, Regression  
**Date:** 2026-06-20  
**Gate run:** Server slice on port 4000 — gameplay failures, not infra  
**Scope:** Evidence only — **no implementation**

---

## Executive answer

**Are `botopn-lifecycle`, `botopn-stall-live`, and `multiplayer-round-transition-no-cards` independent failures, or one round-transition defect?**

**They are not a single root cause.** Evidence supports **three failure clusters**:

| Cluster | Failures | Root domain | Shared with P0 no-cards? |
|---------|----------|-------------|--------------------------|
| **A — Client ceremony / sync** | `multiplayer-round-transition-no-cards` (production P0) | `GameScreen.tsx` finalize / `tradesComplete` race | — (primary) |
| **B — Spectator → seated promotion** | `spectator-promote`, `botopn-stall-live` (live hang) | Server promotion deferred to `startNextRound`; roster / ready / sync | **No** |
| **C — BOTOPN between-rounds server stall** | `botopn-lifecycle` | `onBotRoomRoundFinished` → ready gate → `startNextRound` on BOTOPN path | **Partial symptom overlap only** |

**Confidence:** **High (85%)** on cluster separation; **Medium (65%)** that Cluster A fix also clears `botopn-lifecycle` if that gate failure is downstream of the same server transition (not yet proven — gate test is socket-only, no React client).

---

## Gate evidence (2026-06-20)

| Gate | Result | Failure string / symptom |
|------|--------|---------------------------|
| `quick-private-2h` | **PASS** | Multi-round private room deals and advances |
| `reconnect-rankings` | **PASS** | Rankings / reconnect path stable |
| `private-reconnect` | **PASS** | Disconnect / rejoin stable |
| `spectator-promote` | **FAIL** | `spectator should promote after ready` |
| `botopn-lifecycle` | **FAIL** | `next round did not start within 60s after round end` |
| `botopn-stall-live` | **HANG** | Live: `Could not get seated at BOTOPN within 120s — ready for promotion`; headless slice **PASS** |

Gate run terminated manually after ~10 min during live BOTOPN stall (`exit -1`). Partial results are authoritative for this cycle.

---

## Per-failure trace comparison

### 1. `multiplayer-round-transition-no-cards` (production P0)

| Dimension | Observation |
|-----------|-------------|
| **Path** | Private / standard multiplayer, React client |
| **Trigger** | Same player Asshole **3×** → round 4 **fresh round**, `skipPresidentTrade`, instant `tradesComplete` |
| **Round transition** | Server likely deals (`quick-private-2h` PASS); client shows **empty hands** |
| **Next-round ownership** | Seated humans; no spectator promotion |
| **Ceremony completion** | **`finalizeCeremonyRound` not run** when `tradesComplete` has hands but no `ceremonyPrep` / `tradePhase` |
| **Seated count** | Full table (3–4 humans); dead-hand model when 2 humans |
| **Classification** | **Bucket C** — client ceremony/sync ([P0_ROUND_TRANSITION_INVESTIGATION.md](../../P0_ROUND_TRANSITION_INVESTIGATION.md)) |

**Proposed fix scope:** `GameScreen.tsx` only (~40–80 lines). Director approval pending.

---

### 2. `botopn-lifecycle` (gate FAIL)

| Dimension | Observation |
|-----------|-------------|
| **Test** | `scripts/test-bot-table-lifecycle.mjs` → `testBotSoloCycle` |
| **Path** | BOTOPN; socket **observer only** (no React, no `GameScreen`) |
| **Trigger** | Bots finish one round; watcher waits for `nextRoundStarting` **or** non–round-complete `gameStateSync` |
| **Round transition** | Stuck **between rounds** ≥60s after `roundEnded` / `isRoundCompleteForLiving` |
| **Next-round ownership** | Bots auto-ready via `broadcastReadyForNextRound` / `autoReadyBotsForNextRound`; human watcher is **spectator**, not in ready map |
| **Ceremony completion** | **N/A** — test does not run client ceremony |
| **Seated count** | 2+ bots seated; watcher unseated |
| **Server pipeline** | `handleRoundFinished` → `onBotRoomRoundFinished` → ~15s delay → `tryStartNextRoundIfReady` → `startNextRound` |

**Assessment:** Same **symptom class** as “next round never starts” but **different mechanism** from P0 no-cards unless proven otherwise. Failure is observable on **raw server events**, pointing to BOTOPN **ready gate / auto-start timer / `startNextRound`** rather than React finalize. Private multi-round path (`quick-private-2h`) passes, so this is **BOTOPN-specific**, not universal round reset.

**Proposed fix scope (if isolated):** `server/botHostedRooms.js` + `server/index.js` ready/start path (~20–60 lines) **after** targeted logging confirms whether `tryStartNextRoundIfReady` never fires vs fires without observable state change. **Do not assume** Cluster A client fix resolves this gate.

**Confidence:** Medium (60%) — server-side BOTOPN between-rounds stall.

---

### 3. `botopn-stall-live` (gate HANG)

| Dimension | Observation |
|-----------|-------------|
| **Test** | `scripts/test-cpu-stall-botopn.mjs` — live + headless |
| **Live failure** | Human joins BOTOPN as **spectator**; spams `playerReadyForNextRound`; never appears in `gameState.players` with `hand.length > 0` within 120s |
| **Headless** | **PASS** — pass-on-run → `runBotTurnLoop` / turn ownership (mid-round CPU act) |
| **Round transition** | Live hang is **pre-seating**, not post-round no-cards |
| **Next-round ownership** | Promotion only at `startNextRound` via `promoteReadySpectators` |
| **Ceremony completion** | N/A for seating gate |
| **Seated count** | 0 humans seated; bots fill table; human waits for promotion |

**Assessment:** Live hang shares **promotion machinery** with `spectator-promote` (Cluster B), **not** ceremony Bucket C. Headless pass proves **turn loop** is a separate concern (Cluster C / independent regression).

**Proposed fix scope:** Spectator promotion + BOTOPN roster (`tableRoster.js`, `botHostedRooms.promoteReadySpectators`, `playerReadyForNextRound` / `startNextRound` ordering). Align with D-008 spectator work where applicable; promotion-at-ready vs promotion-at-`startNextRound` is the core design tension.

**Confidence:** High (80%) — shared with `spectator-promote`.

---

### 4. `spectator-promote` (gate FAIL)

| Dimension | Observation |
|-----------|-------------|
| **Test** | `scripts/test-multiplayer-matrix.mjs` — `ONLY=2hs`, `ROUNDS=1` |
| **Path** | 2 humans + 1 spectator, private room, dead-hand seat |
| **Trigger** | After round 1, spectator sends **one** `playerReadyForNextRound`; expects `isSpectator === false` within 800ms |
| **Round transition** | Seated humans already sent ready inside `playRounds`; spectator ready should trigger `tryStartNextRoundIfReady` |
| **Promotion** | `startNextRound` → `claimDeadHandForReadySpectator` (`tableRoster.js`) |
| **Ceremony** | Not implicated — failure is roster / promotion / sync flag |
| **Rankings** | Not implicated — round 1 complete only; no rankings-before-last-hand signature |

**Assessment:** **Independent** of P0 no-cards. Same **Cluster B** as BOTOPN live seating hang.

**Proposed fix scope:** Server promotion timing and/or `gameStateSync.spectator` refresh after `startNextRound`; possibly test harness wait for `nextRoundStarting` (evidence-only note — not a product fix).

**Confidence:** High (85%).

---

## Cross-comparison matrix

| Signal | P0 no-cards | botopn-lifecycle | botopn-stall-live (live) | spectator-promote |
|--------|-------------|------------------|--------------------------|-------------------|
| Between rounds | Yes | Yes | Blocked **before** seated | Yes (promotion) |
| Client ceremony | **Yes** | No (socket test) | No | No |
| BOTOPN path | No | **Yes** | **Yes** | No |
| Spectator promotion | No | Watcher irrelevant | **Yes** | **Yes** |
| Mid-round turn loop | No | No | Headless only | No |
| `nextRoundStarting` | Expected | **Missing** | N/A (not seated) | Expected after ready |
| Rankings ordering | Adjacent, flaky test history | No | No | No |

---

## Regression — rankings not implicated

Re-run **2026-06-20** (server on port 4000):

| Script | Result |
|--------|--------|
| `node scripts/test-reconnect-round-complete.mjs` | **PASS** — Test 3a, 3b |
| `node scripts/test-connected-round-end-order.mjs` | **PASS** — Test 1 |
| Gate `reconnect-rankings` | **PASS** (same gate run) |

**Conclusion:** New gate failures do **not** implicate `rankings-before-last-hand`. Rankings remain **conditional pass** — Human QA Tests 1–3 still pending ([rankings-qa-package.md](./rankings-qa-package.md)).

---

## Proposed fix scope summary (Director)

| Priority | Cluster | Scope | Blocks RC? |
|----------|---------|-------|------------|
| 1 | **A** — P0 no-cards | `GameScreen.tsx` ceremony finalize | **Yes** (RC-M1) |
| 2 | **B** — Spectator promotion | Server roster + promotion at `startNextRound`; sync `spectator` flag | **Yes** (gate + D-008 adjacency) |
| 3 | **C** — BOTOPN lifecycle | BOTOPN auto-start / ready gate (server) | **Yes** (RC-R8) — verify before merging with A |
| — | Headless turn loop | Already passing; monitor only | No |

**Do not implement** until Director approves per cluster.

---

## Release confidence (recalculated)

| Metric | Prior (2026-06-20 AM) | After correlation |
|--------|------------------------|-------------------|
| Single root cause | Assumed partial overlap | **Ruled out** — 3 clusters |
| RC ship readiness | DO NOT SHIP | **DO NOT SHIP** (unchanged) |
| Fix blast radius | One `GameScreen` patch fixes all | **Incorrect** — need 2–3 targeted fixes |
| Release confidence | Medium (~50%) | **Low–medium (40%)** — more distinct work than one defect |
| Rankings risk | Conditional pass | **Unchanged** — automated green |

---

## Recommended next evidence (no code)

1. **BOTOPN lifecycle:** Run `node scripts/test-bot-table-lifecycle.mjs` alone with server logging on `tryStartNextRoundIfReady`, `botTableCanStartNextRound`, `startNextRound` — confirm whether transition never starts vs starts without events.
2. **Spectator promote:** Capture whether `startNextRound` runs and `claimDeadHandForReadySpectator` returns non-null on 2hs fail.
3. **P0 no-cards:** Human QA hand-count capture per [P0_ROUND_TRANSITION_INVESTIGATION.md](../../P0_ROUND_TRANSITION_INVESTIGATION.md) (E5 evidence).
