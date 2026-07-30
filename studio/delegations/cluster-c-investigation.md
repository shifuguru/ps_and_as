# Cluster C — Investigation Report (BOTOPN Lifecycle Escalation)

**Agent:** Investigation (escalation)  
**Date:** 2026-06-08 (escalation refresh)  
**Status:** **Classified — two failure modes reconciled**  
**Gates:** `botopn-lifecycle` (FAIL — Phase A or Phase B), `botopn-stall-live` (live FAIL / headless PASS)

---

## Executive summary

The contradiction between prior Phase B evidence and latest Phase A gate output is **resolved**. They are **not the same defect**.

| Failure mode | Message | Root domain | Typical trigger |
|--------------|---------|-------------|-----------------|
| **Phase A** | `round did not complete within 120s` | Mid-round stall — human on turn, bot loop idle | **Contaminated BOTOPN room** (orphan seated human from prior `test-cpu-stall-botopn` live run) |
| **Phase B** | `next round did not start within 60s after round end` | Between-rounds — auto-start timer never fires | **Clean BOTOPN room** — repeated `handleRoundFinished` resets 15s dwell timer |

**Classification:** **C — Independent defects** sharing one gate script and one global `BOTOPN` room. Phase A does not cause Phase B; Phase A prevents reaching round end.

| Metric | Prior (Phase B theory) | After escalation |
|--------|------------------------|------------------|
| Primary gate failure | Phase B ready-gate (83%) | **Phase depends on server state** |
| Phase B confidence | 83% (ready-map mismatch) | **88%** (timer churn via non-idempotent round finish) |
| Phase A confidence | 12% flake | **92%** (orphan human turn owner on shared server) |
| Implementation-ready (>80%) | Phase B ready-gate fix | **Phase B idempotency fix — yes; Phase A gate hygiene — separate** |

---

## 1. BOTOPN lifecycle timeline

### Normal path (clean room, observer only)

```
T+0s     ensureBotHostedRooms → startBotHostedGame
         └─ deal (beginAuthoritativeRound)
         └─ scheduleBotTurns → runBotTurnLoop

T+0…~90s  Mid-round (Phase A window in test)
         └─ processBotTurnStep: play / pass / ten-rule / ack
         └─ markBotProgress on each bot action
         └─ gameStateSync to watchers

T+round  Last living player out / finish sync
         └─ tryCompleteBotRound → finishBotRoundIfComplete
         └─ onRoundComplete → handleRoundFinished
              ├─ initReadyForNextRound (bots + spectators → false)
              ├─ autoReadyBotsForNextRound (cpu-* → true)
              ├─ roundXpAwardedAt = now
              ├─ onBotRoomRoundFinished
              │    ├─ broadcastReadyForNextRound
              │    ├─ clearBotNextRoundSchedule
              │    ├─ _botNextRoundAt = now + 15s
              │    └─ setTimeout → tryStartNextRoundIfReady → startNextRound
              ├─ emit roundEnded
              └─ emit playerReadyUpdate (+ botNextRoundAt)

T+15s    Expected: startNextRound
         └─ nextRoundStarting + fresh deal + scheduleBotTurns

T+15…75s Phase B window in test (60s after round end observed)
```

### Observed Phase B failure path (fresh server, port 4002)

Round end **was reached** (~74s). After round end:

- `roundEnded` received ✓
- `readyForNextRound`: `{ cpu-1: true, cpu-2: true, <watcher-id>: false }` ✓ (bots ready)
- `botNextRoundAt` set (~15s ahead) ✓
- **`nextRoundStarting` never received** ✗
- After 65s post-round: `phase: ROUND_COMPLETE`, `finishedOrder: [cpu-2, cpu-1]` unchanged

**Last successful event before Phase B timeout:** `roundEnded` + `playerReadyUpdate` with `botNextRoundAt` — not bot gameplay.

### Observed Phase A failure path (shared server port 4000)

Round end **never reached** within 120s despite state changes (progress seen).

**Last successful event before Phase A timeout:** bot turn progression until turn landed on **`stall-human-1`** (StallHuman), then freeze.

---

## 2. Evidence capture at failure

### Phase A — contaminated server (probe 2026-06-08, port 4000)

| Field | Value |
|-------|-------|
| **Verdict** | PHASE_A_TIMEOUT |
| **Elapsed** | 125s |
| **State changes** | 6 (then frozen ~12s before timeout) |
| **Turn owner** | `stall-human-1` (StallHuman) |
| **Roster (gameState)** | cpu-1 (18 cards), cpu-2 (17 cards), stall-human-1 (18 cards) |
| **finishedOrder** | `[]` — round not complete |
| **readyForNextRound** | `{}` |
| **Bot states** | Bot loop idle — `shouldBotCpuAct` false (human current player) |
| **Server events** | 2× `botTableSkipped: Restarting stalled bot table…` (repair fired; human re-seated on turn after reset) |
| **Gate log correlation** | Prior `botopn-stall-live` uses `profileId: stall-human-1`; live test disconnects without clearing seated state |

### Phase B — fresh server (probe 2026-06-08, port 4002)

| Field | Value |
|-------|-------|
| **Verdict** | PHASE_B_FAIL |
| **Round-end wait** | 73.6s |
| **Post-round wait** | 65.0s |
| **Turn owner** | cpu-1 (1 card — asshole; round complete) |
| **finishedOrder** | `[cpu-2, cpu-1]` |
| **readyForNextRound** | cpu-1 ✓, cpu-2 ✓, watcher ✗ (spectator — **not** in `activeRoundPlayerIds`) |
| **botNextRoundAt** | Set; shifted across multiple `playerReadyUpdate` (timer reschedule) |
| **nextRoundStarting** | false |
| **Server log** | Normal bot play through round; no `startNextRound` log; watcher disconnect at end |

### Fresh lifecycle run (port 4001, isolated server)

```
FAIL bot solo: round end + auto next deal: next round did not start within 60s after round end
```

Confirms **Phase B on clean room** — contradicts Phase A-only interpretation of latest gate runs on shared port 4000.

---

## 3. Root cause classification

### Question: A / B / C?

**Answer: C — Independent defects**

| Link | Assessment |
|------|------------|
| Same defect? | **No** — Phase A = mid-round human orphan; Phase B = between-rounds timer churn |
| A causes B? | **No** — round never completes in Phase A |
| B causes A? | **No** — Phase B requires round completion first |
| Shared factor? | **Yes** — singleton `BOTOPN` room + gate test ordering on long-lived server process |

### Phase A — orphan human turn (92% confidence)

**Mechanism:** `test-cpu-stall-botopn.mjs` live path joins as `stall-human-1`, may seat in `gameState.players`, passes on run, disconnects. Human remains seated with turn ownership. `shouldBotCpuAct` returns false; `runBotTurnLoop` does not act. Observer-only `testBotSoloCycle` sees progress until human turn, then stall.

**Not** the RC-H pass-on-run bot loop bug (headless PASS).

**Aggravator:** `repairBotHostedRoomIfNeeded` resets table but **does not evict** orphan humans from `room.players`; fresh deal can restore same stall.

### Phase B — round-finish timer churn (88% confidence)

**Mechanism:** `finishBotRoundIfComplete` → `onRoundComplete` → `handleRoundFinished` has **no idempotency guard**. While round is complete, `processBotTurnStep` / `runBotTurnLoop` can call `tryCompleteBotRound` repeatedly. Each call:

1. Re-runs `initReadyForNextRound` + `autoReadyBotsForNextRound`
2. Re-runs `onBotRoomRoundFinished` → **`clearBotNextRoundSchedule` + new 15s timer**

The 15s auto-start timer is **perpetually reset**; `tryStartNextRoundIfReady` never runs.

**Evidence:** Multiple `playerReadyUpdate` with shifting `botNextRoundAt` after single round end; bots ready; `botTableCanStartNextRound` would pass (active ids cpu-1/cpu-2 only).

**Prior hypothesis (ready-map mismatch at 45%) — downgraded.** Spectator `false` in ready map is a red herring; `allPlayersReadyForNextRound` checks `activeRoundPlayerIds` only.

---

## 4. Contradiction reconciliation

| Source | Failure string | Server state | Interpretation |
|--------|----------------|--------------|----------------|
| gate-failure-correlation.md (2026-06-20) | Phase B | Post–Cluster A+B gate on shared server | Valid — likely clean or round-completed path |
| gate-run-cluster-ab.txt | Phase A | After 4 server gates on port 4000 | Valid — room contaminated before lifecycle test |
| Release Agent gate (40867) | Phase A | Long offline-sim + shared port 4000 | **Misleading tail logs** — core debug before FAIL is offline-sim, not BOTOPN |
| Fresh server 4001/4002 (this escalation) | Phase B | Isolated process | **Authoritative for Cluster C product defect** |

**Conclusion:** Latest gate did not disprove Phase B theory — it exposed **Phase A as gate-infra noise** on a dirty server. Both signatures are real; **Phase B is the RC defect**; Phase A is **release-gate reliability**.

---

## 5. Recommended fix scope (evidence only — not implemented)

### Phase B — primary Cluster C fix (~15–25 LOC)

| Change | File | Purpose |
|--------|------|---------|
| Guard `handleRoundFinished` or `finishBotRoundIfComplete` when round already finalized (`roundXpAwardedAt` / phase `ROUND_COMPLETE` + roles set) | `server/index.js` or `botHostedRooms.js` | Stop timer churn |
| **Or** skip `clearBotNextRoundSchedule` in `onBotRoomRoundFinished` if `_botNextRoundTimer` already active | `botHostedRooms.js` | Minimal timer protection |

**Do not** rely on ready-map force-ready alone — bots are already ready in captured failure state.

### Phase A — gate hygiene (~0 LOC product / test harness)

| Change | Owner | Purpose |
|--------|-------|---------|
| Restart server before `botopn-lifecycle` in full gate | Release gate | Clean BOTOPN |
| Evict orphan humans on bot table reset | `botHostedRooms.js` (optional) | Prevent stall-human recurrence |
| Run lifecycle test on fresh port in CI | Release gate | Deterministic Phase B signal |

### Phase A mid-round bot loop (only if Phase A reproduces on fresh server)

Not observed on fresh servers in this escalation — **defer**.

---

## 6. Risk assessment

| Risk | Level | Notes |
|------|-------|-------|
| Phase B idempotency guard skips legitimate re-finish | Low | Guard on `roundXpAwardedAt` + between-round phase |
| Ready-map force-ready (prior proposal) | **Insufficient** | Does not address timer reset |
| Phase A persists in production | Low | Requires orphan human at BOTOPN mid-round without client |
| Gate false Phase A on dirty server | **High** | Blocks deploy signal; fix gate process |
| Regression on `quick-private-2h` | Low | Private path uses human ready, different finish idempotency surface |

---

## 7. Confidence estimates (post-escalation)

| Item | Confidence | Implementation-ready (>80%)? |
|------|------------|------------------------------|
| Phase B — timer churn root cause | **88%** | **Yes** (revised fix scope) |
| Phase A — orphan human contamination | **92%** | Gate hygiene only |
| Prior Phase B ready-gate-only theory | **35%** | Superseded |
| Same defect for A and B | **<5%** | Ruled out |
| Overall Cluster C product fix | **88%** | **Yes** — idempotency, not ready-map patch alone |

---

## 8. Verification commands

```bash
# Phase B (expect FAIL with Phase B string on clean server)
PORT=4001 node server/index.js
SERVER_URL=http://localhost:4001 node scripts/test-bot-table-lifecycle.mjs

# Phase A probe (expect stall on dirty server with stall-human-1)
SERVER_URL=http://localhost:4000 node -e '...'  # see escalation probe script

# After Phase B fix (target)
SERVER_URL=http://localhost:4001 node scripts/test-bot-table-lifecycle.mjs  # PASS solo cycle
```

---

## 9. Artifacts

| Artifact | Path |
|----------|------|
| Fresh Phase B lifecycle fail | `test-results/fresh-lifecycle-run.txt` |
| Fresh server log (Phase B) | `test-results/fresh-server-4001.log` |
| Phase B state capture | `test-results/phaseb-probe-server.log` + inline probe JSON (2026-06-08) |
| Phase A state capture | port 4000 probe JSON (2026-06-08) |
| Prior gate (Phase A on shared server) | `gate-run-cluster-ab.txt` line 857 |

---

**Investigation Agent:** Escalation complete. Phase B remains the Cluster C product defect with **revised root cause** (timer churn, not ready-gate silence). Phase A is gate contamination — independent. **Do not implement** until Director approves (per sprint rules).
